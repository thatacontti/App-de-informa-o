// Peek Base44 — explora o app conectado via SDK pra descobrir schema
// das entidades. Não toca no banco; só lê e imprime amostras.
//
// Uso:
//   BASE44_APP_ID=... BASE44_API_KEY=... \
//     pnpm --filter @painel/jobs run peek:base44 <EntityName> [--limit=5]
//
// Sem nome de entidade: tenta listar entidades comuns (Sale, Order,
// Customer, Product, Pedido, Cliente, Produto, Venda) e reporta quais
// existem.

import { createClient } from '@base44/sdk';

const COMMON_ENTITIES = [
  'Sale',
  'Sales',
  'Order',
  'Orders',
  'Customer',
  'Customers',
  'Product',
  'Products',
  'Deal',
  'Pedido',
  'Cliente',
  'Produto',
  'Venda',
];

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const appId = process.env['BASE44_APP_ID'];
  const apiKey = process.env['BASE44_API_KEY'];
  if (!appId || !apiKey) {
    console.error('faltando env: BASE44_APP_ID e BASE44_API_KEY são obrigatórios.');
    process.exit(1);
  }

  const entityName = process.argv[2];
  const limit = Number(readArg('limit') ?? '5');

  const serverUrl = process.env['BASE44_SERVER_URL'];
  const client = createClient({
    appId,
    headers: { api_key: apiKey },
    ...(serverUrl ? { serverUrl } : {}),
  });
  const entities = client.entities as unknown as Record<
    string,
    | { list: (sort?: string, limit?: number) => Promise<unknown[]> }
    | undefined
  >;

  if (!entityName) {
    console.log('▶ varrendo nomes de entidades comuns...\n');
    for (const name of COMMON_ENTITIES) {
      const handler = entities[name];
      if (!handler) {
        console.log(`  ${name.padEnd(12)} : não existe (handler ausente)`);
        continue;
      }
      try {
        const sample = (await handler.list(undefined, 1)) as unknown[];
        console.log(`  ${name.padEnd(12)} : ✓ existe · ${sample.length} registro na primeira página`);
      } catch (e) {
        console.log(`  ${name.padEnd(12)} : ✗ ${(e as Error).message}`);
      }
    }
    console.log(
      `\nrode novamente passando o nome:  pnpm --filter @painel/jobs run peek:base44 <NOME> [--limit=N]`,
    );
    return;
  }

  const handler = entities[entityName];
  if (!handler) {
    console.error(`entidade '${entityName}' não tem handler no SDK.`);
    process.exit(1);
  }

  console.log(`▶ ${entityName} · primeiros ${limit} registros\n`);
  const rows = (await handler.list(undefined, limit)) as Record<string, unknown>[];
  if (rows.length === 0) {
    console.log('(vazio)');
    return;
  }

  console.log('--- amostra (JSON pretty) ---');
  console.log(JSON.stringify(rows, null, 2));

  console.log('\n--- inferência de schema (primeiro registro) ---');
  const first = rows[0]!;
  const cols = Object.entries(first).map(([k, v]) => ({
    field: k,
    type: typeofValue(v),
    sample: previewValue(v),
  }));
  cols.sort((a, b) => a.field.localeCompare(b.field));
  for (const c of cols) {
    console.log(`  ${c.field.padEnd(28)} ${c.type.padEnd(10)} ${c.sample}`);
  }
}

function typeofValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}]`;
  if (v instanceof Date) return 'date';
  return typeof v;
}

function previewValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v.length > 60 ? v.slice(0, 60) + '…' : v}"`;
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}

main()
  .then(() => process.exit(0)) // SDK abre socket.io e mantém event loop vivo
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
