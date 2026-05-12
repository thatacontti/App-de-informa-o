// Sobe a tabela Categoria → Grupo pra uma Entity do Base44.
//
// Pré-requisito (manual, uma vez): criar a Entity no admin do Base44 com
// o schema:
//
//   nome:   CategoryGroupMapping  (ou outro, ajustar ENTITY_NAME abaixo)
//   campos:
//     categoria    string   (idealmente único — a chave do lookup)
//     grupo        string
//     externalId   string   (opcional — recomendado pra idempotência)
//
// Uso:
//   set BASE44_API_KEY=...
//   node upload-categoria-mapping.mjs           # DRY RUN — só relata
//   node upload-categoria-mapping.mjs --apply   # sobe os 428 registros
//
// O script é idempotente: roda quantas vezes quiser. Pra cada entrada do
// categoria-to-grupo.mjs faz upsert por externalId (gera id estável a
// partir da categoria normalizada). Já existente → PUT; novo → POST.

import { CATEGORIA_TO_GRUPO_RAW, normalizeCategoria } from './categoria-to-grupo.mjs';
import { request as httpsRequest } from 'node:https';
import { URL as NodeURL } from 'node:url';
import { createHash } from 'node:crypto';

const ENTITY_NAME = 'CategoryGroupMapping';

const env = (k, def = '') => {
  let v = process.env[k];
  if (v == null) return def;
  v = String(v).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.replace(/[\r\n]/g, '').trim();
};

const BASE44_APP_ID = env('BASE44_APP_ID', '69f3d2ea55300f3afb7e35dc');
const BASE44_API_KEY = env('BASE44_API_KEY', '<SET-VIA-ENV>');
const BASE44_SERVER_URL = env('BASE44_SERVER_URL', 'https://catarina-vibe-flow.base44.app');
const BASE44_API_ROOT = `${BASE44_SERVER_URL}/api/apps/${BASE44_APP_ID}/entities`;

const apply = process.argv.includes('--apply');

console.log(`[base44] api_key: ${BASE44_API_KEY.slice(0, 6)}...${BASE44_API_KEY.slice(-4)} (len=${BASE44_API_KEY.length})`);
console.log(`entity:  ${ENTITY_NAME}`);
console.log(`mode:    ${apply ? 'APPLY (vai gravar)' : 'DRY RUN (só relata)'}`);
console.log();

const MIN_INTERVAL_MS = 150;
let lastCall = 0;
async function throttle() {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function base44Fetch(method, path, body, attempt = 0) {
  await throttle();
  const url = new NodeURL(`${BASE44_API_ROOT}${path}`);
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    api_key: BASE44_API_KEY,
    accept: 'application/json',
    'user-agent': 'excia-mapping-upload/1.0',
  };
  if (payload) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', async () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(txt ? JSON.parse(txt) : null);
            return;
          }
          if (res.statusCode === 429 && attempt < 5) {
            const ra = parseInt(res.headers['retry-after'] || '', 10);
            const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(2000 * 2 ** attempt, 32000);
            console.log(`[base44] 429 · aguardando ${waitMs}ms (tentativa ${attempt + 1}/5)`);
            await new Promise((r) => setTimeout(r, waitMs));
            try {
              resolve(await base44Fetch(method, path, body, attempt + 1));
            } catch (e) {
              reject(e);
            }
            return;
          }
          reject(new Error(`Base44 ${res.statusCode} ${method} ${path}: ${txt.slice(0, 300)}`));
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// externalId estável a partir da categoria normalizada (mesmo input →
// mesmo id, independente de espaços/caixa), permitindo upsert seguro.
function externalIdFor(categoria) {
  const norm = normalizeCategoria(categoria);
  const hash = createHash('sha1').update(norm).digest('hex').slice(0, 16);
  return `catmap-${hash}`;
}

async function main() {
  const entries = Object.entries(CATEGORIA_TO_GRUPO_RAW);
  console.log(`total a processar: ${entries.length} entradas\n`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const [categoria, grupo] = entries[i];
    const externalId = externalIdFor(categoria);
    const payload = { categoria, grupo, externalId };

    try {
      const existing = await base44Fetch('GET', `/${ENTITY_NAME}?externalId=${encodeURIComponent(externalId)}&limit=2`);
      const found = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

      if (found) {
        if (found.categoria === categoria && found.grupo === grupo) {
          unchanged++;
        } else {
          if (apply) {
            await base44Fetch('PUT', `/${ENTITY_NAME}/${found.id}`, payload);
          }
          updated++;
        }
      } else {
        if (apply) {
          await base44Fetch('POST', `/${ENTITY_NAME}`, payload);
        }
        created++;
      }
    } catch (e) {
      errors++;
      console.error(`[err] ${categoria}: ${e.message}`);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`[upload] ${i + 1}/${entries.length} · novos=${created} alter=${updated} iguais=${unchanged} err=${errors}`);
    }
  }

  console.log('\n═══ Resumo ═══');
  console.log(`total entradas:   ${entries.length}`);
  console.log(`${apply ? 'criados' : 'a criar'}:          ${created}`);
  console.log(`${apply ? 'atualizados' : 'a atualizar'}:      ${updated}`);
  console.log(`já iguais:        ${unchanged}`);
  console.log(`erros:            ${errors}`);

  if (!apply && (created > 0 || updated > 0)) {
    console.log('\n→ pra aplicar de verdade:  node upload-categoria-mapping.mjs --apply');
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
