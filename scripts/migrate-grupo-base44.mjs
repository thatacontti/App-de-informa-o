// Migração de Grupo no Base44 — aplica o de/para de categoria-to-grupo.mjs
// em todos os Sales já gravados no app.
//
// Uso:
//   set BASE44_API_KEY=...                 (mesmo da sync)
//   node migrate-grupo-base44.mjs          # DRY RUN — só relata
//   node migrate-grupo-base44.mjs --apply  # aplica as alterações
//
// O script:
//   1. Paginar todos os Sales do app (limit=200 por página)
//   2. Pra cada um, calcula o grupo canônico a partir do campo `g` atual
//   3. Se diferente, faz PUT (só se --apply); senão pula
//   4. Imprime resumo: total · alterados · iguais · não-mapeados
//
// O modo DRY RUN também gera um CSV `nao-mapeados.csv` com as Categorias
// que apareceram nos dados mas não estão no de/para — pra ampliar a tabela.

import { mapCategoriaToGrupo, isMapped } from './categoria-to-grupo.mjs';
import { request as httpsRequest } from 'node:https';
import { URL as NodeURL } from 'node:url';
import { writeFileSync } from 'node:fs';

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
const pageSize = 200;

console.log(`[base44] api_key carregada: ${BASE44_API_KEY.slice(0, 6)}...${BASE44_API_KEY.slice(-4)} (len=${BASE44_API_KEY.length})`);
console.log(`mode:    ${apply ? 'APPLY (vai gravar)' : 'DRY RUN (só relata)'}`);
console.log();

// Throttle + retry — mesma estratégia do agent
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
    'user-agent': 'excia-migrate/1.0',
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

async function main() {
  let skip = 0;
  let total = 0;
  let changed = 0;
  let unchanged = 0;
  let errors = 0;
  const unmapped = new Map(); // categoria → count

  console.log('[1/1] varrendo Sales...\n');

  while (true) {
    const batch = await base44Fetch('GET', `/Sale?limit=${pageSize}&skip=${skip}`);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const sale of batch) {
      total++;
      const current = sale.g || '';
      if (!current) {
        unchanged++;
        continue;
      }

      const canonical = mapCategoriaToGrupo(current);
      if (canonical === current) {
        unchanged++;
        if (!isMapped(current)) {
          unmapped.set(current, (unmapped.get(current) || 0) + 1);
        }
        continue;
      }

      if (apply) {
        try {
          await base44Fetch('PUT', `/Sale/${sale.id}`, { g: canonical });
          changed++;
        } catch (e) {
          errors++;
          console.error(`[err] ${sale.id}: ${e.message}`);
        }
      } else {
        changed++;
      }

      if (changed % 50 === 0 && changed > 0) {
        console.log(`[migrate] ${total} processados · ${changed} ${apply ? 'alterados' : 'a alterar'} · ${errors} erros`);
      }
    }

    skip += batch.length;
    if (batch.length < pageSize) break;
  }

  console.log('\n═══ Resumo ═══');
  console.log(`total sales:      ${total}`);
  console.log(`${apply ? 'alterados' : 'a alterar'}:        ${changed}`);
  console.log(`já canônicos:     ${unchanged}`);
  console.log(`erros:            ${errors}`);
  console.log(`não-mapeados:     ${unmapped.size} categorias distintas`);

  if (unmapped.size > 0) {
    const rows = [...unmapped.entries()].sort((a, b) => b[1] - a[1]);
    const csv = 'categoria,ocorrencias\n' + rows.map(([k, v]) => `"${k.replace(/"/g, '""')}",${v}`).join('\n') + '\n';
    writeFileSync('nao-mapeados.csv', csv);
    console.log(`\nnão-mapeados salvos em nao-mapeados.csv (top 10):`);
    for (const [k, v] of rows.slice(0, 10)) {
      console.log(`  ${String(v).padStart(5)}x  ${k}`);
    }
  }

  if (!apply && changed > 0) {
    console.log('\n→ pra aplicar de verdade:  node migrate-grupo-base44.mjs --apply');
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
