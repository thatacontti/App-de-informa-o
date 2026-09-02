// Motor de análise e recomendação da Inteligência de Compra.
// TODO número (quantidade, %, preço, score) sai de cálculo sobre os dados
// estruturados do banco analítico — nunca de um modelo de linguagem.
// Regra de quantidade: demanda de um item = qtde (pendente) + faturado
// (a EXCIA zera qtde ao faturar; cancelado é acompanhado à parte).
import { idb } from './intelDb.js';
import { produtosPlano, planoDisponivel } from './plano2027.js';

const FAIXAS = [
  { id: '00-50', min: 0, max: 50 }, { id: '50-70', min: 50, max: 70 },
  { id: '70-90', min: 70, max: 90 }, { id: '90-110', min: 90, max: 110 },
  { id: '110-130', min: 110, max: 130 }, { id: '130+', min: 130, max: Infinity },
];
const faixaDe = (p) => (FAIXAS.find((f) => p >= f.min && p < f.max) || FAIXAS[FAIXAS.length - 1]).id;

export const TIERS = ['Entrada', 'Médio', 'Premium'];

// Classificação Entrada/Médio/Premium RELATIVA AO SEGMENTO: dentro de
// (coleção, marca, tipo/grupo, grade/linha) o produto é comparado aos pares
// por preço (terços). Se o grupo é pequeno, sobe de nível (marca+grupo+linha →
// marca+grupo → marca). Reflete ano/coleção/marca/tipo/grade, como pedido.
const TIER_CUTS_MARCA = { // último recurso, quando não há pares suficientes
  KIKI: { entradaAte: 60, premiumDe: 78 },
  'MENINA ANJO': { entradaAte: 72, premiumDe: 100 },
  VALENT: { entradaAte: 71, premiumDe: 97 },
};
const TIER_DEFAULT = { entradaAte: 65, premiumDe: 90 };
const MIN_PARES = 6; // mínimo de produtos com preço para usar terços do grupo

const tierProdutoMap = (() => {
  let cache = null; let em = 0;
  return () => {
    if (cache && Date.now() - em < 10 * 60 * 1000) return cache;
    const prods = idb.prepare(
      `SELECT codigo, colecao, marca, grupo, linha, preco_tabela FROM produtos WHERE preco_tabela > 0`,
    ).all();
    // grupos em 3 níveis de granularidade
    const niveis = [
      (p) => `${p.colecao}|${p.marca}|${p.grupo}|${p.linha}`,
      (p) => `${p.marca}|${p.grupo}|${p.linha}`,
      (p) => `${p.marca}|${p.grupo}`,
    ];
    const grupos = niveis.map(() => new Map());
    for (const p of prods) niveis.forEach((k, i) => {
      const key = k(p);
      if (!grupos[i].has(key)) grupos[i].set(key, []);
      grupos[i].get(key).push(p.preco_tabela);
    });
    for (const g of grupos) for (const arr of g.values()) arr.sort((a, b) => a - b);
    const corte = (arr) => ({ e: arr[Math.floor(arr.length / 3)], p: arr[Math.floor((arr.length * 2) / 3)] });
    cache = new Map();
    for (const p of prods) {
      let cls = null;
      for (let i = 0; i < niveis.length && !cls; i++) {
        const arr = grupos[i].get(niveis[i](p));
        if (arr && arr.length >= MIN_PARES) {
          const c = corte(arr);
          cls = p.preco_tabela < c.e ? 'Entrada' : p.preco_tabela < c.p ? 'Médio' : 'Premium';
        }
      }
      if (!cls) { // sem pares: corte por marca
        const marcaNome = catDesc('marca', p.marca);
        const c = TIER_CUTS_MARCA[marcaNome] || TIER_DEFAULT;
        cls = p.preco_tabela < c.entradaAte ? 'Entrada' : p.preco_tabela < c.premiumDe ? 'Médio' : 'Premium';
      }
      cache.set(p.codigo, cls);
    }
    em = Date.now();
    return cache;
  };
})();

// Tier de um item de pedido: usa a classificação do produto; se o produto não
// está no catálogo atual, cai para o corte por marca sobre o preço pago.
function tierDeItem(codigo, marcaNome, preco) {
  const m = tierProdutoMap();
  if (m.has(codigo)) return m.get(codigo);
  if (!(preco > 0)) return null;
  const c = TIER_CUTS_MARCA[marcaNome] || TIER_DEFAULT;
  return preco < c.entradaAte ? 'Entrada' : preco < c.premiumDe ? 'Médio' : 'Premium';
}
function tierDeProduto(codigo) {
  return tierProdutoMap().get(codigo) || null;
}

// Coleções que NÃO contam como "coleção comprada" no perfil (avulso/atacado).
const COLECAO_IGNORAR = new Set(['', '00', '9', '09']);

// Perfil ÚNICO do cliente pela linha histórica: nº de coleções DISTINTAS já
// compradas (todo histórico). Tier mais alto vence na sobreposição das faixas.
export function perfilCliente(codcli) {
  const cols = idb.prepare(
    "SELECT DISTINCT colecao FROM pedidos WHERE codcli=? AND valor_liq>0",
  ).all(String(codcli)).map((r) => String(r.colecao || '').trim()).filter((c) => !COLECAO_IGNORAR.has(c));
  const n = new Set(cols).size;
  // Recência: comprou em alguma das coleções recentes? (p/ Novo vs Eventual)
  const ult = idb.prepare('SELECT MAX(dt_emissao) d FROM pedidos WHERE codcli=? AND valor_liq>0').get(String(codcli)).d;
  const recente = ult ? (Date.now() - new Date(ult)) < 400 * 86400000 : false;
  let tier, faixa;
  if (n >= 13) { tier = 'Vip'; faixa = '13+ coleções'; }
  else if (n >= 10) { tier = 'Vip 3+'; faixa = '10 a 12 coleções'; }
  else if (n >= 8) { tier = 'Frequente'; faixa = '8 a 9 coleções'; }
  else if (n >= 2) { tier = 'Regular'; faixa = '2 a 7 coleções'; }
  else if (n === 1) { tier = recente ? 'Novo' : 'Eventual'; faixa = '1 coleção'; }
  else { tier = 'Sem compras'; faixa = '—'; }
  return { tier, faixa, colecoes_compradas: n, recente };
}

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
// Temporada (Verão/Inverno) de cada coleção, a partir do catálogo de coleções.
const temporadaColecao = (() => {
  let cache = null;
  return (colecao) => {
    if (!cache) {
      cache = {};
      for (const r of idb.prepare("SELECT codigo, descricao FROM catalogos WHERE tipo='colecao'").all()) {
        const d = (r.descricao || '').toUpperCase();
        cache[String(r.codigo).trim()] = d.includes('INVERNO') ? 'Inverno'
          : (d.includes('VER') || d.includes('TROPICAL') || d.includes('PRIMAVERA')) ? 'Verão' : null;
      }
    }
    return cache[String(colecao || '').trim()] || null;
  };
})();
export function colecoesPorTemporada(temporada) {
  const rows = idb.prepare("SELECT codigo FROM catalogos WHERE tipo='colecao'").all();
  return new Set(rows.map((r) => String(r.codigo).trim()).filter((c) => temporadaColecao(c) === temporada));
}

// filtro opcional: { temporada:'Verão'|'Inverno' } ou { colecao:'41' }
function itensDoCliente(codcli, filtro = {}) {
  const rows = idb.prepare(`
    SELECT i.*, p.dt_emissao, p.colecao AS ped_colecao, p.pgto,
           pr.grupo, pr.linha, pr.familia, pr.marca, pr.colecao AS prod_colecao,
           pr.descricao AS prod_desc
    FROM pedido_itens i
    JOIN pedidos p ON p.numero = i.numero
    LEFT JOIN produtos pr ON pr.codigo = i.codigo
    WHERE p.codcli = ?
  `).all(String(codcli));
  if (filtro.colecao) return rows.filter((r) => String(r.ped_colecao).trim() === String(filtro.colecao).trim());
  if (filtro.temporada) return rows.filter((r) => temporadaColecao(r.ped_colecao) === filtro.temporada);
  return rows;
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
export function dnaCompra(codcli, filtro = {}) {
  const itens = itensDoCliente(codcli, filtro);
  if (!itens.length) return null;

  const acc = {
    grupo: {}, subgrupo: {}, marca: {}, linha: {}, familia: {},
    tam: {}, cor: {}, faixa: {}, tier: {}, mes: {}, colecaoPed: {},
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
    add('tier', tierDeItem(it.codigo, catDesc('marca', it.marca), Number(it.preco || 0)));
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
      // Entrada / Médio / Premium — a leitura que a empresa usa (Painel V27).
      tier: TIERS.map((t) => ({
        chave: t, qtd: Math.round(acc.tier[t] || 0),
        pct: round1(((acc.tier[t] || 0) / qtdTotal) * 100),
      })),
    },
    tier_dominante: TIERS.map((t) => ({ t, q: acc.tier[t] || 0 })).sort((a, b) => b.q - a.q)[0]?.t || null,
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
// DNA aberto POR MARCA — base do texto de perfil de compra.
// ---------------------------------------------------------------------------
export function dnaPorMarca(codcli, filtro = {}) {
  const itens = itensDoCliente(codcli, filtro);
  if (!itens.length) return [];
  const M = {};
  let qtdGeral = 0;
  for (const it of itens) {
    const q = Number(it.qtde || 0) + Number(it.faturado || 0);
    if (q <= 0) continue;
    qtdGeral += q;
    const m = catDesc('marca', it.marca);
    const g = (M[m] ??= { marca: m, q: 0, valor: 0, grupo: {}, linha: {}, tam: {}, cor: {}, tier: {}, estampa: 0 });
    g.q += q; g.valor += q * Number(it.preco || 0);
    const add = (dim, k) => { if (k) g[dim][k] = (g[dim][k] || 0) + q; };
    add('grupo', catDesc('grupo', it.grupo));
    add('linha', catDesc('linha', it.linha));
    add('tam', it.tam);
    add('cor', it.desc_cor || catDesc('cor', it.cor));
    add('tier', tierDeItem(it.codigo, m, Number(it.preco || 0)));
    if (it.estampa || it.desc_estampa) g.estampa += q;
  }
  // crescimento YoY por marca (peças 365d vs 365d anteriores)
  const yoy = {};
  for (const r of idb.prepare(`
    SELECT pr.marca,
      SUM(CASE WHEN p.dt_emissao >= date('now','-365 days') THEN (i.qtde+i.faturado) ELSE 0 END) q1,
      SUM(CASE WHEN p.dt_emissao <  date('now','-365 days') AND p.dt_emissao >= date('now','-730 days') THEN (i.qtde+i.faturado) ELSE 0 END) q0
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero LEFT JOIN produtos pr ON pr.codigo=i.codigo
    WHERE p.codcli=? GROUP BY pr.marca`).all(String(codcli))) {
    yoy[catDesc('marca', r.marca)] = r.q0 > 0 ? round1(((r.q1 - r.q0) / r.q0) * 100) : (r.q1 > 0 ? null : 0);
  }
  const topN = (obj, n, tot) => Object.entries(obj).map(([chave, v]) => ({ chave, qtd: Math.round(v), pct: round1((v / tot) * 100) }))
    .sort((a, b) => b.qtd - a.qtd).slice(0, n);
  return Object.values(M).map((g) => ({
    marca: g.marca,
    pecas: Math.round(g.q),
    pct_carteira: round1((g.q / qtdGeral) * 100),
    valor: Math.round(g.valor),
    ticket_peca: round1(g.valor / g.q),
    categorias: topN(g.grupo, 3, g.q),
    linhas: topN(g.linha, 3, g.q),
    tamanhos: topN(g.tam, 4, g.q),
    cores: topN(g.cor, 3, g.q),
    tiers: TIERS.map((t) => ({ chave: t, pct: round1(((g.tier[t] || 0) / g.q) * 100) })),
    tier_dominante: TIERS.map((t) => ({ t, q: g.tier[t] || 0 })).sort((a, b) => b.q - a.q)[0]?.t || null,
    pct_estampado: round1((g.estampa / g.q) * 100),
    crescimento_pct: yoy[g.marca] ?? null,
  })).sort((a, b) => b.pecas - a.pecas);
}

// Texto de perfil de compra (determinístico — números vêm dos dados; a IA não
// é fonte de cálculo). Retorna { resumo, por_marca:[{marca, texto}] }.
export function perfilTextual(codcli, filtro = {}) {
  const perfil = perfil360(codcli);
  const pc = perfilCliente(codcli);
  const marcas = dnaPorMarca(codcli, filtro);
  if (!perfil || !marcas.length) return null;
  const nome = (perfil.nome || '').split(' ').slice(0, 3).join(' ');
  const totalPecas = marcas.reduce((s, m) => s + m.pecas, 0);
  const marcaLider = marcas[0];
  const nomeTemp = filtro.temporada ? ` (recorte ${filtro.temporada})` : '';

  const resumo = `${nome} é um cliente <b>${pc.tier}</b> (${pc.faixa}), com <b>${perfil.qtd_pedidos} pedidos</b> e `
    + `<b>${totalPecas.toLocaleString('pt-BR')} peças</b> no histórico${nomeTemp}, ticket médio de R$ ${perfil.ticket_medio.toLocaleString('pt-BR')}. `
    + `Trabalha <b>${marcas.length} marca${marcas.length > 1 ? 's' : ''}</b>, liderada por <b>${marcaLider.marca}</b> (${marcaLider.pct_carteira}% do volume). `
    + (perfil.evolucao_12m_pct == null ? '' : `No último ano ${perfil.evolucao_12m_pct >= 0 ? 'cresceu' : 'recuou'} ${Math.abs(perfil.evolucao_12m_pct)}% em peças.`);

  const por_marca = marcas.map((m) => {
    const tierTxt = m.tiers.filter((t) => t.pct > 0).map((t) => `${t.chave} ${t.pct}%`).join(', ');
    const cat = m.categorias.map((c) => `${c.chave} (${c.pct}%)`).join(', ');
    const linhas = m.linhas.map((l) => l.chave).join('/');
    const tams = m.tamanhos.map((t) => t.chave).join(', ');
    const cresc = m.crescimento_pct == null ? 'sem base de comparação'
      : `${m.crescimento_pct >= 0 ? 'crescimento' : 'queda'} de ${Math.abs(m.crescimento_pct)}% vs o ano anterior`;
    const est = m.pct_estampado >= 55 ? 'forte preferência por estampados/decorados'
      : m.pct_estampado >= 30 ? 'mix de estampados e lisos' : 'predominância de peças lisas/básicas';
    const texto = `Em <b>${m.marca}</b> concentra <b>${m.pct_carteira}%</b> das peças `
      + `(${m.pecas.toLocaleString('pt-BR')} pç, ticket R$ ${m.ticket_peca}/peça). `
      + `Compra sobretudo <b>${cat || '—'}</b>${linhas ? `, nas linhas ${linhas}` : ''}. `
      + `Faixa de preço: ${tierTxt || '—'} — concentração em <b>${m.tier_dominante || '—'}</b>. `
      + `Tamanhos mais pedidos: ${tams || '—'}. ${est.charAt(0).toUpperCase() + est.slice(1)}. `
      + `Tendência: ${cresc}.`;
    return { marca: m.marca, pct: m.pct_carteira, texto };
  });

  return { resumo, por_marca };
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

export function recomendarColecao(codcli, colecao, { topPorTipo = 15, filtro = {} } = {}) {
  // DNA no MESMO recorte de temporada usado na análise (de-para consistente).
  const dna = dnaCompra(codcli, filtro);
  if (!dna) return { erro: 'sem histórico de itens sincronizado para este cliente neste recorte' };

  const produtos = idb.prepare(
    `SELECT * FROM produtos WHERE colecao=? AND ativo='S'`,
  ).all(String(colecao));
  if (!produtos.length) return { erro: `nenhum produto ativo na coleção ${colecao}` };

  const afGrupo = normalizaShares(dna.participacao.grupo.map((s) => ({ ...s })));
  const afMarca = normalizaShares(dna.participacao.marca);
  const afLinha = normalizaShares(dna.participacao.linha);
  const afFamilia = normalizaShares(dna.participacao.familia);
  const afTam = new Map(dna.distribuicao.tamanho.map((t) => [t.chave, t.pct / 100]));
  const afCor = new Map(dna.distribuicao.cor.map((c) => [c.chave.toUpperCase(), c.pct / 100]));
  // Participação do cliente por tier (Entrada/Médio/Premium) — normalizada.
  const afTier = normalizaShares(dna.distribuicao.tier);
  const tierShare = Object.fromEntries(dna.distribuicao.tier.map((t) => [t.chave, t.pct]));
  const tierDominante = dna.tier_dominante;
  // Tier menos explorado (candidato a "desafio" — ampliar faixa de participação).
  const tierDesafio = [...dna.distribuicao.tier].sort((a, b) => a.pct - b.pct)[0]?.chave || null;

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
    ? { grupo: 0.20, marca: 0.15, linha: 0.10, familia: 0.05, tier: 0.15, cor: 0.10, tam: 0.10, pop: 0.15 }
    : { grupo: 0.28, marca: 0.22, linha: 0.14, familia: 0.06, tier: 0.18, cor: 0.00, tam: 0.12, pop: 0.00 };

  const avaliados = produtos.map((pr) => {
    const cores = JSON.parse(pr.cores || '[]');
    const tams = JSON.parse(pr.tams || '[]');
    const tier = tierDeProduto(pr.codigo);
    const comp = {
      grupo: afGrupo[catDesc('grupo', pr.grupo)] || 0,
      marca: afMarca[catDesc('marca', pr.marca)] || 0,
      linha: afLinha[catDesc('linha', pr.linha)] || 0,
      familia: pr.familia ? (afFamilia[catDesc('familia', pr.familia)] || 0) : 0,
      tier: tier ? (afTier[tier] || 0) : 0,
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
    return { pr, comp, tier, score: Math.max(0, Math.min(Math.round(score * 100), 100)) };
  });

  const popVals = avaliados.map((a) => a.comp.pop).sort((a, b) => a - b);
  const popP75 = popVals[Math.floor(popVals.length * 0.75)] || 0;

  // Três papéis (de-para histórico → coleção nova):
  // ALTO_GIRO  = já é o forte do cliente (marca+categoria+tier dominante) → estoque de giro.
  // TARGET     = o que o perfil/semelhantes compram e ele ainda não → alvo de conquista.
  // DESAFIO    = tier/faixa pouco explorada pelo cliente → ampliar a participação.
  const papelDe = (a) => {
    const histCore = a.comp.grupo >= 0.45 && a.comp.marca >= 0.5;
    const noTierDominante = a.tier && a.tier === tierDominante;
    if (histCore && noTierDominante && a.score >= 55) return 'ALTO_GIRO';
    if (temAdocao && a.comp.pop >= Math.max(popP75, 0.15) && a.comp.marca >= 0.4 && !jaComprou.has(a.pr.codigo)) return 'TARGET';
    if (a.tier && a.tier === tierDesafio && a.comp.marca >= 0.4 && a.score >= 38) return 'DESAFIO';
    // sobra dos que têm bom fit mas não se encaixaram: reforço de giro/target
    if (histCore && a.score >= 50) return 'ALTO_GIRO';
    if (a.score >= 45 && !jaComprou.has(a.pr.codigo)) return 'DESAFIO';
    return null;
  };

  const grupos = { ALTO_GIRO: [], TARGET: [], DESAFIO: [] };
  for (const a of avaliados) {
    const t = papelDe(a);
    if (t) grupos[t].push(a);
  }
  const ctx = { adSim, adocao, similares: simSet.size, cliColecao, tierDominante, tierDesafio, tierShare };
  for (const t of Object.keys(grupos)) {
    grupos[t] = grupos[t].sort((a, b) => b.score - a.score).slice(0, topPorTipo)
      .map((a) => montarRecomendacao(a, dna, { ...ctx, papel: t }));
  }

  const resumo = {
    colecao, desc_colecao: catDesc('colecao', colecao),
    produtos_na_colecao: produtos.length,
    clientes_com_historico_na_colecao: cliColecao,
    clientes_semelhantes_considerados: simSet.size,
    tier_dominante: tierDominante, tier_desafio: tierDesafio,
    total_recomendado: grupos.ALTO_GIRO.length + grupos.TARGET.length + grupos.DESAFIO.length,
  };
  const financeiro = {};
  for (const t of Object.keys(grupos)) {
    financeiro[t] = Math.round(grupos[t].reduce((s, r) => s + r.grade.valor_estimado, 0));
  }
  financeiro.total = Object.values(financeiro).reduce((s, v) => s + v, 0);

  return { resumo, recomendacoes: grupos, financeiro, dna_resumo: { pecas: dna.pecas_total, cobertura: dna.cobertura } };
}

// ---------------------------------------------------------------------------
// Crescimento por tipo de produto (grupo) — cliente, ano vs ano anterior.
// Peças nos últimos 365 dias vs os 365 anteriores, por grupo/tipo. (A curva
// ABC/giro é sempre construída dos dados reais de venda, não do plano.)
// ---------------------------------------------------------------------------
export function crescimentoPorGrupo(codcli) {
  const rows = idb.prepare(`
    SELECT pr.grupo,
      SUM(CASE WHEN p.dt_emissao >= date('now','-365 days') THEN (i.qtde+i.faturado) ELSE 0 END) q1,
      SUM(CASE WHEN p.dt_emissao <  date('now','-365 days') AND p.dt_emissao >= date('now','-730 days') THEN (i.qtde+i.faturado) ELSE 0 END) q0
    FROM pedido_itens i JOIN pedidos p ON p.numero=i.numero
    LEFT JOIN produtos pr ON pr.codigo=i.codigo
    WHERE p.codcli=? GROUP BY pr.grupo`).all(String(codcli));
  const out = {};
  for (const r of rows) {
    const nome = catDesc('grupo', r.grupo);
    out[nome] = {
      atual: Math.round(r.q1 || 0), anterior: Math.round(r.q0 || 0),
      pct: r.q0 > 0 ? round1(((r.q1 - r.q0) / r.q0) * 100) : (r.q1 > 0 ? null : 0),
    };
  }
  return out;
}

// Tamanhos individuais que compõem uma grade do plano (ex.: '6/8/10/12').
const sizesDaGrade = (g) => String(g || '').split('/').map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Recomendação a partir do PLANO curado (Inverno 27 / Tropical 27).
// Usa a faixa OFICIAL da empresa, família, estética (aviamentos), volume
// planejado e imagens do painel — de-para para o histórico real do cliente.
// ---------------------------------------------------------------------------
export function recomendarPlano(codcli, col, { topPorPapel = 40, filtro = {} } = {}) {
  if (!planoDisponivel()) return { erro: 'plano da coleção 2027 não instalado' };
  const dna = dnaCompra(codcli, filtro);
  if (!dna) return { erro: 'sem histórico de itens para este cliente neste recorte' };
  const produtos = produtosPlano(col);
  if (!produtos.length) return { erro: `sem produtos no plano ${col}` };

  // Chaves normalizadas (sem acento/caixa) para o de-para casar mesmo com
  // pequenas diferenças de grafia entre o plano e o catálogo do EXCIA.
  const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const sharesNorm = (lista) => {
    const max = Math.max(0, ...lista.map((s) => s.pct || 0));
    const m = {};
    for (const s of lista) m[chave(s.chave)] = max ? Math.min((s.pct || 0) / max, 1) : 0;
    return m;
  };
  const afMarca = sharesNorm(dna.participacao.marca);
  const afGrupo = sharesNorm(dna.participacao.grupo);
  const afFamilia = sharesNorm(dna.participacao.familia);
  const afTier = normalizaShares(dna.distribuicao.tier);
  const tierShare = Object.fromEntries(dna.distribuicao.tier.map((t) => [t.chave, t.pct]));
  const tierDominante = dna.tier_dominante;
  const tierDesafio = [...dna.distribuicao.tier].sort((a, b) => a.pct - b.pct)[0]?.chave || null;
  const tamShare = new Map(dna.distribuicao.tamanho.map((t) => [t.chave, t.pct / 100]));
  const estampado = dna.pct_estampado >= 30; // cliente gosta de estampa/decoração
  const cresc = crescimentoPorGrupo(codcli);

  // Normaliza faixa oficial do plano para casar com as chaves do cliente.
  const normFaixa = (f) => {
    const s = (f || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    return s.startsWith('ENTR') ? 'Entrada' : s.startsWith('PREM') ? 'Premium' : 'Médio';
  };
  const temDecor = (itens) => (itens || []).some((x) => /estampa|bordado|paet|perola|p.rola|strass|renda|laise|tule|pedraria/i.test(x));

  const avaliados = produtos.map((pr) => {
    const faixa = normFaixa(pr.faixa);
    const sizes = sizesDaGrade(pr.tam);
    const comp = {
      marca: afMarca[chave(pr.m)] || 0,
      grupo: afGrupo[chave(pr.grupo)] || 0,
      familia: pr.fam ? (afFamilia[chave(pr.fam)] || 0) : 0,
      tier: afTier[faixa] || 0,
      tam: sizes.length ? Math.min(sizes.reduce((s, t) => s + (tamShare.get(t) || 0), 0) * 1.5, 1) : 0,
      estetica: (estampado && temDecor(pr.itens)) ? 1 : (!estampado && !temDecor(pr.itens)) ? 0.6 : 0.2,
    };
    const PESOS = { marca: 0.22, grupo: 0.24, familia: 0.08, tier: 0.20, tam: 0.16, estetica: 0.10 };
    let score = 0; for (const [k, w] of Object.entries(PESOS)) score += Math.min(comp[k], 1) * w;
    return { pr, faixa, comp, score: Math.max(0, Math.min(Math.round(score * 100), 100)) };
  });

  const papelDe = (a) => {
    const core = a.comp.marca >= 0.5 && a.comp.grupo >= 0.4;
    if (core && a.faixa === tierDominante && a.score >= 55) return 'ALTO_GIRO';
    if (a.comp.grupo >= 0.4 && a.faixa === tierDesafio && a.score >= 40) return 'DESAFIO';
    if (a.comp.marca >= 0.45 && a.score >= 48) return 'TARGET';
    if (core && a.score >= 50) return 'ALTO_GIRO';
    if (a.score >= 42) return 'DESAFIO';
    return null;
  };

  const grupos = { ALTO_GIRO: [], TARGET: [], DESAFIO: [] };
  for (const a of avaliados) { const t = papelDe(a); if (t) grupos[t].push(a); }
  const crescN = {}; for (const [k, v] of Object.entries(cresc)) crescN[chave(k)] = v;
  const fmt = (a, papel) => montarRecPlano(a, dna, { tierShare, tierDominante, tierDesafio, papel, cresc: crescN, chave });
  for (const t of Object.keys(grupos)) {
    grupos[t] = grupos[t].sort((x, y) => y.score - x.score).slice(0, topPorPapel).map((a) => fmt(a, t));
  }

  const financeiro = {};
  for (const t of Object.keys(grupos)) financeiro[t] = Math.round(grupos[t].reduce((s, r) => s + r.grade.valor_estimado, 0));
  financeiro.total = Object.values(financeiro).reduce((s, v) => s + v, 0);

  return {
    fonte: 'plano2027',
    resumo: {
      colecao: `PLANO:${col}`, desc_colecao: col === 'INVERNO' ? 'Inverno 2027' : 'Tropical 2027',
      produtos_no_plano: produtos.length,
      tier_dominante: tierDominante, tier_desafio: tierDesafio,
      total_recomendado: grupos.ALTO_GIRO.length + grupos.TARGET.length + grupos.DESAFIO.length,
    },
    crescimento_por_tipo: cresc,
    recomendacoes: grupos, financeiro,
    dna_resumo: { pecas: dna.pecas_total, cobertura: dna.cobertura },
  };
}

function montarRecPlano(a, dna, ctx) {
  const { pr, faixa } = a;
  const sizes = sizesDaGrade(pr.tam);
  // Grade sugerida: peças típicas por produto do cliente, distribuídas pela
  // participação histórica de tamanhos (restrita à grade do produto).
  const porSku = Math.min(Math.max(dna.qtd_tipica_por_produto || sizes.length, sizes.length || 1), (sizes.length || 1) * 3);
  const pesos = sizes.map((t) => {
    const h = dna.distribuicao.tamanho.find((x) => x.chave === t);
    return { tam: t, peso: h ? h.pct : 0 };
  });
  const somaP = pesos.reduce((s, p) => s + p.peso, 0) || sizes.length;
  if (pesos.every((p) => p.peso === 0)) pesos.forEach((p) => { p.peso = 1; });
  const somaF = pesos.reduce((s, p) => s + p.peso, 0);
  let grade = pesos.map((p) => ({ tam: p.tam, pct: round1((p.peso / somaF) * 100), qtd: Math.round((p.peso / somaF) * porSku) }));
  let soma = grade.reduce((s, g) => s + g.qtd, 0); let i = 0;
  while (soma !== porSku && grade.length) {
    const g = grade[i % grade.length];
    if (soma < porSku) { g.qtd++; soma++; } else if (g.qtd > 0) { g.qtd--; soma--; } else { i++; continue; }
    i++;
  }
  grade = grade.filter((g) => g.qtd > 0);
  const qtdTotal = grade.reduce((s, g) => s + g.qtd, 0);
  const preco = Number(pr.atac || pr.pm || 0);
  const cg = ctx.cresc[ctx.chave(pr.grupo)];

  return {
    codigo: pr.cod, descricao: pr.desc || pr.tp, marca: pr.m, grupo: pr.grupo, tipo: pr.tp,
    familia: pr.fam, tecido: pr.tec || null, itens: pr.itens || [],
    grade_nome: pr.tam, vol_planejado: pr.vol || null,
    preco_tabela: preco, preco_varejo: Number(pr.varejo || 0),
    tier: faixa, papel: ctx.papel, score: a.score,
    crescimento_tipo: cg ? { pct: cg.pct, atual: cg.atual, anterior: cg.anterior } : null,
    justificativa: justificarPlano(a, dna, ctx, cg),
    grade: { qtd_total: qtdTotal, por_tamanho: grade, valor_estimado: Math.round(qtdTotal * preco * 100) / 100 },
    tem_imagem_plano: true,
  };
}

function justificarPlano(a, dna, ctx, cg) {
  const { pr, faixa, comp } = a;
  const partes = [];
  const shareN = (lista, val) => lista.find((s) => ctx.chave(s.chave) === ctx.chave(val))?.pct;
  if (comp.marca >= 0.5) { const sm = shareN(dna.participacao.marca, pr.m); if (sm) partes.push(`marca ${pr.m} = ${sm}% do histórico`); }
  if (comp.grupo >= 0.5) { const sg = shareN(dna.participacao.grupo, pr.grupo); if (sg) partes.push(`${pr.grupo} representa ${sg}% das peças`); }
  if (ctx.papel === 'DESAFIO' && faixa === ctx.tierDesafio) partes.push(`faixa ${faixa} pouco explorada (${ctx.tierShare?.[faixa] ?? 0}%) — ampliar participação`);
  else if (ctx.tierShare?.[faixa] != null) partes.push(`faixa ${faixa}, onde concentra ${ctx.tierShare[faixa]}%`);
  if (comp.tam >= 0.5) partes.push(`grade ${pr.tam} nos tamanhos que mais compra`);
  if (comp.estetica >= 1) partes.push('estética (estampa/bordado) alinhada ao histórico');
  if (cg && cg.pct != null) partes.push(`${pr.grupo} ${cg.pct >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(cg.pct)}% vs ano anterior`);
  if (!partes.length) partes.push('aderência distribuída — sem fator dominante');
  return partes.join('; ') + '.';
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
    tier: a.tier,             // Entrada / Médio / Premium (relativo ao segmento)
    papel: ctx.papel,         // ALTO_GIRO / TARGET / DESAFIO
    faixa_preco: `R$ ${faixaDe(preco)}`,
    cores: JSON.parse(pr.cores || '[]').map((c) => catDesc('cor', c)),
    score: a.score,
    componentes: Object.fromEntries(Object.entries(a.comp).map(([k, v]) => [k, round1(v * 100)])),
    justificativa: justificar(a, dna, ctx),
    grade: {
      qtd_total: qtdTotal,      // volume sugerido por referência
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
  // Tier (Entrada/Médio/Premium) — a leitura central pedida.
  if (a.tier) {
    const st = ctx.tierShare?.[a.tier];
    if (ctx.papel === 'DESAFIO' && a.tier === ctx.tierDesafio) {
      partes.push(`faixa ${a.tier} é pouco explorada pelo cliente (${st ?? 0}% do volume) — ampliar participação`);
    } else if (st != null) {
      partes.push(`faixa ${a.tier}, onde o cliente concentra ${st}% das peças`);
    }
  }
  if (comp.tam >= 0.5) partes.push('grade cobre os tamanhos que o cliente mais pede');
  if (comp.cor >= 0.4) partes.push('cartela de cores alinhada às cores mais compradas');
  const adSimVal = ctx.adSim.get(pr.codigo);
  if (adSimVal >= 0.2 && ctx.similares) {
    partes.push(`${Math.round(adSimVal * ctx.similares)} de ${ctx.similares} clientes semelhantes já pediram este produto`);
  } else if ((ctx.adocao.get(pr.codigo) || 0) >= 0.2 && ctx.cliColecao) {
    partes.push(`${Math.round((ctx.adocao.get(pr.codigo) || 0) * 100)}% dos clientes da coleção já pediram`);
  }
  if (!partes.length) partes.push('aderência distribuída entre categoria, faixa e grade — sem fator dominante');
  return partes.join('; ') + '.';
}

// ---------------------------------------------------------------------------
// Perfil estético (camada semântica leve, sem números inventados)
// ---------------------------------------------------------------------------
export function perfilEstetico(codcli, filtro = {}) {
  const dna = dnaCompra(codcli, filtro);
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
