// Catálogo de Produtos por Coleção — consulta produto × cor × imagem sobre o
// espelho analítico da EXCIA (db/analitico.sqlite). Uso exclusivo do backend.
//
// Fonte: produtos (ProdutoLista, com cor[]/cor_ativa[]/tam[]/codigo2 no raw),
// catalogos tipo='cor' (CorLista) e tipo='colecao' (Coleção), img_cache.
// Regras de negócio: metodologia Catarina (exclui sacolas/uniforme/material de
// loja de toda análise de produto; coleções resolvidas dinamicamente).
import { idb } from './intelDb.js';

// --- Exclusões (skill Catarina, regra 1): não são produto de coleção. -------
const RE_EXCLUI = /(SACOLA|ECOBAG|EMBALAG|BRINDE|MATERIAL DE LOJA|EXPOSITOR|CABIDE|ADESIVO|TAG\b|ETIQUETA|UNIFORME|PROVADOR|DISPLAY)/i;
const LINHAS_EXCLUI = new Set(['UNIFORME']);

function excluido(p) {
  if (LINHAS_EXCLUI.has(String(p.linha || '').toUpperCase())) return true;
  return RE_EXCLUI.test(`${p.descricao || ''} ${p.grupo || ''} ${p.familia || ''}`);
}

// --- Coleções: classificação por descrição + ano (dinâmico, nunca hardcoded).
// Rótulos de temporada distintos: Tropical é sub-temporada própria, não "Verão".
function rotuloTemporada(desc) {
  const d = String(desc || '').toUpperCase();
  if (d.includes('INVERNO') || /\bI\d{2}\b/.test(d)) return 'Inverno';
  if (d.includes('TROPICAL')) return 'Tropical';
  if (d.includes('PRIMAVERA')) return 'Primavera';
  if (d.includes('VERAO') || d.includes('VERÃO') || d.includes('VER ') || /\bV\d{2}\b/.test(d)) return 'Verão';
  return null;
}
function anoDaDescricao(desc) {
  const d = String(desc || '');
  const m4 = d.match(/(20\d{2})/);
  if (m4) return Number(m4[1]);
  const m2 = d.match(/\b(\d{2})\b/); // "INVERNO 27", "I27"
  if (m2) return 2000 + Number(m2[1]);
  return null;
}

export function listarColecoes() {
  return idb.prepare("SELECT codigo, descricao FROM catalogos WHERE tipo='colecao'").all()
    .map((r) => ({
      codigo: String(r.codigo).trim(),
      descricao: r.descricao || '',
      temporada: rotuloTemporada(r.descricao),
      ano: anoDaDescricao(r.descricao),
    }));
}

// Resolve o conjunto de códigos de coleção a partir de { colecao } (código
// explícito) ou { temporada, ano }. Retorna [{codigo,descricao,...}].
export function resolverColecoes({ colecao, temporada, ano } = {}) {
  const todas = listarColecoes();
  if (colecao) {
    const alvo = String(colecao).trim();
    return todas.filter((c) => c.codigo === alvo);
  }
  if (temporada || ano) {
    const t = temporada ? String(temporada).toLowerCase() : null;
    const a = ano ? Number(ano) : null;
    return todas.filter((c) =>
      (!t || (c.temporada && c.temporada.toLowerCase() === t)) &&
      (!a || c.ano === a));
  }
  return todas;
}

// --- Descrição da cor (join CorLista). --------------------------------------
let _corMap = null;
function corMap() {
  if (_corMap) return _corMap;
  _corMap = new Map();
  for (const r of idb.prepare("SELECT codigo, descricao FROM catalogos WHERE tipo='cor'").all()) {
    _corMap.set(String(r.codigo).trim(), r.descricao || '');
  }
  return _corMap;
}
export function _resetCache() { _corMap = null; } // testes

// Uma imagem geral em cache? (img_cache guarda "" quando a API respondeu "sem
// imagem"; base64 preenchido = tem imagem.) A imagem por cor é resolvida sob
// demanda na rota; aqui indicamos a cobertura conhecida offline.
function imagemGeralEmCache(codigo) {
  const c = idb.prepare('SELECT base64 FROM img_cache WHERE codigo=?').get(codigo);
  if (!c) return null;            // desconhecido (ainda não consultado)
  return c.base64 ? true : false; // já sabido: tem / não tem
}

const sn = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'S' || s === '1' || s === 'SIM' || s === 'ATIVO') return 'Sim';
  if (s === 'N' || s === '0' || s === 'NAO' || s === 'NÃO' || s === 'INATIVO') return 'Não';
  return s || '';
};

// --- Linhas do catálogo (produto × cor). ------------------------------------
// filtro: { colecoes:Set<string>, q, corAtiva:bool(default só ativas),
//           comImagem:'com'|'sem'|null, cor, status, incluirExcluidos:bool }
export function linhasCatalogo(filtro = {}) {
  const colset = filtro.colecoes instanceof Set ? filtro.colecoes
    : (filtro.colecoes ? new Set(filtro.colecoes.map((x) => String(x).trim())) : null);
  const cm = corMap();
  const q = filtro.q ? String(filtro.q).trim().toLowerCase() : '';
  const soAtivas = filtro.corAtiva !== false; // padrão: só cores ativas
  const alertas = [];
  const linhas = [];
  const vistos = new Set();

  const prods = idb.prepare(
    colset ? `SELECT * FROM produtos WHERE colecao IN (${[...colset].map(() => '?').join(',')})`
           : 'SELECT * FROM produtos'
  ).all(...(colset ? [...colset] : []));

  for (const p of prods) {
    if (!filtro.incluirExcluidos && excluido(p)) continue;
    let raw = {};
    try { raw = JSON.parse(p.raw || '{}'); } catch { raw = {}; }
    const referencia = String(raw.codigo2 || p.codigo).trim();
    const descricao = p.descricao || '';
    if (q && !(`${p.codigo} ${referencia} ${descricao}`.toLowerCase().includes(q))) continue;

    if (!descricao) alertas.push({ codigo: p.codigo, tipo: 'sem_descricao' });

    const cores = (() => { try { return JSON.parse(p.cores || '[]'); } catch { return []; } })()
      .map((c) => String(c).trim()).filter(Boolean);
    const coresAtivas = Array.isArray(raw.cor_ativa) ? raw.cor_ativa.map((x) => String(x).trim()) : [];
    if (coresAtivas.length && cores.length && coresAtivas.length !== cores.length) {
      alertas.push({ codigo: p.codigo, tipo: 'divergencia_arrays', detalhe: `cor=${cores.length} cor_ativa=${coresAtivas.length}` });
    }

    const imgGeral = imagemGeralEmCache(p.codigo);
    const statusProd = sn(p.ativo) || (p.status || '');

    const pushLinha = (cor, ativaSN) => {
      const desc_cor = cor ? (cm.get(cor) ?? null) : '';
      if (cor && desc_cor === null) alertas.push({ codigo: p.codigo, cor, tipo: 'cor_sem_cadastro' });
      // imagem por cor é resolvida sob demanda; offline usamos a geral como proxy
      const possui = imgGeral === null ? 'desconhecido' : (imgGeral ? 'Sim' : 'Não');
      const key = `${p.codigo}|${cor}`;
      if (vistos.has(key)) return; vistos.add(key);
      linhas.push({
        codigo: p.codigo,
        referencia,
        descricao,
        marca: p.marca || '', grupo: p.grupo || '', linha: p.linha || '',
        familia: p.familia || '', colecao: p.colecao || '',
        preco_tabela: Number(p.preco_tabela || 0),
        status: statusProd,
        cor: cor || '',
        desc_cor: desc_cor || '',
        cor_ativa: cor ? (ativaSN || '') : '',
        possui_imagem: possui,
        img_url: cor ? `/api/catalogo/imagem/${encodeURIComponent(p.codigo)}/${encodeURIComponent(cor)}`
                     : `/api/catalogo/imagem/${encodeURIComponent(p.codigo)}`,
      });
    };

    if (!cores.length) {
      alertas.push({ codigo: p.codigo, tipo: 'sem_cor' });
      if (!soAtivas || statusProd !== 'Não') pushLinha('', '');
    } else {
      cores.forEach((cor, i) => {
        const ativa = sn(coresAtivas[i] ?? 'S'); // sem cor_ativa: assume ativa
        if (soAtivas && ativa === 'Não') return;
        if (filtro.cor && cor !== String(filtro.cor).trim()) return;
        pushLinha(cor, ativa);
      });
    }
  }

  // filtros pós-monta (dependem da linha pronta)
  let out = linhas;
  if (filtro.comImagem === 'com') out = out.filter((l) => l.possui_imagem === 'Sim');
  else if (filtro.comImagem === 'sem') out = out.filter((l) => l.possui_imagem === 'Não');
  if (filtro.status) out = out.filter((l) => l.status === filtro.status);

  return { linhas: out, alertas, metricas: metricas(out) };
}

export function metricas(linhas) {
  const produtos = new Set(linhas.map((l) => l.codigo));
  const semCor = new Set(linhas.filter((l) => !l.cor).map((l) => l.codigo));
  const comImg = linhas.filter((l) => l.possui_imagem === 'Sim').length;
  const semImg = linhas.filter((l) => l.possui_imagem === 'Não').length;
  const conhecidas = comImg + semImg;
  const porProduto = {};
  for (const l of linhas) if (l.cor) porProduto[l.codigo] = (porProduto[l.codigo] || 0) + 1;
  const nCores = Object.values(porProduto);
  return {
    qtd_produtos: produtos.size,
    qtd_linhas: linhas.length,
    produtos_sem_cor: semCor.size,
    cores_por_produto_medio: nCores.length ? +(nCores.reduce((a, b) => a + b, 0) / nCores.length).toFixed(2) : 0,
    linhas_sem_imagem: semImg,
    pct_cobertura_imagem: conhecidas ? +((comImg / conhecidas) * 100).toFixed(1) : null,
  };
}

// --- Drill-down de um produto (galeria + cores ativas/inativas + tams). ------
export function detalheProduto(codigo) {
  const p = idb.prepare('SELECT * FROM produtos WHERE codigo=?').get(String(codigo).trim());
  if (!p) return null;
  let raw = {}; try { raw = JSON.parse(p.raw || '{}'); } catch { /* */ }
  const cm = corMap();
  const cores = (() => { try { return JSON.parse(p.cores || '[]'); } catch { return []; } })()
    .map((c) => String(c).trim()).filter(Boolean);
  const coresAtivas = Array.isArray(raw.cor_ativa) ? raw.cor_ativa.map((x) => String(x).trim()) : [];
  const tams = (() => { try { return JSON.parse(p.tams || '[]'); } catch { return []; } })();
  return {
    codigo: p.codigo, referencia: String(raw.codigo2 || p.codigo).trim(),
    descricao: p.descricao, marca: p.marca, grupo: p.grupo, linha: p.linha,
    familia: p.familia, colecao: p.colecao, preco_tabela: Number(p.preco_tabela || 0),
    status: sn(p.ativo) || p.status || '', data_cad: p.data_cad, dt_altera: p.dt_altera,
    tams,
    cores: cores.map((cor, i) => ({
      cor, desc_cor: cm.get(cor) ?? null, ativa: sn(coresAtivas[i] ?? 'S'),
      img_url: `/api/catalogo/imagem/${encodeURIComponent(p.codigo)}/${encodeURIComponent(cor)}`,
    })),
  };
}

// --- Export CSV (uma linha por produto+cor). --------------------------------
export function paraCSV(linhas) {
  const cols = ['referencia', 'codigo', 'descricao', 'marca', 'colecao', 'cor', 'desc_cor', 'cor_ativa', 'status', 'possui_imagem', 'preco_tabela'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Referencia', 'Codigo EXCIA', 'Descricao', 'Marca', 'Colecao', 'Cor', 'Descricao Cor', 'Cor Ativa', 'Status', 'Possui Imagem', 'Preco Tabela'];
  return [head.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\n');
}
