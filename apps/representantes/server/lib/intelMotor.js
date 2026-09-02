// Motor de análise e recomendação da Inteligência de Compra.
// TODO número (quantidade, %, preço, score) sai de cálculo sobre os dados
// estruturados do banco analítico — nunca de um modelo de linguagem.
// Regra de quantidade: demanda de um item = qtde (pendente) + faturado
// (a EXCIA zera qtde ao faturar; cancelado é acompanhado à parte).
import { idb } from './intelDb.js';

const FAIXAS = [
  { id: '00-50', min: 0, max: 50 }, { id: '50-70', min: 50, max: 70 },
  { id: '70-90', min: 70, max: 90 }, { id: '90-110', min: 90, max: 110 },
  { id: '110-130', min: 110, max: 130 }, { id: '130+', min: 130, max: Infinity },
];
const faixaDe = (p) => (FAIXAS.find((f) => p >= f.min && p < f.max) || FAIXAS[FAIXAS.length - 1]).id;

const catDesc = (() => {
  let cache = null;
  return (tipo, codigo) => {
    if (!cache) {
      cache = {};
      for (const r of idb.prepare('SELECT tipo, codigo, descricao FROM catalogos').all()) {
        cache[`${r.tipo}:${r.codigo}`] = r.descricao;
      }
    }
    return cache[`${tipo}:${String(codigo || '').trim()}`] || String(codigo || '').trim() || '—';
  };
})();
export function limparCacheCatalogos() { /* recarrega catálogo na próxima consulta */ }

const round1 = (v) => Math.round(v * 10) / 10;
const mediana = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentil = (sorted, v) => {
  if (!sorted.length) return 0.5;
  let n = 0;
  for (const x of sorted) if (x <= v) n++;
  return n / sorted.length;
};

// ---------------------------------------------------------------------------
// Base de itens do cliente (join itens × produtos)
// ---------------------------------------------------------------------------
function itensDoCliente(codcli) {
  return idb.prepare(`
    SELECT i.*, p.dt_emissao, p.colecao AS ped_colecao, p.pgto,
           pr.grupo, pr.linha, pr.familia, pr.marca, pr.colecao AS prod_colecao,
           pr.descricao AS prod_desc
    FROM pedido_itens i
    JOIN pedidos p ON p.numero = i.numero
    LEFT JOIN produtos pr ON pr.codigo = i.codigo
    WHERE p.codcli = ?
  `).all(String(codcli));
}

const share = (mapa, total) => Object.entries(mapa)
  .map(([k, v]) => ({ chave: k, qtd: Math.round(v), pct: total ? round1((v / total) * 100) : 0 }))
  .sort((a, b) => b.qtd - a.qtd);

// ---------------------------------------------------------------------------
// Perfil 360°
// ---------------------------------------------------------------------------
export function perfil360(codcli) {
  const cli = idb.prepare('SELECT * FROM clientes_ex WHERE codcli=?').get(String(codcli));
  const peds = idb.prepare(
    'SELECT * FROM pedidos WHERE codcli=? ORDER BY dt_emissao',
  ).all(String(codcli));
  if (!cli && !peds.length) return null;

  // Valor comprado = pedidos com valor (inclui pendentes; a EXCIA só fatura
  // depois, e a sugestão de compra olha o comportamento, não só o já faturado).
  const comprados = peds.filter((p) => p.valor_liq > 0);
  const fat = peds.filter((p) => p.situacao === 'F' && p.valor_liq > 0);
  const valorHist = comprados.reduce((s, p) => s + p.valor_liq, 0);
  const ticket = comprados.length ? valorHist / comprados.length : 0;
  const ultimo = peds.length ? peds[peds.length - 1] : null;

  // Frequência: dias medianos entre DATAS DISTINTAS de pedido (um pedido pode
  // vir fatiado em vários números na mesma data).
  const datas = [...new Set(peds.map((p) => p.dt_emissao).filter(Boolean))].sort();
  let freqDias = null;
  if (datas.length >= 2) {
    const difs = [];
    for (let i = 1; i < datas.length; i++) {
      difs.push((new Date(datas[i]) - new Date(datas[i - 1])) / 86400000);
    }
    freqDias = Math.round(mediana(difs));
  }

  // Evolução: últimos 12 meses vs 12 anteriores em PEÇAS (robusto a lacunas de
  // preço — coleções novas entram sem preço, o que zeraria a evolução em R$).
  const agora = Date.now();
  const pecasPorJanela = idb.prepare(`
    SELECT
      SUM(CASE WHEN p.dt_emissao >= date('now','-365 days') THEN (i.qtde+i.faturado) ELSE 0 END) q12,
      SUM(CASE WHEN p.dt_emissao <  date('now','-365 days') AND p.dt_emissao >= date('now','-730 days') THEN (i.qtde+i.faturado) ELSE 0 END) q24
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero WHERE p.codcli=?`).get(String(codcli));
  const q12 = pecasPorJanela?.q12 || 0;
  const q24 = pecasPorJanela?.q24 || 0;
  const evolucaoPct = q24 > 0 ? round1(((q12 - q24) / q24) * 100) : null;
  // Valor 12m/24m (comprado) — informativo, pode subestimar em coleção nova.
  const v12 = comprados.filter((p) => agora - new Date(p.dt_emissao) < 365 * 86400000)
    .reduce((s, p) => s + p.valor_liq, 0);
  const v24 = comprados.filter((p) => {
    const d = agora - new Date(p.dt_emissao);
    return d >= 365 * 86400000 && d < 730 * 86400000;
  }).reduce((s, p) => s + p.valor_liq, 0);

  // Condição de pagamento predominante (moda do campo pgto dos pedidos).
  const modaPgto = {};
  for (const p of peds) if (p.pgto) modaPgto[p.pgto] = (modaPgto[p.pgto] || 0) + 1;
  const condicao = Object.entries(modaPgto).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Representante: moda do codrep dos pedidos (fallback: cadastro).
  const modaRep = {};
  for (const p of peds) if (p.codrep) modaRep[p.codrep] = (modaRep[p.codrep] || 0) + 1;
  const codrepPed = Object.entries(modaRep).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const nomeRep = peds.find((p) => p.codrep === codrepPed)?.nome_rep
    || (cli ? (JSON.parse(cli.codrep || '[]')[0] || '—') : '—');

  const dataCad = cli?.data_cad || null;
  const anosRel = dataCad ? round1((agora - new Date(dataCad)) / (365.25 * 86400000)) : null;

  // Série mensal (24m) para o gráfico de evolução.
  const porMes = {};
  for (const p of comprados) {
    const mes = (p.dt_emissao || '').slice(0, 7);
    if (mes) porMes[mes] = (porMes[mes] || 0) + p.valor_liq;
  }
  const serieMensal = Object.entries(porMes).sort().slice(-24)
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor) }));

  return {
    codcli: String(codcli),
    nome: cli?.nome || peds[0]?.nome || '—',
    fantasia: cli?.fantasia || '',
    cidade: cli?.cidade || '', uf: cli?.uf || '',
    representante: { codrep: codrepPed, nome: nomeRep },
    data_cadastro: dataCad,
    anos_relacionamento: anosRel,
    qtd_pedidos: peds.length,
    qtd_pedidos_faturados: fat.length,
    valor_historico: Math.round(valorHist),
    ticket_medio: Math.round(ticket),
    ultimo_pedido: ultimo ? { numero: ultimo.numero, data: ultimo.dt_emissao, valor: Math.round(ultimo.valor_liq) } : null,
    frequencia_media_dias: freqDias,
    evolucao_12m_pct: evolucaoPct,
    evolucao_base: 'pecas',
    pecas_12m: Math.round(q12), pecas_12m_anterior: Math.round(q24),
    valor_12m: Math.round(v12), valor_12m_anterior: Math.round(v24),
    condicao_predominante: condicao,
    serie_mensal: serieMensal,
  };
}

// ---------------------------------------------------------------------------
// DNA de compra (itens × produtos)
// ---------------------------------------------------------------------------
export function dnaCompra(codcli) {
  const itens = itensDoCliente(codcli);
  if (!itens.length) return null;

  const acc = {
    grupo: {}, subgrupo: {}, marca: {}, linha: {}, familia: {},
    tam: {}, cor: {}, faixa: {}, mes: {}, colecaoPed: {},
  };
  let qtdTotal = 0, valorTotal = 0, comEstampa = 0;
  const porPedido = {}, porProduto = {}, porPedProd = {}, produtosSet = new Set();

  for (const it of itens) {
    const q = Number(it.qtde || 0) + Number(it.faturado || 0);
    if (q <= 0) continue;
    qtdTotal += q;
    valorTotal += q * Number(it.preco || 0);
    const add = (dim, chave) => { if (chave) acc[dim][chave] = (acc[dim][chave] || 0) + q; };
    add('grupo', catDesc('grupo', it.grupo));
    add('marca', catDesc('marca', it.marca));
    add('linha', catDesc('linha', it.linha));
    add('familia', it.familia ? catDesc('familia', it.familia) : '');
    add('tam', it.tam);
    add('cor', it.desc_cor || catDesc('cor', it.cor));
    add('faixa', faixaDe(Number(it.preco || 0)));
    add('mes', (it.dt_emissao || '').slice(5, 7));
    add('colecaoPed', it.ped_colecao);
    if (it.estampa || it.desc_estampa) comEstampa += q;
    porPedido[it.numero] = (porPedido[it.numero] || 0) + q;
    porProduto[it.codigo] = (porProduto[it.codigo] || 0) + q * Number(it.preco || 0);
    porPedProd[`${it.numero}|${it.codigo}`] = (porPedProd[`${it.numero}|${it.codigo}`] || 0) + q;
    produtosSet.add(it.codigo);
  }
  if (!qtdTotal) return null;

  const qtdsPed = Object.values(porPedido);
  const sazonal = share(acc.mes, qtdTotal);
  const verao = sazonal.filter((m) => ['10', '11', '12', '01', '02'].includes(m.chave))
    .reduce((s, m) => s + m.pct, 0);

  return {
    cobertura: {
      pedidos_com_itens: Object.keys(porPedido).length,
      pedidos_total: idb.prepare('SELECT COUNT(*) c FROM pedidos WHERE codcli=?').get(String(codcli)).c,
    },
    pecas_total: Math.round(qtdTotal),
    valor_total_itens: Math.round(valorTotal),
    produtos_distintos: produtosSet.size,
    participacao: {
      categoria: share(acc.grupo, qtdTotal),
      grupo: share(acc.grupo, qtdTotal),
      subgrupo: [], // nesta instância EXCIA o produto não referencia subgrupo
      marca: share(acc.marca, qtdTotal),
      linha: share(acc.linha, qtdTotal),
      familia: share(acc.familia, qtdTotal),
    },
    distribuicao: {
      tamanho: share(acc.tam, qtdTotal),
      cor: share(acc.cor, qtdTotal).slice(0, 15),
      faixa_preco: FAIXAS.map((f) => ({
        chave: `R$ ${f.id}`, qtd: Math.round(acc.faixa[f.id] || 0),
        pct: round1(((acc.faixa[f.id] || 0) / qtdTotal) * 100),
      })),
    },
    qtd_media_por_pedido: round1(qtdTotal / (qtdsPed.length || 1)),
    // Mediana de peças por produto dentro de um pedido — base da grade sugerida.
    qtd_tipica_por_produto: Math.max(Math.round(mediana(Object.values(porPedProd))), 1),
    ticket_medio_produto: round1(valorTotal / qtdTotal),
    sazonalidade: { por_mes: sazonal, pct_alto_verao: round1(verao) },
    pct_estampado: round1((comEstampa / qtdTotal) * 100),
    recencia_dias: (() => {
      const ult = idb.prepare('SELECT MAX(dt_emissao) d FROM pedidos WHERE codcli=?').get(String(codcli)).d;
      return ult ? Math.round((Date.now() - new Date(ult)) / 86400000) : null;
    })(),
  };
}

// ---------------------------------------------------------------------------
// Estatísticas populacionais (para clusters por percentil) — cabeçalhos
// ---------------------------------------------------------------------------
let popCache = null;
function popStats() {
  if (popCache && Date.now() - popCache.em < 10 * 60 * 1000) return popCache;
  const rows = idb.prepare(`
    SELECT codcli, COUNT(*) n, SUM(valor_liq) valor, SUM(qtde_fat) pecas,
      MIN(dt_emissao) primeiro, MAX(dt_emissao) ultimo,
      AVG(valor_liq) ticket
    FROM pedidos WHERE valor_liq > 0 GROUP BY codcli
  `).all();
  const anoMs = 365 * 86400000;
  const porCli = new Map(rows.map((r) => [r.codcli, r]));
  popCache = {
    em: Date.now(),
    porCli,
    valor: rows.map((r) => r.valor).sort((a, b) => a - b),
    pecas: rows.map((r) => r.pecas).sort((a, b) => a - b),
    ticket: rows.map((r) => r.ticket).sort((a, b) => a - b),
    freqAno: rows.map((r) => {
      const anos = Math.max((new Date(r.ultimo) - new Date(r.primeiro)) / anoMs, 1);
      return r.n / anos;
    }).sort((a, b) => a - b),
  };
  return popCache;
}

const nivel = (p, nomes) => nomes[Math.min(Math.floor(p * nomes.length), nomes.length - 1)];

// ---------------------------------------------------------------------------
// Multiclusterização — classificações independentes
// ---------------------------------------------------------------------------
export function clusters(codcli, perfil, dna) {
  const pop = popStats();
  const meu = pop.porCli.get(String(codcli));
  const cl = [];
  const põe = (dim, valor, base) => cl.push({ dimensao: dim, cluster: valor, base });

  if (perfil.anos_relacionamento !== null) {
    const a = perfil.anos_relacionamento;
    põe('Tempo de relacionamento',
      a < 1 ? 'Novo' : a < 3 ? 'Em consolidação' : a < 7 ? 'Estabelecido' : 'Veterano',
      `${a} anos de cadastro`);
  }
  if (meu) {
    põe('Valor do cliente', nivel(percentil(pop.valor, meu.valor), ['Bronze', 'Prata', 'Ouro', 'Diamante']),
      `R$ ${Math.round(meu.valor).toLocaleString('pt-BR')} · percentil ${Math.round(percentil(pop.valor, meu.valor) * 100)}`);
    const anos = Math.max((new Date(meu.ultimo) - new Date(meu.primeiro)) / (365 * 86400000), 1);
    põe('Frequência', nivel(percentil(pop.freqAno, meu.n / anos), ['Esporádico', 'Ocasional', 'Frequente', 'Intensivo']),
      `${round1(meu.n / anos)} pedidos/ano`);
    põe('Volume', nivel(percentil(pop.pecas, meu.pecas), ['Volume baixo', 'Volume médio', 'Volume alto', 'Volume muito alto']),
      `${Math.round(meu.pecas).toLocaleString('pt-BR')} peças faturadas`);
    põe('Ticket', nivel(percentil(pop.ticket, meu.ticket), ['Ticket baixo', 'Ticket médio', 'Ticket alto', 'Ticket premium']),
      `R$ ${Math.round(meu.ticket).toLocaleString('pt-BR')} por pedido`);
  }
  if (perfil.frequencia_media_dias !== null && perfil.qtd_pedidos >= 3) {
    const f = perfil.frequencia_media_dias;
    põe('Comportamento de compra',
      f <= 45 ? 'Comprador contínuo' : f <= 120 ? 'Ritmo de coleção' : 'Comprador sazonal',
      `compra a cada ~${f} dias`);
  }
  if (dna) {
    const top = (lista) => lista[0] || null;
    const cat = top(dna.participacao.categoria);
    if (cat) põe('Categoria predominante', cat.chave, `${cat.pct}% das peças`);
    const mk = top(dna.participacao.marca);
    if (mk) põe('Marca', mk.pct >= 60 ? `Fiel ${mk.chave}` : mk.pct >= 35 ? `Prefere ${mk.chave}` : 'Multimarca', `${mk.chave} = ${mk.pct}%`);
    const fx = [...dna.distribuicao.faixa_preco].sort((a, b) => b.pct - a.pct)[0];
    if (fx) põe('Faixa de preço', fx.chave, `${fx.pct}% das peças`);
    const ln = top(dna.participacao.linha);
    const tams = dna.distribuicao.tamanho.slice(0, 3).map((t) => t.chave).join('/');
    if (ln) põe('Grade de tamanhos', `${ln.chave} · ${tams}`, `linha ${ln.pct}%`);
    põe('Estética', dna.pct_estampado >= 55 ? 'Estampado' : dna.pct_estampado >= 30 ? 'Misto' : 'Liso/básico',
      `${dna.pct_estampado}% das peças com estampa`);
    põe('Sazonalidade', dna.sazonalidade.pct_alto_verao >= 60 ? 'Concentrado no verão'
      : dna.sazonalidade.pct_alto_verao <= 35 ? 'Ano inteiro' : 'Levemente sazonal',
      `${dna.sazonalidade.pct_alto_verao}% out-fev`);
  }
  if (perfil.evolucao_12m_pct !== null) {
    const e = perfil.evolucao_12m_pct;
    põe('Crescimento', e < -15 ? 'Em queda' : e < 10 ? 'Estável' : e < 50 ? 'Crescendo' : 'Acelerando',
      `${e >= 0 ? '+' : ''}${e}% vs 12m anteriores`);
  }
  if (meu) {
    const p = percentil(pop.valor, meu.valor);
    const alvo = pop.valor[Math.floor(pop.valor.length * 0.75)] || 0;
    põe('Potencial', p >= 0.75 ? 'Potencial atingido' : p >= 0.4 ? 'Espaço moderado' : 'Alto potencial',
      p >= 0.75 ? 'já está no topo da base' : `gap de R$ ${Math.round(Math.max(alvo - meu.valor, 0)).toLocaleString('pt-BR')} até o P75`);
  }
  if (dna) {
    // Propensão a novidades: % de peças compradas na coleção corrente do pedido
    // (produto lançado na mesma coleção em que foi pedido).
    const novosNaColecao = idb.prepare(`
      SELECT COALESCE(SUM(i.qtde + i.faturado),0) q
      FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
      JOIN produtos pr ON pr.codigo=i.codigo
      WHERE p.codcli=? AND pr.colecao = p.colecao
    `).get(String(codcli)).q;
    const pct = dna.pecas_total ? round1((novosNaColecao / dna.pecas_total) * 100) : 0;
    põe('Propensão a novidades', pct >= 70 ? 'Early adopter' : pct >= 40 ? 'Aberto a novidades' : 'Conservador',
      `${pct}% das peças na coleção de lançamento`);
  }
  return cl;
}

// ---------------------------------------------------------------------------
// Similaridade entre clientes (vetor de participação marca+grupo+linha+faixa)
// ---------------------------------------------------------------------------
function vetorCliente(codcli) {
  const rows = idb.prepare(`
    SELECT pr.marca, pr.grupo, pr.linha, i.preco, SUM(i.qtde + i.faturado) q
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
    LEFT JOIN produtos pr ON pr.codigo=i.codigo
    WHERE p.codcli=? GROUP BY pr.marca, pr.grupo, pr.linha, i.preco
  `).all(String(codcli));
  const v = {};
  let tot = 0;
  for (const r of rows) {
    const q = r.q || 0;
    tot += q;
    for (const chave of [`m:${r.marca}`, `g:${r.grupo}`, `l:${r.linha}`, `f:${faixaDe(r.preco || 0)}`]) {
      v[chave] = (v[chave] || 0) + q;
    }
  }
  if (!tot) return null;
  for (const k of Object.keys(v)) v[k] /= tot;
  return v;
}

function cosseno(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const k of Object.keys(a)) { na += a[k] ** 2; if (b[k]) dot += a[k] * b[k]; }
  for (const k of Object.keys(b)) nb += b[k] ** 2;
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function clientesSemelhantes(codcli, topK = 20) {
  const meu = vetorCliente(codcli);
  if (!meu) return [];
  const outros = idb.prepare(`
    SELECT DISTINCT p.codcli FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
    WHERE p.codcli <> ?
  `).all(String(codcli));
  const sims = [];
  for (const { codcli: outro } of outros) {
    const v = vetorCliente(outro);
    if (v) sims.push({ codcli: outro, sim: cosseno(meu, v) });
  }
  return sims.sort((a, b) => b.sim - a.sim).slice(0, topK);
}

// ---------------------------------------------------------------------------
// Recomendação para a coleção nova
// ---------------------------------------------------------------------------
// Normaliza participações para 0..1 dividindo pelo MAIOR pct (a lista pode não
// estar ordenada por pct — ex.: faixa de preço vem em ordem de faixa).
const normalizaShares = (lista) => {
  const max = Math.max(0, ...lista.map((s) => s.pct || 0));
  const m = {};
  for (const s of lista) m[s.chave] = max ? Math.min((s.pct || 0) / max, 1) : 0;
  return m;
};

export function recomendarColecao(codcli, colecao, { topPorTipo = 15 } = {}) {
  const dna = dnaCompra(codcli);
  if (!dna) return { erro: 'sem histórico de itens sincronizado para este cliente' };

  const produtos = idb.prepare(
    `SELECT * FROM produtos WHERE colecao=? AND ativo='S'`,
  ).all(String(colecao));
  if (!produtos.length) return { erro: `nenhum produto ativo na coleção ${colecao}` };

  const afGrupo = normalizaShares(dna.participacao.grupo.map((s) => ({ ...s })));
  const afMarca = normalizaShares(dna.participacao.marca);
  const afLinha = normalizaShares(dna.participacao.linha);
  const afFamilia = normalizaShares(dna.participacao.familia);
  const afFaixa = normalizaShares(dna.distribuicao.faixa_preco.map((f) => ({ chave: f.chave.replace('R$ ', ''), pct: f.pct })));
  const afTam = new Map(dna.distribuicao.tamanho.map((t) => [t.chave, t.pct / 100]));
  const afCor = new Map(dna.distribuicao.cor.map((c) => [c.chave.toUpperCase(), c.pct / 100]));

  // Popularidade na coleção: adoção entre clientes com itens sincronizados.
  const adocao = new Map();
  const adRows = idb.prepare(`
    SELECT i.codigo, COUNT(DISTINCT p.codcli) cli
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
    JOIN produtos pr ON pr.codigo=i.codigo
    WHERE pr.colecao=? GROUP BY i.codigo
  `).all(String(colecao));
  const cliColecao = idb.prepare(`
    SELECT COUNT(DISTINCT p.codcli) c
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
    JOIN produtos pr ON pr.codigo=i.codigo WHERE pr.colecao=?
  `).get(String(colecao)).c || 0;
  for (const r of adRows) adocao.set(r.codigo, cliColecao ? r.cli / cliColecao : 0);

  // Adoção entre clientes SEMELHANTES (quando houver itens deles no cache).
  const similares = clientesSemelhantes(codcli, 20);
  const simSet = new Set(similares.map((s) => s.codcli));
  const adSim = new Map();
  if (simSet.size) {
    const marks = [...simSet].map(() => '?').join(',');
    const rows = idb.prepare(`
      SELECT i.codigo, COUNT(DISTINCT p.codcli) cli
      FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
      JOIN produtos pr ON pr.codigo=i.codigo
      WHERE pr.colecao=? AND p.codcli IN (${marks}) GROUP BY i.codigo
    `).all(String(colecao), ...simSet);
    for (const r of rows) adSim.set(r.codigo, r.cli / simSet.size);
  }

  const jaComprou = new Set(idb.prepare(`
    SELECT DISTINCT i.codigo FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero WHERE p.codcli=?
  `).all(String(codcli)).map((r) => r.codigo));

  // Se a coleção ainda não tem adoção (lançamento — ninguém pediu), o peso de
  // popularidade e o de cor (produtos novos sem histórico de cor) são
  // redistribuídos entre os fatores de fit histórico, senão o score teria teto
  // artificialmente baixo e nada chegaria a "Essencial".
  const temAdocao = cliColecao > 0 || simSet.size > 0;
  const PESOS = temAdocao
    ? { grupo: 0.20, marca: 0.15, linha: 0.10, familia: 0.05, preco: 0.15, cor: 0.10, tam: 0.10, pop: 0.15 }
    : { grupo: 0.28, marca: 0.22, linha: 0.14, familia: 0.06, preco: 0.18, cor: 0.00, tam: 0.12, pop: 0.00 };

  const avaliados = produtos.map((pr) => {
    const cores = JSON.parse(pr.cores || '[]');
    const tams = JSON.parse(pr.tams || '[]');
    const comp = {
      grupo: afGrupo[catDesc('grupo', pr.grupo)] || 0,
      marca: afMarca[catDesc('marca', pr.marca)] || 0,
      linha: afLinha[catDesc('linha', pr.linha)] || 0,
      familia: pr.familia ? (afFamilia[catDesc('familia', pr.familia)] || 0) : 0,
      preco: afFaixa[faixaDe(pr.preco_tabela || 0)] || 0,
      cor: cores.length
        ? Math.min(cores.reduce((s, c) => s + (afCor.get(catDesc('cor', c).toUpperCase()) || 0), 0) * 3, 1)
        : 0,
      tam: tams.length
        ? Math.min(tams.reduce((s, t) => s + (afTam.get(t) || 0), 0) * 1.5, 1)
        : 0,
      pop: adSim.get(pr.codigo) ?? adocao.get(pr.codigo) ?? 0,
    };
    let score = 0;
    for (const [k, w] of Object.entries(PESOS)) score += Math.min(comp[k], 1) * w;
    return { pr, comp, score: Math.max(0, Math.min(Math.round(score * 100), 100)) };
  });

  const popVals = avaliados.map((a) => a.comp.pop).sort((a, b) => a - b);
  const popP75 = popVals[Math.floor(popVals.length * 0.75)] || 0;

  const tipoDe = (a) => {
    const histCore = a.comp.grupo >= 0.5 && a.comp.marca >= 0.5;
    // OPORTUNIDADE: forte entre semelhantes/na coleção, fora do núcleo histórico.
    if (temAdocao && a.comp.pop >= Math.max(popP75, 0.15) && a.comp.grupo < 0.35 && !jaComprou.has(a.pr.codigo)) return 'OPORTUNIDADE';
    if (a.score >= 65 && histCore) return 'ESSENCIAL';
    if (a.score >= 38) return 'EXPANSAO';
    return null;
  };

  const grupos = { ESSENCIAL: [], EXPANSAO: [], OPORTUNIDADE: [] };
  for (const a of avaliados) {
    const t = tipoDe(a);
    if (t) grupos[t].push(a);
  }
  for (const t of Object.keys(grupos)) {
    grupos[t] = grupos[t].sort((a, b) => b.score - a.score).slice(0, topPorTipo)
      .map((a) => montarRecomendacao(a, dna, { adSim, adocao, similares: simSet.size, cliColecao }));
  }

  const resumo = {
    colecao, desc_colecao: catDesc('colecao', colecao),
    produtos_na_colecao: produtos.length,
    clientes_com_historico_na_colecao: cliColecao,
    clientes_semelhantes_considerados: simSet.size,
    total_recomendado: grupos.ESSENCIAL.length + grupos.EXPANSAO.length + grupos.OPORTUNIDADE.length,
  };
  const financeiro = {};
  for (const t of Object.keys(grupos)) {
    financeiro[t] = Math.round(grupos[t].reduce((s, r) => s + r.grade.valor_estimado, 0));
  }
  financeiro.total = Object.values(financeiro).reduce((s, v) => s + v, 0);

  return { resumo, recomendacoes: grupos, financeiro, dna_resumo: { pecas: dna.pecas_total, cobertura: dna.cobertura } };
}

// Grade sugerida — números 100% derivados do histórico estruturado.
function montarRecomendacao(a, dna, ctx) {
  const { pr } = a;
  const tams = JSON.parse(pr.tams || '[]');

  // Quantidade total: mediana histórica de peças por produto dentro de um
  // pedido do cliente, com piso 1 peça por tamanho e teto 3× a grade.
  const base = dna.qtd_tipica_por_produto || tams.length;
  const porSku = Math.min(Math.max(base, tams.length || 1), (tams.length || 1) * 3);

  // Distribuição por tamanho: participação histórica do cliente restrita à grade.
  const pesos = tams.map((t) => {
    const h = dna.distribuicao.tamanho.find((x) => x.chave === t);
    return { tam: t, peso: h ? h.pct : 0 };
  });
  const somaPesos = pesos.reduce((s, p) => s + p.peso, 0);
  if (somaPesos === 0) pesos.forEach((p) => { p.peso = 1; }); // sem histórico: grade uniforme
  const somaFinal = pesos.reduce((s, p) => s + p.peso, 0);

  let grade = pesos.map((p) => ({
    tam: p.tam,
    pct: round1((p.peso / somaFinal) * 100),
    qtd: Math.round((p.peso / somaFinal) * porSku),
  }));
  // Ajuste de arredondamento p/ fechar o total.
  let soma = grade.reduce((s, g) => s + g.qtd, 0);
  let i = 0;
  while (soma !== porSku && grade.length) {
    const g = grade[i % grade.length];
    if (soma < porSku) { g.qtd++; soma++; } else if (g.qtd > 0) { g.qtd--; soma--; } else { i++; continue; }
    i++;
  }
  grade = grade.filter((g) => g.qtd > 0);
  const qtdTotal = grade.reduce((s, g) => s + g.qtd, 0);
  const preco = Number(pr.preco_tabela || 0);

  return {
    codigo: pr.codigo,
    descricao: pr.descricao,
    marca: catDesc('marca', pr.marca),
    grupo: catDesc('grupo', pr.grupo),
    linha: catDesc('linha', pr.linha),
    familia: pr.familia ? catDesc('familia', pr.familia) : null,
    preco_tabela: preco,
    faixa_preco: `R$ ${faixaDe(preco)}`,
    cores: JSON.parse(pr.cores || '[]').map((c) => catDesc('cor', c)),
    score: a.score,
    componentes: Object.fromEntries(Object.entries(a.comp).map(([k, v]) => [k, round1(v * 100)])),
    justificativa: justificar(a, dna, ctx),
    grade: {
      qtd_total: qtdTotal,
      por_tamanho: grade,
      valor_estimado: Math.round(qtdTotal * preco * 100) / 100,
    },
  };
}

// Justificativa determinística: cita apenas números calculados acima.
function justificar(a, dna, ctx) {
  const { pr, comp } = a;
  const partes = [];
  const g = catDesc('grupo', pr.grupo), m = catDesc('marca', pr.marca), l = catDesc('linha', pr.linha);
  const shareDe = (lista, chave) => lista.find((s) => s.chave === chave)?.pct;

  const sg = shareDe(dna.participacao.grupo, g);
  if (comp.grupo >= 0.5 && sg) partes.push(`${g} representa ${sg}% do histórico do cliente`);
  const sm = shareDe(dna.participacao.marca, m);
  if (comp.marca >= 0.5 && sm) partes.push(`a marca ${m} soma ${sm}% das peças compradas`);
  const sl = shareDe(dna.participacao.linha, l);
  if (comp.linha >= 0.5 && sl) partes.push(`linha ${l} = ${sl}% do volume`);
  if (comp.preco >= 0.6) partes.push(`preço de tabela dentro da faixa preferida (${`R$ ${faixaDe(pr.preco_tabela || 0)}`})`);
  if (comp.tam >= 0.5) partes.push('grade cobre os tamanhos que o cliente mais pede');
  if (comp.cor >= 0.4) partes.push('cartela de cores alinhada às cores mais compradas');
  const adSimVal = ctx.adSim.get(pr.codigo);
  if (adSimVal >= 0.2 && ctx.similares) {
    partes.push(`${Math.round(adSimVal * ctx.similares)} de ${ctx.similares} clientes semelhantes já pediram este produto`);
  } else if ((ctx.adocao.get(pr.codigo) || 0) >= 0.2 && ctx.cliColecao) {
    partes.push(`${Math.round((ctx.adocao.get(pr.codigo) || 0) * 100)}% dos clientes da coleção já pediram`);
  }
  if (!partes.length) partes.push('aderência distribuída entre categoria, preço e grade — sem fator dominante');
  return partes.join('; ') + '.';
}

// ---------------------------------------------------------------------------
// Perfil estético (camada semântica leve, sem números inventados)
// ---------------------------------------------------------------------------
export function perfilEstetico(codcli) {
  const dna = dnaCompra(codcli);
  if (!dna) return null;
  const tags = [];
  tags.push(dna.pct_estampado >= 55 ? 'Estampado' : dna.pct_estampado >= 30 ? 'Misto estampa/liso' : 'Liso e básico');
  const cores = dna.distribuicao.cor.slice(0, 5).map((c) => c.chave);
  if (cores.length) tags.push(`Paleta: ${cores.join(', ')}`);
  const tipos = dna.participacao.categoria.slice(0, 3).map((c) => `${c.chave} (${c.pct}%)`);
  if (tipos.length) tags.push(`Silhuetas: ${tipos.join(' · ')}`);
  const fx = [...dna.distribuicao.faixa_preco].sort((a, b) => b.pct - a.pct)[0];
  if (fx) tags.push(`Posicionamento ${fx.chave === 'R$ 130+' ? 'premium' : fx.chave === 'R$ 00-50' ? 'entrada' : 'intermediário'}`);
  return { tags, pct_estampado: dna.pct_estampado, cores_top: cores };
}
