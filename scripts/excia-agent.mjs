// Agent Excia → Base44.
//
// Roda dentro da rede da empresa (acesso a 192.168.1.6:211).
// Lê pedidos do Excia API e faz upsert na entidade Sale do Base44.
//
// Uso:
//   1. Instala Node 20+ (https://nodejs.org)
//   2. cd <pasta deste arquivo>
//   3. npm install @base44/sdk
//   4. Edita as ENV vars abaixo (ou cria .env)
//   5. node excia-agent.mjs --since 01/01/2026
//
// Pra rodar todo dia: agendar no Task Scheduler do Windows
// (acao: node excia-agent.mjs ; horário: 02:00 diário)

import { createClient } from '@base44/sdk';

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const EXCIA_BASE = process.env.EXCIA_BASE || 'http://192.168.1.6:211';
const EXCIA_TOKEN = process.env.EXCIA_TOKEN || '00EE2138AB67015BED838EC09E55C6A9';

const BASE44_APP_ID = process.env.BASE44_APP_ID || '69f3d2ea55300f3afb7e35dc';
const BASE44_API_KEY = process.env.BASE44_API_KEY || '<SET-VIA-ENV>';
const BASE44_SERVER_URL = process.env.BASE44_SERVER_URL || 'https://catarina-vibe-flow.base44.app';

// Mapeamento Excia → Base44 collection codes (mesmo padrão usado nos
// CSVs históricos: PRIMAVERA + VERÃO colapsam num único Vyy).
const COLECAO_MAP = {
  '14': 'V20', '15': 'I20',
  '16': 'V21', '17': 'I21',
  '22': 'V22', '23': 'V22', '24': 'I22',
  '25': 'V23', '26': 'V23', '27': 'I23',
  '28': 'V24', '29': 'V24', '30': 'I24',
  '31': 'V25', '32': 'V25', '33': 'I25', '34': 'T25',
  '36': 'V26', '37': 'V26', '38': 'I26', '39': 'T26',
  '40': 'V27', '41': 'V27',
};

const SALE_SOURCE = 'EXCIA_API_LIVE';

// ═══════════════════════════════════════════════════════════════════
// ARGS
// ═══════════════════════════════════════════════════════════════════

function readArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const since = readArg('since', defaultSinceDate());
const dryRun = process.argv.includes('--dry-run');

function defaultSinceDate() {
  // Default: ontem
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════
// EXCIA HTTP
// ═══════════════════════════════════════════════════════════════════

async function exciaGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${EXCIA_BASE}${path}${qs ? '?' + qs : ''}`;
  let attempt = 0;
  while (attempt < 5) {
    const res = await fetch(url, { headers: { token: EXCIA_TOKEN } });
    if (res.status === 429) {
      const retry = parseInt(res.headers.get('Retry-After') || '2000');
      console.log(`[excia] rate limit, aguardando ${retry}ms...`);
      await new Promise((r) => setTimeout(r, retry));
      attempt++;
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Excia ${res.status} ${path}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  }
  throw new Error(`Excia rate limit excedido após 5 retries em ${path}`);
}

async function paginate(path, baseParams = {}) {
  const all = [];
  let pagina = 1;
  while (true) {
    const page = await exciaGet(path, { ...baseParams, pagina });
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    process.stdout.write(`\r[excia] ${path}: ${all.length} registros...`);
    if (page.length < 300) break; // última página
    pagina++;
  }
  console.log(); // newline
  return all;
}

// ═══════════════════════════════════════════════════════════════════
// BASE44
// ═══════════════════════════════════════════════════════════════════

const base44 = createClient({
  appId: BASE44_APP_ID,
  serverUrl: BASE44_SERVER_URL,
  apiKey: BASE44_API_KEY,
  requiresAuth: false,
});

async function upsertSale(externalId, data) {
  const existing = await base44.entities.Sale.filter({ externalId });
  if (existing && existing.length > 0) {
    return base44.entities.Sale.update(existing[0].id, data);
  }
  return base44.entities.Sale.create({ externalId, ...data });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const t0 = Date.now();
  console.log('═══ Excia Agent ═══');
  console.log(`base:    ${EXCIA_BASE}`);
  console.log(`since:   ${since}`);
  console.log(`dryRun:  ${dryRun}`);
  console.log();

  // 1. Pre-load dimensões
  // /ProdutoLista e /EntidadeLista exigem `data` (não `alteracao` — esse é
  // só do /PedidoLista). Usa data muito antiga pra pegar o snapshot completo.
  const SNAPSHOT_DATE = '01/01/2019';

  console.log('[step 1/3] preload produtos...');
  const produtos = await paginate('/ProdutoLista', { data: SNAPSHOT_DATE });
  const produtosByCodigo = new Map(produtos.map((p) => [String(p.codigo), p]));
  console.log(`           ${produtosByCodigo.size} produtos cacheados`);

  console.log('[step 2/3] preload clientes...');
  const clientes = await paginate('/EntidadeLista', { data: SNAPSHOT_DATE });
  const clientesByCodcli = new Map(clientes.map((c) => [String(c.codcli), c]));
  console.log(`           ${clientesByCodcli.size} clientes cacheados`);

  // 2. Pedidos
  console.log(`\n[step 3/3] pedidos com alteracao >= ${since}...`);
  const pedidos = await paginate('/PedidoLista', { alteracao: since });
  console.log(`           ${pedidos.length} pedidos a processar\n`);

  let saleCreated = 0;
  let saleUpdated = 0;
  let skipColecao = 0;
  let errors = 0;

  for (let i = 0; i < pedidos.length; i++) {
    const ped = pedidos[i];
    const colecao = String(ped.colecao || '');
    const collectionCode = COLECAO_MAP[colecao];
    if (!collectionCode) {
      skipColecao++;
      continue;
    }

    try {
      const raw = await exciaGet('/BuscarPedido', { numero: ped.numero });
      const detail = (Array.isArray(raw) ? raw[0] : raw) || {};
      const cli = clientesByCodcli.get(String(ped.codcli)) || {};
      for (const item of detail.itens || []) {
        const prod = produtosByCodigo.get(String(item.codigo)) || {};
        const qty = Number(item.qtde || item.faturado || 0);
        const price = Number(item.preco || 0);
        const externalId = `excia-${ped.numero}-${item.codigo}-${item.cor || ''}-${item.tam || ''}`;
        const data = {
          p: item.codigo,
          dp: prod.descricao || '',
          m: prod.marca || '',
          l: prod.linha || '',
          g: prod.grupo || '',
          co: prod.coordenado || '',
          uf: cli.uf || '',
          cid: cli.cidade || '',
          c: ped.codcli,
          nm: ped.nome || '',
          rp: ped.nome_rep || '',
          pf: '',
          q: qty,
          f: price * qty,
          ct: Number(prod.custo || 0),
          cu: Number(prod.custo || 0),
          fx: '',
          est: prod.estilista || '',
          collectionCode,
          source: SALE_SOURCE,
          frozen: false,
          importBatchId: `excia-agent-${new Date().toISOString().slice(0, 10)}`,
        };
        if (!dryRun) {
          const existing = await base44.entities.Sale.filter({ externalId });
          if (existing && existing.length > 0) {
            await base44.entities.Sale.update(existing[0].id, data);
            saleUpdated++;
          } else {
            await base44.entities.Sale.create({ externalId, ...data });
            saleCreated++;
          }
        } else {
          saleCreated++;
        }
      }
    } catch (e) {
      errors++;
      console.error(`\n[err] pedido ${ped.numero}: ${e.message}`);
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(
        `\r[sync] ${i + 1}/${pedidos.length} · created=${saleCreated} updated=${saleUpdated} err=${errors}`,
      );
    }
  }

  console.log();
  console.log('\n═══ Resumo ═══');
  console.log(`pedidos lidos:     ${pedidos.length}`);
  console.log(`Sale criados:      ${saleCreated}`);
  console.log(`Sale atualizados:  ${saleUpdated}`);
  console.log(`skip por coleção:  ${skipColecao}`);
  console.log(`erros:             ${errors}`);
  console.log(`tempo total:       ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (dryRun) console.log('\n⚠️ DRY RUN — nada foi gravado no Base44');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\nFATAL:', e);
    process.exit(1);
  });
