// Carga em massa EXCIA -> banco analítico via consulta SQL direta (Firebird).
// Muito mais rápida que a paginação REST (que estoura o sort do Firebird):
// cada tabela é uma varredura só. Datas montadas por EXTRACT (o driver
// corrompe Date); preço resolvido em TABPRECO_001 por REGIÃO = TAB_PRE.
import { idb, setSync } from './intelDb.js';
import { fbQuery, fbStream, dataISO, firebirdConfigurado, FB_EMPRESA } from './firebirdClient.js';

const E = FB_EMPRESA; // sufixo de empresa nas tabelas (_001)
const DT_PED_INI = process.env.EXCIA_DT_PED || '01/01/2024';
const isoDtPed = () => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(DT_PED_INI);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '2024-01-01';
};
const hoje = () => new Date().toISOString().slice(0, 10);

// ---- clientes (ENTIDADE) -------------------------------------------------
const upCli = idb.prepare(`INSERT INTO clientes_ex
  (codcli, nome, fantasia, cnpj, cidade, uf, data_cad, condicao, sit_cli, ativo, codrep, dt_altera, raw)
  VALUES (@codcli,@nome,@fantasia,@cnpj,'','',@data_cad,@condicao,@sit_cli,@ativo,@codrep,'',NULL)
  ON CONFLICT(codcli) DO UPDATE SET nome=@nome, fantasia=@fantasia, cnpj=@cnpj,
    data_cad=@data_cad, condicao=@condicao, sit_cli=@sit_cli, ativo=@ativo, codrep=@codrep`);

export async function syncClientesFB() {
  const sql = `SELECT TRIM(CODCLI) CODCLI, NOME, FANTASIA, CNPJ, TRIM(CODREP) CODREP,
      CONDICAO, SIT_CLI, ATIVO, TIPO_ENTIDADE,
      EXTRACT(YEAR FROM DATA_CAD) AA, EXTRACT(MONTH FROM DATA_CAD) MM, EXTRACT(DAY FROM DATA_CAD) DD
    FROM ENTIDADE_${E}`;
  let n = 0;
  await fbStream(sql, [], (lote) => {
    const tx = idb.transaction(() => {
      for (const r of lote) {
        if (!r.codcli) continue;
        upCli.run({
          codcli: r.codcli,
          nome: (r.nome || '').trim(), fantasia: (r.fantasia || '').trim(), cnpj: (r.cnpj || '').trim(),
          data_cad: dataISO(r.aa, r.mm, r.dd),
          condicao: (r.condicao || '').trim(), sit_cli: (r.sit_cli || '').trim(),
          ativo: (r.ativo || '').trim(),
          codrep: JSON.stringify(r.codrep ? [r.codrep.trim()] : []),
        });
        n++;
      }
    });
    tx();
  });
  setSync('clientes', { cursor: hoje(), detalhe: `${n} registros (Firebird)` });
  return n;
}

// ---- produtos (PRODUTO + preço de lista de TABPRECO) ---------------------
const upProd = idb.prepare(`INSERT INTO produtos
  (codigo, descricao, grupo, linha, familia, marca, colecao, etiqueta, unidade,
   preco_tabela, data_cad, ativo, status, cores, tams, dt_altera, raw)
  VALUES (@codigo,@descricao,@grupo,@linha,@familia,@marca,@colecao,@etiqueta,@unidade,
   @preco_tabela,@data_cad,@ativo,@status,@cores,@tams,'',NULL)
  ON CONFLICT(codigo) DO UPDATE SET descricao=@descricao, grupo=@grupo, linha=@linha,
    familia=@familia, marca=@marca, colecao=@colecao, etiqueta=@etiqueta, unidade=@unidade,
    preco_tabela=@preco_tabela, data_cad=@data_cad, ativo=@ativo, status=@status,
    cores=@cores, tams=@tams`);

// Grade de tamanhos cadastrada por FAIXA (P/M/G, 1/2/3/4...), ordenada por
// POSICAO. Vale mesmo para coleção nova (que ainda não tem histórico de itens).
async function carregarFaixas() {
  const rows = await fbQuery(
    `SELECT TRIM(FAIXA) FAIXA, TRIM(TAMANHO) TAMANHO FROM FAIXA_ITEN_${E} ORDER BY FAIXA, POSICAO`,
  );
  const mapa = new Map();
  for (const r of rows) {
    const f = (r.faixa || '').trim();
    if (!mapa.has(f)) mapa.set(f, []);
    if (r.tamanho) mapa.get(f).push(r.tamanho.trim());
  }
  return mapa;
}

export async function syncProdutosFB() {
  const faixas = await carregarFaixas();
  // Preço de referência: menor PRECO_00 > 0 na TABPRECO (à vista); se a coleção
  // ainda não foi precificada na lista, cai para PRODUTO.PRECO.
  const sql = `SELECT TRIM(p.CODIGO) CODIGO, p.DESCRICAO, TRIM(p.GRUPO) GRUPO, TRIM(p.LINHA) LINHA,
      TRIM(p.FAMILIA) FAMILIA, TRIM(p.MARCA) MARCA, TRIM(p.COLECAO) COLECAO,
      TRIM(p.ETIQUETA) ETIQUETA, p.UNIDADE, p.ATIVO, p.STATUS, TRIM(p.FAIXA) FAIXA, p.PRECO PRECO_PROD,
      EXTRACT(YEAR FROM p.DATA_CAD) AA, EXTRACT(MONTH FROM p.DATA_CAD) MM, EXTRACT(DAY FROM p.DATA_CAD) DD,
      (SELECT MIN(t.PRECO_00) FROM TABPRECO_${E} t WHERE t.CODIGO=p.CODIGO AND t.PRECO_00>0) PRECO
    FROM PRODUTO_${E} p`;
  let n = 0;
  await fbStream(sql, [], (lote) => {
    const tx = idb.transaction(() => {
      for (const r of lote) {
        if (!r.codigo) continue;
        const tams = faixas.get((r.faixa || '').trim()) || [];
        upProd.run({
          codigo: r.codigo, descricao: (r.descricao || '').trim(),
          grupo: (r.grupo || '').trim(), linha: (r.linha || '').trim(),
          familia: (r.familia || '').trim(), marca: (r.marca || '').trim(),
          colecao: (r.colecao || '').trim(), etiqueta: (r.etiqueta || '').trim(),
          unidade: (r.unidade || '').trim(),
          preco_tabela: Number(r.preco || 0) || Number(r.preco_prod || 0),
          data_cad: dataISO(r.aa, r.mm, r.dd),
          ativo: (r.ativo || '').trim() || 'S', status: (r.status || '').toString().trim(),
          cores: '[]', tams: JSON.stringify(tams),
        });
        n++;
      }
    });
    tx();
  });
  // Cores efetivamente vendidas por produto (para os cards; não afeta a grade).
  atualizarCoresProduto();
  setSync('produtos', { cursor: hoje(), detalhe: `${n} registros (Firebird)` });
  return n;
}

function atualizarCoresProduto() {
  const rows = idb.prepare(`SELECT codigo,
      (SELECT GROUP_CONCAT(DISTINCT cor) FROM pedido_itens i WHERE i.codigo=p.codigo) cores
    FROM produtos p WHERE EXISTS (SELECT 1 FROM pedido_itens i WHERE i.codigo=p.codigo)`).all();
  const up = idb.prepare('UPDATE produtos SET cores=? WHERE codigo=?');
  const tx = idb.transaction(() => {
    for (const r of rows) {
      const cores = r.cores ? [...new Set(r.cores.split(','))].filter(Boolean) : [];
      up.run(JSON.stringify(cores), r.codigo);
    }
  });
  tx();
}

// ---- pedidos (cabeçalhos PEDIDO) -----------------------------------------
const upPed = idb.prepare(`INSERT INTO pedidos
  (numero, codcli, codrep, nome_rep, dt_emissao, colecao, pgto, valor_liq, qtde_fat, cancelado, situacao, itens_ok, dt_altera)
  VALUES (@numero,@codcli,@codrep,'',@dt_emissao,@colecao,@pgto,0,0,0,'P',1,'')
  ON CONFLICT(numero) DO UPDATE SET codcli=@codcli, codrep=@codrep, dt_emissao=@dt_emissao,
    colecao=@colecao, pgto=@pgto, itens_ok=1`);

export async function syncPedidosFB() {
  const sql = `SELECT TRIM(NUMERO) NUMERO, TRIM(CODCLI) CODCLI, TRIM(CODREP) CODREP,
      TRIM(COLECAO) COLECAO, PGTO,
      EXTRACT(YEAR FROM DT_EMISSAO) AA, EXTRACT(MONTH FROM DT_EMISSAO) MM, EXTRACT(DAY FROM DT_EMISSAO) DD
    FROM PEDIDO_${E} WHERE DT_EMISSAO >= ?`;
  let n = 0;
  await fbStream(sql, [isoDtPed()], (lote) => {
    const tx = idb.transaction(() => {
      for (const r of lote) {
        if (!r.numero) continue;
        upPed.run({
          numero: r.numero, codcli: (r.codcli || '').trim(), codrep: (r.codrep || '').trim(),
          dt_emissao: dataISO(r.aa, r.mm, r.dd), colecao: (r.colecao || '').trim(),
          pgto: (r.pgto || '').trim(),
        });
        n++;
      }
    });
    tx();
  });
  setSync('pedidos', { cursor: hoje(), detalhe: `${n} cabeçalhos (Firebird)` });
  return n;
}

// ---- itens (PEDIDO3 + preço por REGIÃO=TAB_PRE) --------------------------
const insItem = idb.prepare(`INSERT OR REPLACE INTO pedido_itens
  (numero, ordem, codigo, cor, desc_cor, tam, preco, qtde, faturado, cancelado, estampa, desc_estampa)
  VALUES (?,?,?,?,'',?,?,?,?,0,'','')`);

export async function syncItensFB() {
  // Só itens de pedidos já carregados (janela DT_PED_INI). Preço à vista da
  // região do pedido; quantidade = pendente + faturado.
  const sql = `SELECT TRIM(i.NUMERO) NUMERO, i.ORDEM, TRIM(i.CODIGO) CODIGO, TRIM(i.COR) COR,
      TRIM(i.TAM) TAM, i.QTDE QP, i.QTDE_F QF,
      (SELECT FIRST 1 t.PRECO_00 FROM TABPRECO_${E} t WHERE t.CODIGO=i.CODIGO AND t.REGIAO=p.TAB_PRE AND t.PRECO_00>0) PRECO
    FROM PEDIDO3_${E} i JOIN PEDIDO_${E} p ON p.NUMERO=i.NUMERO
    WHERE p.DT_EMISSAO >= ?`;
  idb.prepare('DELETE FROM pedido_itens').run(); // recarga limpa dos itens da janela
  let n = 0;
  await fbStream(sql, [isoDtPed()], (lote) => {
    const tx = idb.transaction(() => {
      for (const r of lote) {
        const q = Number(r.qp || 0), qf = Number(r.qf || 0);
        if (q + qf === 0) continue;
        insItem.run(r.numero, Number(r.ordem || 0), r.codigo, (r.cor || '').trim(),
          (r.tam || '').trim(), Number(r.preco || 0), q, qf);
        n++;
      }
    });
    tx();
  }, { batch: 5000 });

  // Recalcula valor e quantidade faturada dos pedidos a partir dos itens, e
  // marca como PENDENTE (itens_ok=0) os pedidos que ficaram SEM itens em
  // PEDIDO3 — tipicamente sell-in da temporada nova, cuja grade só a API REST
  // expõe. Esses são completados sob demanda por BuscarPedido na análise.
  idb.exec(`
    UPDATE pedidos SET
      valor_liq = COALESCE((SELECT SUM((i.qtde+i.faturado)*i.preco) FROM pedido_itens i WHERE i.numero=pedidos.numero),0),
      qtde_fat  = COALESCE((SELECT SUM(i.faturado) FROM pedido_itens i WHERE i.numero=pedidos.numero),0),
      situacao  = CASE WHEN COALESCE((SELECT SUM(i.faturado) FROM pedido_itens i WHERE i.numero=pedidos.numero),0)>0 THEN 'F' ELSE 'P' END,
      itens_ok  = CASE WHEN EXISTS(SELECT 1 FROM pedido_itens i WHERE i.numero=pedidos.numero) THEN 1 ELSE 0 END
    WHERE dt_emissao >= '${isoDtPed()}'`);
  const vazios = idb.prepare(`SELECT COUNT(*) c FROM pedidos WHERE itens_ok=0 AND dt_emissao >= '${isoDtPed()}'`).get().c;
  setSync('itens', { cursor: hoje(), detalhe: `${n} itens (Firebird); ${vazios} pedidos sem grade → REST sob demanda` });
  return n;
}

// ---- orquestração --------------------------------------------------------
let rodando = false;
export async function syncGeralFB() {
  if (!firebirdConfigurado()) return { erro: 'Firebird não configurado' };
  if (rodando) return { erro: 'sync Firebird já em execução' };
  rodando = true;
  const inicio = Date.now();
  const out = {};
  try {
    out.clientes = await syncClientesFB();
    out.pedidos = await syncPedidosFB();
    out.itens = await syncItensFB();
    out.produtos = await syncProdutosFB(); // depois dos itens (cores/tams reais)
    out.duracao_s = Math.round((Date.now() - inicio) / 1000);
    setSync('geral_fb', { cursor: hoje(), detalhe: JSON.stringify(out) });
    return out;
  } catch (e) {
    setSync('geral_fb', { status: 'erro', detalhe: e.message });
    throw e;
  } finally {
    rodando = false;
  }
}
