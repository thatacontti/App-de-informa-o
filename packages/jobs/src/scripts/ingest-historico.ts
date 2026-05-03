// One-shot histórico CSV ingestion.
//
// Lê os arquivos `Pasta1_v*.csv` (Latin-1, ;-delimitado) e popula
// Sale/Customer/Product/City/Representative no Postgres. Idempotente:
// re-rodar com a mesma base não duplica linhas (externalId determinístico).
//
// Uso:
//   pnpm --filter @painel/jobs exec tsx src/scripts/ingest-historico.ts \
//     ../../Pasta1_v*.csv
//
// Variáveis:
//   DATABASE_URL              — postgres conn string (obrigatório)
//   INGEST_DRY_RUN=1          — apenas parseia e imprime estatísticas

import { readdirSync, statSync } from 'node:fs';
import { resolve, basename, isAbsolute, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CsvHistoricoConnector } from '@painel/connectors';
import { upsertSales } from '../adapter/upsert-sales';

const SOURCE = 'CSV_HISTORICO';

interface FileSummary {
  file: string;
  rowsParsed: number;
  collections: string[];
  recordsOut: number;
  newCustomers: number;
  newProducts: number;
  newCities: number;
  newReps: number;
  durationMs: number;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'Uso: tsx src/scripts/ingest-historico.ts <arquivo|diretorio> [arquivo ...]',
    );
    process.exit(1);
  }

  const files = expandArgs(args);
  if (files.length === 0) {
    console.error('Nenhum arquivo .csv encontrado nos paths informados.');
    process.exit(1);
  }

  console.log(`encontrados ${files.length} CSV(s) para ingestão:`);
  for (const f of files) console.log(`  - ${f}`);

  const dryRun = process.env['INGEST_DRY_RUN'] === '1';
  if (dryRun) console.log('\n[DRY RUN] não vai gravar no banco.\n');

  const db = dryRun ? null : new PrismaClient();
  const summaries: FileSummary[] = [];

  for (const file of files) {
    const t0 = Date.now();
    console.log(`\n→ ${basename(file)}`);
    const connector = new CsvHistoricoConnector({ filePath: file });
    const sales = await connector.extract(new Date(0));
    const collections = [...new Set(sales.map((s) => s.collection))].sort();
    console.log(`  parsed: ${sales.length.toLocaleString('pt-BR')} linhas`);
    console.log(`  coleções: ${collections.join(', ')}`);

    let upsert = { recordsOut: 0, newCustomers: 0, newProducts: 0, newCities: 0, newReps: 0 };
    if (db) {
      const r = await upsertSales(db, SOURCE, sales);
      upsert = r;
      console.log(
        `  upserted: ${r.recordsOut.toLocaleString('pt-BR')} sales · ${r.newCustomers} clientes · ` +
          `${r.newProducts} produtos · ${r.newCities} cidades · ${r.newReps} reps`,
      );
    }

    const ms = Date.now() - t0;
    console.log(`  ✓ ${(ms / 1000).toFixed(1)}s`);

    summaries.push({
      file,
      rowsParsed: sales.length,
      collections,
      ...upsert,
      durationMs: ms,
    });
  }

  if (db) await db.$disconnect();

  // ---- summary ----
  const totalRows = summaries.reduce((s, x) => s + x.rowsParsed, 0);
  const totalOut = summaries.reduce((s, x) => s + x.recordsOut, 0);
  const totalMs = summaries.reduce((s, x) => s + x.durationMs, 0);
  const allCollections = [
    ...new Set(summaries.flatMap((s) => s.collections)),
  ].sort();
  console.log('\n========== resumo ==========');
  console.log(`arquivos:    ${summaries.length}`);
  console.log(`linhas:      ${totalRows.toLocaleString('pt-BR')}`);
  console.log(`upserted:    ${totalOut.toLocaleString('pt-BR')}`);
  console.log(`tempo total: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`coleções:    ${allCollections.length}`);
  for (const c of allCollections) console.log(`             · ${c}`);
}

/** Expande args (arquivos ou diretórios) em uma lista de caminhos absolutos. */
function expandArgs(args: string[]): string[] {
  const out: string[] = [];
  for (const a of args) {
    const abs = isAbsolute(a) ? a : resolve(process.cwd(), a);
    let s;
    try {
      s = statSync(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      for (const f of readdirSync(abs)) {
        if (f.toLowerCase().endsWith('.csv')) out.push(join(abs, f));
      }
    } else if (s.isFile() && abs.toLowerCase().endsWith('.csv')) {
      out.push(abs);
    }
  }
  return [...new Set(out)].sort();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
