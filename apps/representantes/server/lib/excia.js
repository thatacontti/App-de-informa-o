// Integração Excia (ERP) — vendas + status de coleção.
//
// A API do Excia só responde na LAN da empresa (192.168.1.6:211).
//   - EXCIA_MODE=file  (default no VPS): lê o último export processado
//                       (data/colecao_data.json + banco já semeado).
//   - EXCIA_MODE=live  (dentro da rede): puxa /PedidoLista e agrega V27.
//
// Rodar sync manual:  node server/lib/excia.js --sync --since 01/01/2026
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpsRequest } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const EXCIA_MODE = process.env.EXCIA_MODE || 'file';
const EXCIA_BASE = process.env.EXCIA_BASE || 'http://192.168.1.6:211';
const EXCIA_TOKEN = process.env.EXCIA_TOKEN || '';
const COLECAO_FILE = process.env.EXCIA_COLECAO_FILE ||
  path.join(__dirname, '..', '..', 'data', 'colecao_data.json');

// Mapa Excia → código de coleção (mesmo padrão do scripts/excia-agent.mjs).
export const COLECAO_MAP = {
  '14': 'V20', '15': 'I20', '16': 'V21', '17': 'I21',
  '22': 'V22', '23': 'V22', '24': 'I22', '25': 'V23', '26': 'V23', '27': 'I23',
  '28': 'V24', '29': 'V24', '30': 'I24', '31': 'V25', '32': 'V25', '33': 'I25', '34': 'T25',
  '36': 'V26', '37': 'V26', '38': 'I26', '39': 'T26', '40': 'V27', '41': 'V27',
};
// Coleção corrente da campanha (Verão 2027).
export const COLECAO_ATUAL = 'V27';
const CODIGOS_ATUAIS = Object.entries(COLECAO_MAP)
  .filter(([, c]) => c === COLECAO_ATUAL).map(([k]) => k);

// Config de campanha (dia X de N). Sobreponível por env.
const DIA_CAMPANHA = Number(process.env.EXCIA_DIA_CAMPANHA || 63);
const TOTAL_DIAS = Number(process.env.EXCIA_TOTAL_DIAS || 150);

// ---------- status de coleção (usado pela plataforma) ----------
export function getColecaoStatus() {
  let prod = { shares: {}, fatTotal: 0, pcsTotal: 0, skusVendidos: 0, top: [] };
  try {
    prod = JSON.parse(fs.readFileSync(COLECAO_FILE, 'utf-8'));
  } catch (e) {
    console.warn('[excia] colecao_data.json ausente:', e.message);
  }
  return { ...prod, dia: DIA_CAMPANHA, totDias: TOTAL_DIAS, colecao: COLECAO_ATUAL, mode: EXCIA_MODE };
}

// ---------- HTTP Excia (LAN) ----------
function exciaGet(pathname, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = new URL(`${EXCIA_BASE}${pathname}${qs ? '?' + qs : ''}`);
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      { method: 'GET', hostname: url.hostname, port: url.port || 80,
        path: url.pathname + url.search, headers: { token: EXCIA_TOKEN }, timeout: 8000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(txt ? JSON.parse(txt) : null);
          else reject(new Error(`Excia ${res.statusCode} ${pathname}: ${txt.slice(0, 200)}`));
        });
      });
    req.on('timeout', () => req.destroy(new Error('Excia timeout (LAN inacessível)')));
    req.on('error', reject);
    req.end();
  });
}

async function paginate(pathname, baseParams = {}) {
  const all = [];
  let pagina = 1;
  while (true) {
    const page = await exciaGet(pathname, { ...baseParams, pagina });
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < 300) break;
    pagina++;
  }
  return all;
}

export async function pingExcia() {
  if (EXCIA_MODE !== 'live') return { ok: false, mode: EXCIA_MODE, reason: 'modo file' };
  try {
    await exciaGet('/ProdutoLista', { data: '01/01/2019', pagina: 1 });
    return { ok: true, mode: 'live' };
  } catch (e) {
    return { ok: false, mode: 'live', reason: e.message };
  }
}

/**
 * Sync ao vivo (dentro da LAN): puxa pedidos da coleção corrente,
 * atualiza o histórico V27 por cliente no banco e regenera o
 * colecao_data.json (fatTotal/pcs/skus/top). Registra uma carga.
 */
export async function syncLive({ since, db } = {}) {
  if (EXCIA_MODE !== 'live') {
    return { ok: false, skipped: true, reason: `EXCIA_MODE=${EXCIA_MODE} (sync ao vivo desabilitado)` };
  }
  const desde = since || defaultSince();
  const produtos = await paginate('/ProdutoLista', { data: '01/01/2019' });
  const prodByCod = new Map(produtos.map((p) => [String(p.codigo), p]));
  const pedidos = await paginate('/PedidoLista', { alteracao: desde });

  const porCliente = new Map();   // codcli -> fat V27
  const porSku = new Map();       // codigo -> {q, f, prod}
  let fatTotal = 0, pcsTotal = 0;

  for (const ped of pedidos) {
    if (!CODIGOS_ATUAIS.includes(String(ped.colecao || ''))) continue;
    const detail = await exciaGet('/BuscarPedido', { numero: ped.numero });
    const d = (Array.isArray(detail) ? detail[0] : detail) || {};
    for (const item of d.itens || []) {
      const q = Number(item.qtde || item.faturado || 0);
      const f = Number(item.preco || 0) * q;
      fatTotal += f; pcsTotal += q;
      porCliente.set(String(ped.codcli), (porCliente.get(String(ped.codcli)) || 0) + f);
      const cur = porSku.get(String(item.codigo)) || { q: 0, f: 0, prod: prodByCod.get(String(item.codigo)) || {} };
      cur.q += q; cur.f += f;
      porSku.set(String(item.codigo), cur);
    }
  }

  // atualiza histórico V27 por cliente
  if (db) {
    const upd = db.transaction(() => {
      for (const [codcli, fat] of porCliente) {
        db.prepare('DELETE FROM historico WHERE codcli=? AND colecao_id=?').run(codcli, COLECAO_ATUAL);
        db.prepare(`INSERT INTO historico (codcli, marca, colecao_id, colecao, ordem, valor)
          VALUES (?, 'TOTAL', ?, 'Verão 2027', 5, ?)`).run(codcli, COLECAO_ATUAL, fat);
      }
      db.prepare(`INSERT INTO cargas (data, responsavel, fonte, total_fat, n_clientes, status)
        VALUES (datetime('now'), 'excia:live', 'PedidoLista', ?, ?, 'publicada')`)
        .run(fatTotal, porCliente.size);
    });
    upd();
  }

  // regenera status de coleção (top por faturamento)
  const top = [...porSku.entries()]
    .map(([sku, v]) => ({
      sku, tipo: v.prod.grupo || v.prod.descricao || '', marca: v.prod.marca || '',
      linha: v.prod.linha || '', cartela: v.prod.coordenado || '',
      faixa: v.prod.faixa || '—', q: v.q, f: v.f, img: '',
    }))
    .sort((a, b) => b.f - a.f).slice(0, 24);

  const status = { shares: {}, fatTotal, pcsTotal, skusVendidos: porSku.size, top };
  fs.writeFileSync(COLECAO_FILE, JSON.stringify(status), 'utf-8');

  return { ok: true, pedidos: pedidos.length, clientes: porCliente.size, skus: porSku.size, fatTotal };
}

function defaultSince() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Execução direta
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : f; };
  if (process.argv.includes('--ping')) {
    pingExcia().then((r) => { console.log('[excia] ping:', r); process.exit(r.ok ? 0 : 1); });
  } else if (process.argv.includes('--sync')) {
    const { db } = await import('../db.js');
    syncLive({ since: arg('since'), db })
      .then((r) => { console.log('[excia] sync:', r); process.exit(0); })
      .catch((e) => { console.error('[excia] FATAL:', e.message); process.exit(1); });
  } else {
    console.log('uso: node server/lib/excia.js [--ping | --sync --since dd/mm/aaaa]');
  }
}
