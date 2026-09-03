// Roteirização de visitas: geocodificação (OpenStreetMap/Nominatim) com cache,
// carteira georreferenciada, prospects e origem informada pelo representante.
// A otimização da rota (ordem de visita) é feita no cliente (nearest-neighbor
// + 2-opt sobre distância) — aqui entregamos os pontos com lat/lon.
import { idb } from './intelDb.js';
import { db } from '../db.js'; // transacional: clientes tem cidade/uf/rep_cod

const UA = 'gc-representantes/1.0 (contato@grupocatarina.com)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Fila com espaçamento (política do Nominatim: ~1 req/s).
let cadeia = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function naFila(fn) {
  const p = cadeia.then(fn);
  cadeia = p.then(() => sleep(1100), () => sleep(1100));
  return p;
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

function getCache(chave) {
  return idb.prepare('SELECT lat, lon, display, ok FROM geocode WHERE chave=?').get(chave) || null;
}
function setCache(chave, r) {
  idb.prepare(`INSERT INTO geocode (chave, lat, lon, display, ok, atualizado_em)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(chave) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, display=excluded.display, ok=excluded.ok, atualizado_em=excluded.atualizado_em`)
    .run(chave, r?.lat ?? null, r?.lon ?? null, r?.display ?? null, r ? 1 : 0);
}

async function nominatim(params) {
  const qs = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'br', ...params });
  const url = `${NOMINATIM}?${qs}`;
  return naFila(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: ctrl.signal });
      if (!res.ok) return null;
      const arr = await res.json();
      const r = Array.isArray(arr) ? arr[0] : null;
      return r ? { lat: Number(r.lat), lon: Number(r.lon), display: r.display_name } : null;
    } catch { return null; } finally { clearTimeout(t); }
  });
}

// Geocodifica por CEP; fallback cidade+UF. Usa cache (inclusive negativo).
export async function geocodar({ cep, cidade, uf }) {
  const cepD = soDigitos(cep);
  if (cepD.length === 8) {
    const chave = `cep:${cepD}`;
    const c = getCache(chave);
    if (c) return c.ok ? c : null;
    const r = await nominatim({ postalcode: cepD });
    setCache(chave, r);
    if (r) return r;
  }
  if (cidade) {
    const chave = `cid:${norm(cidade)}|${norm(uf)}`;
    const c = getCache(chave);
    if (c) return c.ok ? c : null;
    const r = await nominatim({ city: cidade, ...(uf ? { state: uf } : {}) });
    setCache(chave, r);
    return r || null;
  }
  return null;
}

// CEP do cliente (quando já enriquecido no analítico) — melhora a precisão.
function cepDoCliente(codcli5) {
  const c = idb.prepare('SELECT raw FROM clientes_ex WHERE codcli=?').get(codcli5);
  if (!c?.raw) return null;
  try { return soDigitos(JSON.parse(c.raw).cep) || null; } catch { return null; }
}

// Status Ativo/Reativação pela ÚLTIMA COLEÇÃO (a mais recente por data na base).
// Ativo = comprou na última coleção; Reativação = tem histórico mas não comprou
// nela; Sem histórico = nunca comprou. Cacheado por 10 min.
let _statusCache = null;
function statusInfo() {
  if (_statusCache && Date.now() - _statusCache.em < 10 * 60 * 1000) return _statusCache;
  const ult = idb.prepare(
    "SELECT colecao FROM pedidos WHERE colecao NOT IN ('','00','9','09') GROUP BY colecao ORDER BY MAX(dt_emissao) DESC LIMIT 1",
  ).get()?.colecao || null;
  const ativos = new Set(ult
    ? idb.prepare('SELECT DISTINCT codcli FROM pedidos WHERE colecao=? AND valor_liq>0').all(ult).map((r) => r.codcli)
    : []);
  const comHist = new Set(idb.prepare('SELECT DISTINCT codcli FROM pedidos WHERE valor_liq>0').all().map((r) => r.codcli));
  const nomeUlt = idb.prepare("SELECT descricao FROM catalogos WHERE tipo='colecao' AND codigo=?").get(ult)?.descricao || ult;
  _statusCache = { em: Date.now(), ult, nomeUlt, ativos, comHist };
  return _statusCache;
}
export function ultimaColecaoBase() { const s = statusInfo(); return { colecao: s.ult, nome: s.nomeUlt }; }

// codcli do transacional (ex.: "2") -> chave do analítico (5 dígitos "00002").
const pad5 = (c) => String(c || '').padStart(5, '0');
function statusDoCliente(codcli) {
  const s = statusInfo();
  const k = pad5(codcli);
  if (s.ativos.has(k)) return 'ativo';
  if (s.comHist.has(k)) return 'reativacao';
  return 'sem_historico';
}

// Clientes da carteira (por rep) com coordenadas quando já em cache.
// Fonte: tabela transacional `clientes` (tem cidade/uf/rep_cod de toda a carteira).
export function carteiraPontos({ repCod = null, uf = null } = {}) {
  let rows;
  if (repCod) {
    rows = db.prepare('SELECT codcli, nome, cidade, uf FROM clientes WHERE rep_cod=?').all(String(repCod));
  } else if (uf) {
    rows = db.prepare('SELECT codcli, nome, cidade, uf FROM clientes WHERE uf=?').all(uf);
  } else {
    rows = [];
  }
  return rows.map((c) => {
    const cep = cepDoCliente(pad5(c.codcli));
    const geo = cep && cep.length === 8 ? getCache(`cep:${cep}`)
      : (c.cidade ? getCache(`cid:${norm(c.cidade)}|${norm(c.uf)}`) : null);
    return {
      codcli: c.codcli, nome: c.nome, cidade: c.cidade, uf: c.uf,
      cep: cep || null, tipo: 'cliente', status: statusDoCliente(c.codcli),
      lat: geo?.ok ? geo.lat : null, lon: geo?.ok ? geo.lon : null,
    };
  });
}

// Geocodifica em lote — por ALVO ÚNICO (cidade ou CEP), não por cliente. Muitos
// clientes compartilham cidade, então isto reduz drasticamente as chamadas
// (ex.: 576 clientes ~ 150 cidades). limite conta só chamadas de rede reais.
export async function geocodarPendentes(pontos, limite = 60) {
  const vistos = new Set();
  const alvos = [];
  for (const p of pontos) {
    if (p.lat != null) continue;
    const cepD = soDigitos(p.cep);
    const chave = cepD.length === 8 ? `cep:${cepD}` : (p.cidade ? `cid:${norm(p.cidade)}|${norm(p.uf)}` : null);
    if (!chave || vistos.has(chave) || getCache(chave)) continue;
    vistos.add(chave);
    alvos.push({ cep: cepD.length === 8 ? p.cep : null, cidade: p.cidade, uf: p.uf });
  }
  let feitos = 0;
  for (const a of alvos) {
    if (feitos >= limite) break;
    await geocodar(a); // grava no cache (positivo ou negativo)
    feitos++;
  }
  return { feitos, alvos_restantes: Math.max(alvos.length - feitos, 0) };
}

// ---- descoberta de lojas (Google Places) --------------------------------
// Fonte real para lojas pequenas de moda infantil (OSM não tem cobertura).
// Requer GOOGLE_PLACES_KEY; sem a chave, devolve atalhos de busca manual.
const GKEY = process.env.GOOGLE_PLACES_KEY || '';
export function googleConfigurado() { return Boolean(GKEY); }

const linkBuscas = (termo, cidade) => {
  const q = encodeURIComponent(`${termo} ${cidade}`.trim());
  return [
    { label: 'Instagram', url: `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${termo} ${cidade}`)}` },
    { label: 'Google Maps', url: `https://www.google.com/maps/search/${q}` },
    { label: 'Google', url: `https://www.google.com/search?q=${q}` },
  ];
};

export async function descobrirLojas({ cidade, uf, termo = 'loja de moda infantil', raio = 0 }) {
  if (!cidade) return { erro: 'informe a cidade' };
  if (!GKEY) {
    return {
      erro: 'busca automática desativada (sem chave do Google Places)',
      dica: 'configure GOOGLE_PLACES_KEY no servidor para descoberta automática',
      buscas_manuais: linkBuscas(termo, `${cidade} ${uf || ''}`),
    };
  }
  const body = {
    textQuery: `${termo} em ${cidade}${uf ? ' - ' + uf : ''}`,
    languageCode: 'pt-BR', regionCode: 'BR', maxResultCount: 20,
  };
  if (raio > 0) {
    const centro = await geocodar({ cidade, uf });
    if (centro) body.locationBias = { circle: { center: { latitude: centro.lat, longitude: centro.lon }, radius: Math.min(raio * 1000, 50000) } };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GKEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.addressComponents',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.text(); return { erro: `Google Places ${res.status}: ${err.slice(0, 160)}` }; }
    const j = await res.json();
    const lojas = (j.places || []).map((p) => {
      const nome = p.displayName?.text || '(sem nome)';
      const comp = p.addressComponents || [];
      const cidadeG = comp.find((c) => c.types?.includes('administrative_area_level_2'))?.longText || cidade;
      const ufG = comp.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText || uf || '';
      return {
        nome, endereco: p.formattedAddress || '', cidade: cidadeG, uf: ufG,
        lat: p.location?.latitude ?? null, lon: p.location?.longitude ?? null,
        telefone: p.nationalPhoneNumber || null, site: p.websiteUri || null,
        rating: p.rating || null, avaliacoes: p.userRatingCount || 0,
        maps: p.googleMapsUri || null, buscas: linkBuscas(nome, cidadeG),
      };
    });
    return { termo, cidade, uf, total: lojas.length, lojas };
  } catch (e) {
    return { erro: `falha na busca: ${e.message}` };
  } finally { clearTimeout(t); }
}

// Descoberta na REGIÃO do representante: varre as cidades onde ele já atende
// (carteira) e busca lojas de moda infantil, deduplicando contra os clientes
// atuais. Bounded por maxCidades (cada cidade = 1 chamada Google Places).
export async function descobrirRegiao({ repCod = null, uf = null, termo = 'loja de moda infantil', maxCidades = 12 }) {
  const pontos = carteiraPontos({ repCod, uf });
  // cidades únicas priorizando as que o rep MENOS atende (mais espaço p/ prospectar)
  const porCidade = new Map();
  for (const p of pontos) {
    if (!p.cidade) continue;
    const k = `${norm(p.cidade)}|${norm(p.uf)}`;
    const e = porCidade.get(k) || { cidade: p.cidade, uf: p.uf, clientes: 0 };
    e.clientes++; porCidade.set(k, e);
  }
  const cidades = [...porCidade.values()].sort((a, b) => a.clientes - b.clientes).slice(0, Math.min(maxCidades, 30));
  const nomesClientes = new Set(pontos.map((p) => norm(p.nome)));

  if (!googleConfigurado()) {
    return {
      google_ativo: false,
      erro: 'busca automática desativada (sem chave do Google Places)',
      cidades_alvo: cidades.map((c) => ({ cidade: c.cidade, uf: c.uf, clientes: c.clientes, buscas: linkBuscas(termo, `${c.cidade} ${c.uf}`) })),
    };
  }
  const lojas = []; const vistos = new Set();
  for (const c of cidades) {
    const r = await descobrirLojas({ cidade: c.cidade, uf: c.uf, termo, raio: 10 });
    for (const L of (r.lojas || [])) {
      const nk = norm(L.nome);
      if (nomesClientes.has(nk) || vistos.has(nk + '|' + norm(L.cidade))) continue; // já é cliente / repetida
      vistos.add(nk + '|' + norm(L.cidade));
      lojas.push({ ...L, cidade_busca: c.cidade });
    }
  }
  return { google_ativo: true, cidades_buscadas: cidades.length, termo, total: lojas.length, lojas };
}

// ---- prospects ----
export function listarProspects(repCod) {
  return idb.prepare('SELECT * FROM prospects WHERE rep_cod IS NULL OR rep_cod=? ORDER BY criado_em DESC')
    .all(repCod ? String(repCod) : null);
}
export async function addProspect({ nome, cidade, uf, cep, endereco, origem = 'manual', repCod = null, criadoPor = null, lat = null, lon = null }) {
  // Se já vier com coordenadas (ex.: descoberta Google), não re-geocodifica.
  const geo = (lat != null && lon != null) ? { lat, lon } : await geocodar({ cep, cidade, uf });
  const r = idb.prepare(`INSERT INTO prospects (nome, cidade, uf, cep, endereco, origem, rep_cod, lat, lon, criado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    nome || 'Prospect', cidade || '', uf || '', cep || '', endereco || '', origem,
    repCod ? String(repCod) : null, geo?.lat ?? null, geo?.lon ?? null, criadoPor ? String(criadoPor) : null);
  return idb.prepare('SELECT * FROM prospects WHERE id=?').get(r.lastInsertRowid);
}
export function removerProspect(id, repCod) {
  return idb.prepare('DELETE FROM prospects WHERE id=? AND (rep_cod IS NULL OR rep_cod=?)').run(id, repCod ? String(repCod) : null).changes;
}
