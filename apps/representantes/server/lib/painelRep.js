// Painel V27 por representante (M1).
// Gera, a partir das fontes do painel estratégico (data/painel_v27/), o mesmo
// painel recortado por NOME_REP: D já vem filtrado do servidor (segregação),
// com benchmark nacional, assertividade (piso 400 peças) e mapa de ataque
// Marca → Coordenado → SKU com foto/cobertura/gap.
//
// Golden Rules herdadas da base d_v12.json (já aplicadas na geração dela):
// SSS só perfil Moda, coleções 40/41 (V27) vs 36/37 (V26), sem SACOLAS,
// datas normalizadas e corte no mesmo dia de temporada. Aqui NUNCA se roda
// replace de vírgula/ponto em string que contenha base64 — números são
// formatados ANTES de concatenar HTML com imagens.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Fonte app-local (vai no build Docker); fallback para a pasta do monorepo em dev.
const CANDIDATE_DIRS = [
  path.join(__dirname, '..', '..', 'data', 'painel_v27'),
  path.join(__dirname, '..', '..', '..', '..', 'painel_v27'),
];

const MARCAS = ['KIKI', 'MENINA ANJO', 'VALENT'];
const PISO_ASSERTIVIDADE = 400; // pç nacionais mínimas p/ um SKU contar como "campeão"
const CACHE_MAX = 8; // painéis por rep mantidos em memória (LRU simples)

// ---------------------------------------------------------------------------
// Carga preguiçosa das fontes (uma vez por processo)
// ---------------------------------------------------------------------------
let SRC = null;

function srcDir() {
  for (const d of CANDIDATE_DIRS) {
    if (fs.existsSync(path.join(d, 'd_v12.json'))) return d;
  }
  return null;
}

export function painelDisponivel() {
  return srcDir() !== null;
}

function load() {
  if (SRC) return SRC;
  const dir = srcDir();
  if (!dir) throw new Error('fontes do painel_v27 não encontradas');
  const rd = (f) => fs.readFileSync(path.join(dir, f), 'utf-8');
  const d = JSON.parse(rd('d_v12.json'));
  SRC = {
    d,
    recs: d.recs,
    img: JSON.parse(rd('sku_final.json')),
    v26m: JSON.parse(rd('v26_por_marca.json')),
    cidPerfil: JSON.parse(rd('cidade_perfil.json')),
    template: rd('template.html'),
    css: rd('styles.css'),
    js: rd('dashboard_produto.js'),
    pmMarca: d.pm_marca_v27 || { KIKI: 78, 'MENINA ANJO': 86, VALENT: 75 },
    nacional: buildNacional(d),
    repIndex: buildRepIndex(d),
  };
  return SRC;
}

// Agregados nacionais usados como benchmark (calculados uma vez).
function buildNacional(d) {
  const porSku = new Map(); // p -> {q, f, cli:Set, dp, m, co, l, g, fx, est}
  const clientes = new Set();
  for (const r of d.recs) {
    clientes.add(r.c);
    let s = porSku.get(r.p);
    if (!s) {
      s = { p: r.p, dp: r.dp, m: r.m, co: r.co, l: r.l, g: r.g, fx: r.fx, est: r.est || '', q: 0, f: 0, cli: new Set() };
      porSku.set(r.p, s);
    }
    s.q += r.q; s.f += r.f; s.cli.add(r.c);
  }
  const campeoes = [...porSku.values()]
    .filter((s) => s.q >= PISO_ASSERTIVIDADE)
    .sort((a, b) => b.q - a.q);
  return {
    porSku,
    nClientes: clientes.size,
    campeoes,
    sssMarca: d.sss_marca,       // [{DESC_MARCA, fat26, fat27, var}]
    ufYoy: d.uf_rank_yoy,        // [{UF, V26, V27, cli, SSS}]
  };
}

// ---------------------------------------------------------------------------
// Mapeamento usuarios.rz -> NOME_REP (nomes divergem levemente entre bases)
// ---------------------------------------------------------------------------
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(LTDA|ME|EPP|EIRELI|CIA|COM|COMERCIAIS|COMERCIAL|REPRESENTACOES|REPRESENTACAO|DE|DA|DO|E|PRODUTOS|TEXTEIS|CONFECCOES|CONFECCAO)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

function buildRepIndex(d) {
  return d.reps_full.map((r) => ({ full: r.full, short: r.short, n: norm(r.full) }));
}

// Resolve o NOME_REP do usuário (linha da tabela usuarios) ou null.
export function resolveRepNome(user) {
  const { repIndex } = load();
  const alvo = norm(user.rz || user.nome);
  if (!alvo) return null;
  for (const r of repIndex) if (r.n === alvo) return r.full;
  const at = alvo.split(' ').filter(Boolean);
  for (const r of repIndex) {
    const bt = r.n.split(' ').filter(Boolean);
    const [menor, maior] = at.length <= bt.length ? [at, bt] : [bt, at];
    if (menor.length && menor.every((t) => maior.includes(t))) return r.full;
  }
  return null;
}

export function listRepsPainel() {
  const { d } = load();
  return d.reps_full.map((r) => ({ full: r.full, short: r.short }));
}

// ---------------------------------------------------------------------------
// Helpers de formatação (números SEMPRE formatados antes de virar HTML)
// ---------------------------------------------------------------------------
const num = (v) => Math.round(v || 0).toLocaleString('pt-BR');
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const sssClass = (v) => (v >= 20 ? 'vu' : v >= 0 ? 've' : v >= -20 ? 'vw' : 'vd');
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Imagens das seções estáticas NÃO são embutidas aqui: emitem <img data-sku>
// e são hidratadas no cliente a partir do dicionário IMG (evita duplicar os
// base64 no HTML). `wanted` acumula os SKUs a incluir no IMG do payload.
const imgTag = (imgs, wanted, p, style) => {
  if (!imgs[p]) return `<div style="${style};background:#f0ebe5"></div>`;
  wanted.add(p);
  return `<img data-sku="${esc(p)}" style="${style};background:#f0ebe5" loading="lazy">`;
};

// Preenche as <img data-sku> com o base64 do IMG após o carregamento.
const HYDRATE_JS = ";document.querySelectorAll('img[data-sku]').forEach(function(el){var b=IMG[el.getAttribute('data-sku')];if(b)el.src='data:image/jpeg;base64,'+b;});";

// ---------------------------------------------------------------------------
// Cálculos por representante
// ---------------------------------------------------------------------------
function statsRep(nomeRep) {
  const { recs, v26m, pmMarca, nacional } = load();
  const rep = recs.filter((r) => r.rp === nomeRep);
  if (!rep.length) return null;

  const clis = new Set(rep.map((r) => r.c));
  const clisRec = [...clis].filter((c) => v26m[c]);
  const recSet = new Set(clisRec);

  // SSS por marca (mesmo método do nacional: V26 real por marca via base
  // segmentada × V27 dos MESMOS clientes recorrentes, em R$; % é unit-free).
  const marca = {};
  for (const m of MARCAS) marca[m] = { f26: 0, f27: 0, q27: 0 };
  for (const c of clisRec) {
    for (const [m, f] of Object.entries(v26m[c])) if (marca[m]) marca[m].f26 += f;
  }
  for (const r of rep) {
    if (!marca[r.m]) continue;
    if (recSet.has(r.c)) { marca[r.m].f27 += r.f; }
    marca[r.m].q27 += r.q;
  }

  // UF YoY do rep (clientes recorrentes por UF, mesmo método do macro).
  const ufCli = new Map(); // c -> uf (primeira ocorrência)
  for (const r of rep) if (!ufCli.has(r.c)) ufCli.set(r.c, r.uf);
  const uf = {};
  for (const c of clisRec) {
    const u = ufCli.get(c);
    if (!uf[u]) uf[u] = { V26: 0, V27: 0, cli: 0 };
    uf[u].V26 += Object.values(v26m[c]).reduce((s, v) => s + v, 0);
    uf[u].cli++;
  }
  for (const r of rep) {
    if (!recSet.has(r.c)) continue;
    const u = ufCli.get(r.c);
    if (uf[u]) uf[u].V27 += r.f;
  }
  const ufYoy = Object.entries(uf)
    .map(([UF, v]) => ({ UF, ...v, SSS: v.V26 ? ((v.V27 - v.V26) / v.V26) * 100 : 0 }))
    .sort((a, b) => b.V27 - a.V27);

  // Assertividade: dos campeões nacionais (piso 400 pç), quantos o rep vendeu.
  const skusRep = new Map(); // p -> {q, f, cli:Set}
  for (const r of rep) {
    let s = skusRep.get(r.p);
    if (!s) { s = { q: 0, f: 0, cli: new Set() }; skusRep.set(r.p, s); }
    s.q += r.q; s.f += r.f; s.cli.add(r.c);
  }
  const vendidos = nacional.campeoes.filter((s) => skusRep.has(s.p));
  const gaps = nacional.campeoes.filter((s) => !skusRep.has(s.p));

  return { rep, clis, clisRec, marca, ufYoy, skusRep, vendidos, gaps, pmMarca };
}

// ---------------------------------------------------------------------------
// Seção estática: benchmark nacional + assertividade
// ---------------------------------------------------------------------------
function htmlBenchmark(st, imgs, wanted) {
  const { nacional, pmMarca } = load();
  const sssNacM = Object.fromEntries(nacional.sssMarca.map((s) => [s.DESC_MARCA, s.var]));
  const sssNacUf = Object.fromEntries(nacional.ufYoy.map((u) => [u.UF, u.SSS]));

  // Cards SSS por marca: rep × nacional
  let cards = '<div style="display:flex;gap:14px;flex-wrap:wrap">';
  for (const m of MARCAS) {
    const v = st.marca[m];
    if (!v || (!v.f26 && !v.q27)) continue;
    const sss = v.f26 ? ((v.f27 - v.f26) / v.f26) * 100 : null;
    const nac = sssNacM[m];
    const co = m === 'KIKI' ? '#a08366' : m === 'MENINA ANJO' ? '#8b6a8a' : '#4a8b5a';
    const delta = sss !== null && nac !== undefined ? sss - nac : null;
    const dTxt = delta === null ? '' :
      `<div style="font-size:.62rem;margin-top:4px;color:${delta >= 0 ? '#4a8b5a' : '#c94a2a'};font-weight:700">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} pp vs nacional</div>`;
    cards += `<div style="flex:1;min-width:200px;padding:14px 18px;border:1.5px solid ${co}40;border-radius:10px;background:${co}08">`
      + `<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:${co};font-weight:600">${m}</div>`
      + `<div style="font-family:Fraunces,Georgia,serif;font-size:1.5rem;font-weight:700;color:#2a2520;margin-top:4px">${sss === null ? 'NOVO' : pct(sss)}</div>`
      + `<div style="font-size:.68rem;color:#5a5047;margin-top:2px">sua carteira · ${num(v.q27)} pç V27</div>`
      + `<div style="font-size:.65rem;color:#8a7e72;margin-top:6px">Nacional: <b>${nac !== undefined ? pct(nac) : '—'}</b></div>${dTxt}</div>`;
  }
  cards += '</div>';

  // Tabela UF: rep × nacional
  let ufT = '<table class="m"><thead><tr><th>UF</th><th class="r">Cli rec.</th><th class="r">Pç V26 est</th><th class="r">Pç V27</th><th class="r">SSS carteira</th><th class="r">SSS nacional</th></tr></thead><tbody>';
  for (const u of st.ufYoy) {
    const nac = sssNacUf[u.UF];
    ufT += `<tr><td><b>${u.UF}</b></td><td class="num">${u.cli}</td>`
      + `<td class="num">${num(u.V26 / 80)}</td><td class="num"><b>${num(u.V27 / 80)}</b></td>`
      + `<td class="num ${sssClass(u.SSS)}"><b>${pct(u.SSS)}</b></td>`
      + `<td class="num" style="color:#8a7e72">${nac !== undefined ? pct(nac) : '—'}</td></tr>`;
  }
  ufT += '</tbody></table>';

  // Assertividade (piso 400 pç nacionais)
  const nCamp = nacional.campeoes.length;
  const nVend = st.vendidos.length;
  const assert_ = nCamp ? (nVend / nCamp) * 100 : 0;
  const aCol = assert_ >= 70 ? '#4a8b5a' : assert_ >= 45 ? '#b88a3a' : '#c94a2a';
  let gapsH = '';
  for (const s of st.gaps.slice(0, 12)) {
    const cob = ((s.cli.size / nacional.nClientes) * 100).toFixed(0);
    gapsH += `<div style="width:96px;border:1px solid #e0d5ca;border-radius:6px;overflow:hidden;background:#fff" title="${esc(s.p)} · ${esc(s.dp)}">`
      + `<div style="position:relative;width:96px;height:126px;background:#f5f0eb">${imgTag(imgs, wanted, s.p, 'width:100%;height:100%;object-fit:cover;display:block')}`
      + `<div style="position:absolute;top:3px;right:3px;font-size:.5rem;font-weight:700;padding:1px 5px;border-radius:3px;color:#fff;background:#c94a2a">GAP</div></div>`
      + `<div style="padding:4px 5px;text-align:center"><div style="font-family:monospace;font-size:.55rem;color:#8a7e72">${esc(s.p)}</div>`
      + `<div style="font-size:.6rem;color:#2a2520;font-weight:600">${num(s.q)} pç BR</div>`
      + `<div style="font-size:.52rem;color:#8a7e72">${cob}% dos cli BR</div></div></div>`;
  }

  return `<section><h2>📊 Benchmark Nacional · sua carteira vs Grupo Catarina</h2>
<div class="ins ok"><b>Como ler:</b> SSS da sua carteira calculado com o mesmo método do painel estratégico (clientes recorrentes V26↔V27). "Nacional" é a base inteira do grupo — use como régua.</div>
<h3 style="font-family:Fraunces,Georgia,serif;font-size:1rem;margin:16px 0 8px;color:#2a2520">SSS por Marca</h3>${cards}
<h3 style="font-family:Fraunces,Georgia,serif;font-size:1rem;margin:22px 0 8px;color:#2a2520">SSS por Estado</h3>${ufT}
<h3 style="font-family:Fraunces,Georgia,serif;font-size:1rem;margin:22px 0 8px;color:#2a2520">🎯 Assertividade de Mix · piso ${PISO_ASSERTIVIDADE} peças</h3>
<div class="ins"><b>${nCamp} SKUs campeões</b> (≥ ${PISO_ASSERTIVIDADE} pç vendidas no Brasil). Sua carteira trabalhou <b>${nVend}</b> deles.</div>
<div style="display:flex;align-items:center;gap:18px;margin:12px 0;flex-wrap:wrap">
<div style="font-family:Fraunces,Georgia,serif;font-size:2.2rem;font-weight:700;color:${aCol}">${assert_.toFixed(0)}%</div>
<div style="flex:1;min-width:200px;height:10px;background:#f0ebe3;border-radius:5px;overflow:hidden"><div style="width:${Math.min(assert_, 100).toFixed(0)}%;height:100%;background:${aCol}"></div></div>
<div style="font-size:.72rem;color:#5a5047">${nVend} de ${nCamp} campeões nacionais</div></div>
${st.gaps.length ? `<div style="font-size:.75rem;color:#5a5047;margin:10px 0 8px"><b>Oportunidades</b> · campeões nacionais que sua carteira ainda não pediu (top ${Math.min(12, st.gaps.length)} de ${st.gaps.length}):</div><div style="display:flex;gap:8px;flex-wrap:wrap">${gapsH}</div>` : '<div class="ins ok"><b>100% de assertividade</b> — sua carteira trabalhou todos os campeões nacionais.</div>'}
</section>`;
}

// ---------------------------------------------------------------------------
// Mapa de ataque do rep: Marca → Coordenado → SKU (foto/cobertura/gap)
// ---------------------------------------------------------------------------
function htmlMapaRep(st, imgs, wanted) {
  const { nacional } = load();
  const nCli = st.clis.size;

  // Coordenados nacionais por marca (com totais do rep por coordenado).
  const porMarca = new Map();
  for (const s of nacional.porSku.values()) {
    if (!porMarca.has(s.m)) porMarca.set(s.m, new Map());
    const cos = porMarca.get(s.m);
    if (!cos.has(s.co)) cos.set(s.co, []);
    cos.get(s.co).push(s);
  }

  let html = '';
  for (const mk of MARCAS) {
    const cos = porMarca.get(mk);
    if (!cos) continue;
    const co = mk === 'KIKI' ? '#a08366' : mk === 'MENINA ANJO' ? '#8b6a8a' : '#4a8b5a';

    // Ordena coordenados pelo volume do rep (desc); sem venda vai para o resumo.
    const entries = [...cos.entries()].map(([nome, skus]) => {
      const repQ = skus.reduce((s, k) => s + (st.skusRep.get(k.p)?.q || 0), 0);
      const nacQ = skus.reduce((s, k) => s + k.q, 0);
      return { nome, skus, repQ, nacQ };
    });
    const ativos = entries.filter((e) => e.repQ > 0).sort((a, b) => b.repQ - a.repQ);
    const semVenda = entries.filter((e) => e.repQ === 0).sort((a, b) => b.nacQ - a.nacQ);
    if (!ativos.length && !semVenda.length) continue;

    const nSkusMk = entries.reduce((s, e) => s + e.skus.length, 0);
    html += `<div style="margin-bottom:24px;border:1.5px solid ${co}40;border-radius:12px;overflow:hidden;background:#fff">`
      + `<div style="padding:12px 16px;background:${co}10;border-bottom:1.5px solid ${co}30;display:flex;align-items:center;gap:12px;flex-wrap:wrap">`
      + `<span style="background:${co};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;font-size:.85rem">${mk}</span>`
      + `<span style="font-size:.72rem;color:#5a5047;font-family:monospace">${ativos.length} coordenados trabalhados · ${nSkusMk} SKUs na coleção</span></div>`;

    for (const e of ativos) {
      const ordenados = [...e.skus].sort((a, b) => {
        const qa = st.skusRep.get(a.p)?.q || 0, qb = st.skusRep.get(b.p)?.q || 0;
        return (qb - qa) || (b.q - a.q);
      });
      html += `<div style="padding:10px 14px;border-bottom:1px dashed #e8e3dd">`
        + `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">`
        + `<b style="font-family:Fraunces,Georgia,serif;font-size:.88rem;color:#2a2520">${esc(e.nome || 'SEM COORDENADO')}</b>`
        + `<span style="font-size:.62rem;color:#8a7e72;font-family:monospace">${num(e.repQ)} pç suas · ${num(e.nacQ)} pç BR</span></div>`
        + `<div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const s of ordenados) {
        const mine = st.skusRep.get(s.p);
        if (mine) {
          const pm = mine.q ? mine.f / mine.q : 0;
          const cob = nCli ? (mine.cli.size / nCli) * 100 : 0;
          const cCol = cob >= 50 ? '#4a8b5a' : cob >= 25 ? '#b88a3a' : '#c94a2a';
          html += `<div style="width:86px;border:1px solid #e0d5ca;border-radius:5px;overflow:hidden;background:#fff" title="${esc(s.p)} · ${esc(s.dp)}">`
            + `<div style="position:relative;width:86px;height:113px;background:#f5f0eb">${imgTag(imgs, wanted, s.p, 'width:100%;height:100%;object-fit:cover;display:block')}</div>`
            + `<div style="padding:3px 4px;text-align:center">`
            + `<div style="font-family:Georgia,serif;font-size:.72rem;font-weight:700;color:#2a2520">R$ ${pm.toFixed(0)}</div>`
            + `<div style="font-family:monospace;font-size:.5rem;color:#8a7e72">${esc(s.p)}</div>`
            + `<div style="font-size:.56rem;font-weight:700;color:${cCol}">${num(mine.q)} pç · ${cob.toFixed(0)}%</div></div></div>`;
        } else {
          html += `<div style="width:86px;border:1px dashed #d4c9bc;border-radius:5px;overflow:hidden;background:#fdf9f5;opacity:.75" title="${esc(s.p)} · ${esc(s.dp)} · não pedido pela sua carteira">`
            + `<div style="position:relative;width:86px;height:113px;background:#f5f0eb">${imgTag(imgs, wanted, s.p, 'width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(70%)')}`
            + `<div style="position:absolute;top:2px;right:2px;font-size:.46rem;font-weight:700;padding:1px 4px;border-radius:2px;color:#fff;background:#c9a080">GAP</div></div>`
            + `<div style="padding:3px 4px;text-align:center">`
            + `<div style="font-family:monospace;font-size:.5rem;color:#8a7e72">${esc(s.p)}</div>`
            + `<div style="font-size:.56rem;color:#a09080">${num(s.q)} pç BR</div></div></div>`;
        }
      }
      html += '</div></div>';
    }

    if (semVenda.length) {
      html += `<div style="padding:10px 14px;background:#faf8f5"><div style="font-size:.66rem;text-transform:uppercase;letter-spacing:.8px;color:#8a7e72;font-weight:600;margin-bottom:6px">Coordenados não trabalhados pela sua carteira</div><div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const e of semVenda) {
        html += `<span style="font-size:.62rem;padding:3px 8px;border:1px dashed #d4c9bc;border-radius:10px;color:#8a7e72;background:#fff">${esc(e.nome || 'SEM COORDENADO')} · ${e.skus.length} SKUs · ${num(e.nacQ)} pç BR</span>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  }
  return html;
}

// ---------------------------------------------------------------------------
// Montagem do HTML final (mesma cirurgia de template do build.py)
// ---------------------------------------------------------------------------
const REPLACEMENTS_PRODUTO = {
  'Painel V27 · Atualizado': 'Painel V27 · Meu Painel',
  'Análise estratégica completa': 'SSS por peças vendidas · mix e arquitetura de preço',
  'Same Store Sales · V26': 'Same Store Sales · Peças V26 est vs V27',
  'Performance por Estado · V26 vs V27': 'Peças por Estado',
  'SSS por Perfil · Recorrentes': 'Peças por Perfil de Cliente',
  'Top 20 Clientes': 'Top 20 Clientes por Volume de Peças',
  'SSS por Marca · V26 estimado vs V27': 'SSS Peças por Marca · V26 est vs V27',
  'SSS por Marca × Linha / Idade': 'SSS Peças por Marca × Linha',
  '>SSS por Linha / Idade<': '>SSS Peças por Linha / Idade<',
  'Performance por Perfil de Cidade · Classificação IBGE': 'Peças por Perfil de Cidade · IBGE',
  'Performance por Faixa Granular de Preço (PM)': 'Peças por Faixa de Preço',
  'V26 por marca = base oficial segmentada': 'V26 peças estimadas = faturamento V26 ÷ PM V27 por marca',
  'Match real cliente × marca × ano. Sem estimativa.': 'Peças V26 estimadas · V27 peças reais.',
  'V26 não tem informação de linha.': 'SSS por peças: V26 estimado, V27 real.',
  'Cada linha está positiva?': 'SSS peças por linha:',
  'Cards mostram SSS estimado por linha': 'Cards mostram SSS por volume de peças',
};

const cache = new Map(); // nomeRep -> html (LRU simples por ordem de inserção)

export function buildPainelRep(nomeRep, { refresh = false } = {}) {
  if (!refresh && cache.has(nomeRep)) {
    const html = cache.get(nomeRep);
    cache.delete(nomeRep); cache.set(nomeRep, html); // move para o fim (recente)
    return html;
  }
  const { img, v26m, cidPerfil, template, css, js, pmMarca, repIndex } = load();
  const st = statsRep(nomeRep);
  if (!st) return null;
  const short = repIndex.find((r) => r.full === nomeRep)?.short || nomeRep;

  // Payload segregado: só os registros do rep, sem custos (ct/cu ficam no servidor).
  const recsOut = st.rep.map(({ ct, cu, ...r }) => ({ ...r, ct: 0, cu: 0 }));

  // SKUs cujas imagens vão no IMG: os do rep + os referenciados nas seções
  // estáticas (gaps do mapa/assertividade), acumulados em `wanted`.
  const wanted = new Set(st.rep.map((r) => r.p));
  const benchmarkHtml = htmlBenchmark(st, img, wanted);
  const mapaHtml = htmlMapaRep(st, img, wanted);
  const imgOut = {};
  for (const p of wanted) if (img[p]) imgOut[p] = img[p];
  const v26Out = {};
  for (const c of st.clis) if (v26m[c]) v26Out[c] = v26m[c];
  const cidsRep = new Set(st.rep.map((r) => r.cid));
  const cidOut = {};
  for (const c of cidsRep) if (cidPerfil[c]) cidOut[c] = cidPerfil[c];
  const sssMarcaRep = MARCAS
    .filter((m) => st.marca[m].f26 || st.marca[m].f27)
    .map((m) => ({
      DESC_MARCA: m, fat26: st.marca[m].f26, fat27: st.marca[m].f27,
      var: st.marca[m].f26 ? +(((st.marca[m].f27 - st.marca[m].f26) / st.marca[m].f26) * 100).toFixed(1) : 0,
    }));

  // Replacement sempre por função: o conteúdo dinâmico pode conter "$" e
  // String.replace trataria "$'"/"$&" como sequência especial.
  const put = (h, busca, novo) => h.replace(busca, () => novo);

  let html = template;
  html = put(html, '<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`);
  html = put(html, '<title>Painel V27 · Estratégico</title>', `<title>Painel V27 · ${esc(short)}</title>`);

  // Hero: identifica o rep e o recorte.
  html = put(html, 'Verão <b>2027</b> · Grupo Catarina', `Verão <b>2027</b> · ${esc(short)}`);
  html = put(
    html,
    'Direção estratégica automática · SSS real · Otimização de mix · Faixas de preço · Imagens completas',
    `Painel da representação <b>${esc(nomeRep)}</b> · ${st.clis.size} clientes · benchmark nacional incluído`,
  );

  // Remove o grupo de filtro "Representante" (o recorte já vem do servidor).
  html = html.replace(
    /<div class="fgrp"><span class="flbl">Representante<\/span>.*?<\/div>(<div class="fgrp"><span class="flbl">Tipo Produto<\/span>)/s,
    '$1',
  );

  // Títulos da versão produto (sem valores financeiros).
  for (const [antes, depois] of Object.entries(REPLACEMENTS_PRODUTO)) html = html.split(antes).join(depois);

  // Benchmark nacional no fim da aba Negócio.
  html = put(html, '</div><div class="view" id="v-mca">', `${benchmarkHtml}</div><div class="view" id="v-mca">`);

  // O template não tem #ins-b, mas o dashboard escreve nele — sem o stub o
  // render() morre no fim (e leva junto o mapa dinâmico e a hidratação).
  html = put(html, '<div id="ins-a"></div>', '<div id="ins-a"></div><div id="ins-b" style="display:none"></div>');

  // Mapa por Coordenado (com cobertura/gap) em seção própria; o placeholder
  // original fica vazio para o mapa dinâmico do dashboard (reage aos filtros).
  html = put(html, '<div class="view" id="v-mapa">', `<div class="view" id="v-mapa">
<section>
<h2>Cartela por Coordenado · sua carteira vs coleção</h2>
<p class="ssub">Coleção V27 por <b>Marca → Coordenado → SKU</b>: o que sua carteira pediu (preço médio, peças e cobertura) e os <b>gaps</b> — peças da cartela que seus clientes ainda não pediram.</p>
${mapaHtml}</section>`);

  // Data block + JS (mesmo formato do build.py, versão produto).
  const dataBlock =
    'const D=' + JSON.stringify(recsOut) +
    ';const IMG=' + JSON.stringify(imgOut) +
    ';const SSSM=' + JSON.stringify(sssMarcaRep) +
    ';const V26M=' + JSON.stringify(v26Out) +
    ';const UFYOY=' + JSON.stringify(st.ufYoy.map(({ UF, V26, V27, cli, SSS }) => ({ UF, V26, V27, cli, SSS }))) +
    ';const CIDADE_PERFIL=' + JSON.stringify(cidOut) +
    ';const PM_V27=' + JSON.stringify(pmMarca) + ';';
  // Hidratação ANTES do dashboard: se o render() quebrar, as fotos das
  // seções estáticas já estão no lugar.
  const a = html.indexOf('<script>');
  const b = html.lastIndexOf('</script>') + '</script>'.length;
  html = html.slice(0, a) + '<script>' + dataBlock + HYDRATE_JS + js + '</script>' + html.slice(b);

  cache.set(nomeRep, html);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return html;
}
