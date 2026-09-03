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
function cepDoCliente(codcli) {
  const c = idb.prepare('SELECT raw FROM clientes_ex WHERE codcli=?').get(String(codcli));
  if (!c?.raw) return null;
  try { return soDigitos(JSON.parse(c.raw).cep) || null; } catch { return null; }
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
    const cep = cepDoCliente(c.codcli);
    const geo = cep && cep.length === 8 ? getCache(`cep:${cep}`)
      : (c.cidade ? getCache(`cid:${norm(c.cidade)}|${norm(c.uf)}`) : null);
    return {
      codcli: c.codcli, nome: c.nome, cidade: c.cidade, uf: c.uf,
      cep: cep || null, tipo: 'cliente',
      lat: geo?.ok ? geo.lat : null, lon: geo?.ok ? geo.lon : null,
    };
  });
}

// Geocodifica em lote os pontos ainda sem coordenada (cap por chamada).
export async function geocodarPendentes(pontos, limite = 40) {
  let feitos = 0;
  for (const p of pontos) {
    if (p.lat != null || feitos >= limite) continue;
    const r = await geocodar({ cep: p.cep, cidade: p.cidade, uf: p.uf });
    if (r) { p.lat = r.lat; p.lon = r.lon; feitos++; }
    else feitos++; // conta a tentativa (cache negativo evita repetir)
  }
  return feitos;
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
