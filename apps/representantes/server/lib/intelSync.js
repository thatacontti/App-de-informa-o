// Sincronização EXCIA -> banco analítico (cache local; evita chamadas repetidas).
// Estratégia:
// - Catálogos e produtos: carga completa na 1ª execução, incremental por ?data=.
// - Clientes: EntidadeLista completa na 1ª execução, incremental por ?data=.
// - Pedidos: PedidoLista a partir de EXCIA_DT_PED (padrão 01/01/2024 — janelas
//   maiores estouram o sort do Firebird do ERP); incremental por ?alteracao=.
// - Itens de pedido: SOB DEMANDA por cliente (BuscarPedido?numero=), com marca
//   itens_ok no cabeçalho — 1 chamada por pedido, uma única vez.
import { idb, getSync, setSync } from './intelDb.js';
import { exciaGet, ExciaError, dataExciaParaISO, isoParaDataExcia, exciaConfigurado } from './exciaClient.js';
import { firebirdConfigurado } from './firebirdClient.js';
import { syncGeralFB } from './firebirdSync.js';

// Fonte da carga em massa: 'firebird' (SQL direto, rápido) ou 'rest' (API
// paginada). Catálogos vêm sempre do REST (pequenos). Padrão: firebird quando
// configurado, senão rest.
const SOURCE = (process.env.INTEL_SOURCE
  || (firebirdConfigurado() ? 'firebird' : 'rest')).toLowerCase();

// Paginação com RETOMADA: o progresso (última página gravada) fica em
// sync_state("<chave>:pag"); se a EXCIA cair no meio (timeout em página
// profunda é comum no Firebird), a próxima tentativa continua de onde parou.
async function syncPaginado(chave, path, params, gravar) {
  const prog = getSync(`${chave}:pag`);
  let pagina = prog?.cursor ? Number(prog.cursor) + 1 : 1;
  let total = 0;
  for (; ; pagina++) {
    let regs;
    try {
      regs = await exciaGet(path, { ...params, pagina });
    } catch (e) {
      if (e instanceof ExciaError && e.status === 400
        && (pagina > 1 || /nenhum registro/i.test(e.message))) break; // fim documentado
      throw e;
    }
    if (!Array.isArray(regs) || regs.length === 0) break;
    gravar(regs);
    total += regs.length;
    setSync(`${chave}:pag`, { cursor: String(pagina), detalhe: `${total} registros nesta rodada` });
    if (regs.length < 300) break; // página incompleta = última
  }
  // Concluiu: zera o progresso de página para a próxima carga começar do 1.
  idb.prepare('DELETE FROM sync_state WHERE chave=?').run(`${chave}:pag`);
  return total;
}

const DT_PED_INI = process.env.EXCIA_DT_PED || '01/01/2024';
// EntidadeLista/ProdutoLista exigem o parâmetro `data` (doc: obrigatório).
// Na carga completa usamos uma data antiga o suficiente para trazer tudo.
const DT_CADASTROS_INI = process.env.EXCIA_DT_CAD || '01/01/2000';

// Cursor incremental: volta 2 dias para cobrir registros alterados no limite.
function cursorMenosDias(iso, dias = 2) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}
const hojeISO = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Catálogos (Grupo/SubGrupo/Marca/Linha/Família/Cor/Coleção/Condição/Tamanho)
// ---------------------------------------------------------------------------
const CATALOGOS = [
  { tipo: 'grupo', path: 'GrupoLista', params: { tipo: 'P' }, cod: 'codigo' },
  { tipo: 'subgrupo', path: 'SubGrupoLista', params: {}, cod: 'codigo' },
  { tipo: 'marca', path: 'MarcaLista', params: {}, cod: 'codigo' },
  { tipo: 'linha', path: 'LinhaLista', params: {}, cod: 'codigo' },
  { tipo: 'familia', path: 'FamiliaLista', params: {}, cod: 'codigo' },
  { tipo: 'cor', path: 'CorLista', params: {}, cod: 'cor' },
  { tipo: 'colecao', path: 'ColecaoLista', params: {}, cod: 'codigo' },
  { tipo: 'condicao', path: 'CondicaoLista', params: {}, cod: 'codigo' },
  { tipo: 'tamanho', path: 'Tamanho', params: {}, cod: 'tam' },
];

const upCat = idb.prepare(`INSERT INTO catalogos (tipo, codigo, descricao, raw)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(tipo, codigo) DO UPDATE SET descricao=excluded.descricao, raw=excluded.raw`);

export async function syncCatalogos() {
  for (const c of CATALOGOS) {
    try {
      const n = await syncPaginado(`catalogo:${c.tipo}`, c.path, c.params, (regs) => {
        const tx = idb.transaction(() => {
          for (const r of regs) {
            const codigo = String(r[c.cod] ?? r.codigo ?? '').trim();
            if (!codigo) continue;
            upCat.run(c.tipo, codigo, String(r.descricao ?? '').trim(), JSON.stringify(r));
          }
        });
        tx();
      });
      setSync(`catalogo:${c.tipo}`, { cursor: hojeISO(), detalhe: `${n} registros` });
    } catch (e) {
      setSync(`catalogo:${c.tipo}`, { status: 'erro', detalhe: e.message });
    }
  }
}

// ---------------------------------------------------------------------------
// Clientes (EntidadeLista)
// ---------------------------------------------------------------------------
const upCli = idb.prepare(`INSERT INTO clientes_ex
  (codcli, nome, fantasia, cnpj, cidade, uf, data_cad, condicao, sit_cli, ativo, codrep, dt_altera, raw)
  VALUES (@codcli, @nome, @fantasia, @cnpj, @cidade, @uf, @data_cad, @condicao, @sit_cli, @ativo, @codrep, @dt_altera, @raw)
  ON CONFLICT(codcli) DO UPDATE SET nome=@nome, fantasia=@fantasia, cnpj=@cnpj,
    cidade=@cidade, uf=@uf, data_cad=@data_cad, condicao=@condicao, sit_cli=@sit_cli,
    ativo=@ativo, codrep=@codrep, dt_altera=@dt_altera, raw=@raw`);

function gravarClientes(regs) {
  const tx = idb.transaction(() => {
    for (const r of regs) {
      if (!r.codcli) continue;
      upCli.run({
        codcli: String(r.codcli).trim(),
        nome: r.nome || '', fantasia: r.fantasia || '', cnpj: r.cnpj || '',
        cidade: r.nome_cid || '', uf: r.cod_est || '',
        data_cad: dataExciaParaISO(r.data_cad),
        condicao: String(r.condicao || '').trim(),
        sit_cli: r.sit_cli || '', ativo: r.ativo || '',
        codrep: JSON.stringify(r.codrep || []),
        dt_altera: dataExciaParaISO(r.dt_altera),
        raw: JSON.stringify(r),
      });
    }
  });
  tx();
}

export async function syncClientes() {
  const st = getSync('clientes');
  const incremental = Boolean(st?.cursor);
  const params = {
    data: incremental ? isoParaDataExcia(cursorMenosDias(st.cursor)) : DT_CADASTROS_INI,
    tipo_entidade: 'C',
  };
  const n = await syncPaginado('clientes', 'EntidadeLista', params, gravarClientes);
  setSync('clientes', { cursor: hojeISO(), detalhe: `${n} registros (${incremental ? 'incremental' : 'completa'})` });
  return n;
}

// ---------------------------------------------------------------------------
// Produtos (ProdutoLista)
// ---------------------------------------------------------------------------
const upProd = idb.prepare(`INSERT INTO produtos
  (codigo, descricao, grupo, linha, familia, marca, colecao, etiqueta, unidade,
   preco_tabela, data_cad, ativo, status, cores, tams, dt_altera, raw)
  VALUES (@codigo, @descricao, @grupo, @linha, @familia, @marca, @colecao, @etiqueta, @unidade,
   @preco_tabela, @data_cad, @ativo, @status, @cores, @tams, @dt_altera, @raw)
  ON CONFLICT(codigo) DO UPDATE SET descricao=@descricao, grupo=@grupo, linha=@linha,
    familia=@familia, marca=@marca, colecao=@colecao, etiqueta=@etiqueta, unidade=@unidade,
    preco_tabela=@preco_tabela, data_cad=@data_cad, ativo=@ativo, status=@status,
    cores=@cores, tams=@tams, dt_altera=@dt_altera, raw=@raw`);

function gravarProdutos(regs) {
  const tx = idb.transaction(() => {
    for (const r of regs) {
      if (!r.codigo) continue;
      // custo NÃO é persistido em campo próprio nem exposto; fica só no raw.
      upProd.run({
        codigo: String(r.codigo).trim(),
        descricao: r.descricao || '', grupo: String(r.grupo || '').trim(),
        linha: String(r.linha || '').trim(), familia: String(r.familia || '').trim(),
        marca: String(r.marca || '').trim(), colecao: String(r.colecao || '').trim(),
        etiqueta: String(r.etiqueta || '').trim(), unidade: r.unidade || '',
        preco_tabela: Number(r.preco_tabela || 0),
        data_cad: dataExciaParaISO(r.data_cad), ativo: r.ativo || '', status: r.status || '',
        cores: JSON.stringify(r.cor || []), tams: JSON.stringify(r.tam || []),
        dt_altera: dataExciaParaISO(r.dt_altera),
        raw: JSON.stringify(r),
      });
    }
  });
  tx();
}

export async function syncProdutos() {
  const st = getSync('produtos');
  const incremental = Boolean(st?.cursor);
  const params = { data: incremental ? isoParaDataExcia(cursorMenosDias(st.cursor)) : DT_CADASTROS_INI };
  const n = await syncPaginado('produtos', 'ProdutoLista', params, gravarProdutos);
  setSync('produtos', { cursor: hojeISO(), detalhe: `${n} registros (${incremental ? 'incremental' : 'completa'})` });
  return n;
}

// ---------------------------------------------------------------------------
// Pedidos (cabeçalhos — PedidoLista)
// ---------------------------------------------------------------------------
const upPed = idb.prepare(`INSERT INTO pedidos
  (numero, codcli, codrep, nome_rep, dt_emissao, colecao, pgto, valor_liq, qtde_fat, cancelado, situacao, dt_altera)
  VALUES (@numero, @codcli, @codrep, @nome_rep, @dt_emissao, @colecao, @pgto, @valor_liq, @qtde_fat, @cancelado, @situacao, @dt_altera)
  ON CONFLICT(numero) DO UPDATE SET codcli=@codcli, codrep=@codrep, nome_rep=@nome_rep,
    dt_emissao=@dt_emissao, colecao=@colecao, pgto=@pgto, valor_liq=@valor_liq,
    qtde_fat=@qtde_fat, cancelado=@cancelado, situacao=@situacao, dt_altera=@dt_altera,
    itens_ok=CASE WHEN pedidos.dt_altera IS NOT @dt_altera THEN 0 ELSE pedidos.itens_ok END`);

function gravarPedidos(regs) {
  const tx = idb.transaction(() => {
    for (const r of regs) {
      if (!r.numero) continue;
      upPed.run({
        numero: String(r.numero).trim(),
        codcli: String(r.codcli || '').trim(),
        codrep: String(r.codrep || '').trim(),
        nome_rep: r.nome_rep || '',
        dt_emissao: dataExciaParaISO(r.dt_emissao),
        colecao: String(r.colecao || '').trim(),
        pgto: String(r.pgto || '').trim(),
        valor_liq: Number(r.valor_total_liq || 0),
        qtde_fat: Number(r.faturado || 0),
        cancelado: Number(r.cancelado || 0),
        situacao: Number(r.faturado || 0) > 0 ? 'F' : 'P',
        dt_altera: r.dt_altera || null,
      });
    }
  });
  tx();
}

export async function syncPedidos() {
  const st = getSync('pedidos');
  const params = st?.cursor
    ? { alteracao: isoParaDataExcia(cursorMenosDias(st.cursor)) }
    : { dt_emissao_ini: DT_PED_INI };
  const n = await syncPaginado('pedidos', 'PedidoLista', params, gravarPedidos);
  setSync('pedidos', { cursor: hojeISO(), detalhe: `${n} registros (${params.alteracao ? 'incremental' : `completa desde ${DT_PED_INI}`})` });
  return n;
}

// ---------------------------------------------------------------------------
// Itens de pedido — sob demanda por cliente (1 chamada por pedido, uma vez)
// ---------------------------------------------------------------------------
const delItens = idb.prepare('DELETE FROM pedido_itens WHERE numero=?');
const insItem = idb.prepare(`INSERT OR REPLACE INTO pedido_itens
  (numero, ordem, codigo, cor, desc_cor, tam, preco, qtde, faturado, cancelado, estampa, desc_estampa)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
// Marca itens_ok e recalcula valor/qtde/situação do cabeçalho a partir dos
// itens recém-inseridos (mantém coerência com a carga Firebird).
const markOk = idb.prepare(`UPDATE pedidos SET itens_ok=1,
    valor_liq = COALESCE((SELECT SUM((i.qtde+i.faturado)*i.preco) FROM pedido_itens i WHERE i.numero=pedidos.numero),0),
    qtde_fat  = COALESCE((SELECT SUM(i.faturado) FROM pedido_itens i WHERE i.numero=pedidos.numero),0),
    situacao  = CASE WHEN COALESCE((SELECT SUM(i.faturado) FROM pedido_itens i WHERE i.numero=pedidos.numero),0)>0 THEN 'F' ELSE 'P' END
  WHERE numero=?`);

export async function syncItensDoCliente(codcli, { limite = 200 } = {}) {
  const pendentes = idb.prepare(
    'SELECT numero FROM pedidos WHERE codcli=? AND itens_ok=0 ORDER BY dt_emissao DESC LIMIT ?',
  ).all(String(codcli), limite);

  let ok = 0;
  for (const { numero } of pendentes) {
    const regs = await exciaGet('BuscarPedido', { numero });
    const ped = Array.isArray(regs) ? regs[0] : null;
    const itens = ped?.itens || [];
    const tx = idb.transaction(() => {
      delItens.run(numero);
      for (const it of itens) {
        insItem.run(
          numero, Number(it.ordem || 0), String(it.codigo || '').trim(),
          String(it.cor || '').trim(), it.desc_cor || '', String(it.tam || '').trim(),
          Number(it.preco || 0), Number(it.qtde || 0),
          Number(it.faturado || 0), Number(it.cancelado || 0),
          String(it.estampa || '').trim(), it.desc_estampa || '',
        );
      }
      markOk.run(numero);
    });
    tx();
    ok++;
  }
  return { pedidos: pendentes.length, sincronizados: ok };
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------
let rodando = false;

export async function syncGeral() {
  if (rodando) return { erro: 'sync já em execução' };
  rodando = true;
  const inicio = Date.now();
  const resultado = { fonte: SOURCE };
  try {
    // Catálogos: sempre do REST (leves e estáveis). Se o REST estiver
    // indisponível, seguimos com o que já houver em cache.
    if (exciaConfigurado()) {
      try { await syncCatalogos(); } catch (e) { resultado.catalogos_erro = e.message; }
    }

    if (SOURCE === 'firebird') {
      Object.assign(resultado, await syncGeralFB());
    } else {
      if (!exciaConfigurado()) throw new Error('EXCIA REST não configurado');
      resultado.clientes = await syncClientes();
      resultado.produtos = await syncProdutos();
      resultado.pedidos = await syncPedidos();
    }
    resultado.duracao_s = Math.round((Date.now() - inicio) / 1000);
    setSync('geral', { cursor: hojeISO(), detalhe: JSON.stringify(resultado) });
    return resultado;
  } catch (e) {
    setSync('geral', { status: 'erro', detalhe: e.message });
    throw e;
  } finally {
    rodando = false;
  }
}

export function statusSync() {
  return idb.prepare('SELECT chave, cursor, executado_em, status, detalhe FROM sync_state ORDER BY chave').all();
}

// Agendamento em processo: sync geral 1x/dia (04:15) + na subida se banco vazio.
export function agendarSync() {
  if (!exciaConfigurado()) {
    console.log('[intel] EXCIA não configurado — sync desativado');
    return;
  }
  const temDados = idb.prepare('SELECT COUNT(*) c FROM pedidos').get().c > 0;
  if (!temDados) {
    console.log('[intel] banco analítico vazio — sync inicial em background...');
    // Carga inicial com re-tentativas: a retomada por página garante que cada
    // tentativa avança de onde a anterior parou.
    (async () => {
      for (let t = 1; t <= 8; t++) {
        try {
          const r = await syncGeral();
          console.log('[intel] sync inicial ok:', JSON.stringify(r));
          return;
        } catch (e) {
          console.error(`[intel] sync inicial falhou (tentativa ${t}/8): ${e.message} — retomando em 30s`);
          await new Promise((res) => setTimeout(res, 30000));
        }
      }
      console.error('[intel] sync inicial esgotou as tentativas — use POST /api/intel/sync');
    })();
  }
  setInterval(() => {
    const h = new Date();
    if (h.getHours() === 4 && h.getMinutes() < 30) {
      syncGeral().catch((e) => console.error('[intel] sync diário falhou:', e.message));
    }
  }, 25 * 60 * 1000);
}
