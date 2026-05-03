// Splita um CSV em N partes preservando o cabeçalho em cada uma.
//
// Uso:
//   node scripts/split-csv.mjs <input.csv> <outdir> <chunkSize>
//
// chunkSize = registros por arquivo (não conta o cabeçalho).
// Output: outdir/<basename>-pt1.csv, pt2.csv, ...

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const [, , inPath, outDir, chunkArg] = process.argv;
if (!inPath || !outDir || !chunkArg) {
  console.error('uso: node scripts/split-csv.mjs <input.csv> <outdir> <chunkSize>');
  process.exit(1);
}
const chunkSize = parseInt(chunkArg, 10);
if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
  console.error('chunkSize precisa ser inteiro > 0');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const text = readFileSync(inPath, 'utf8');
const lines = text.split(/\r?\n/);
const header = lines[0];
const rows = lines.slice(1).filter((l) => l.length > 0);

const stem = basename(inPath, extname(inPath));
const total = rows.length;
let part = 0;

console.log(`▶ ${inPath} (${total.toLocaleString('pt-BR')} linhas) → chunks de ${chunkSize.toLocaleString('pt-BR')}`);

for (let i = 0; i < total; i += chunkSize) {
  part++;
  const slice = rows.slice(i, i + chunkSize);
  const out = [header, ...slice].join('\n');
  const outPath = join(outDir, `${stem}-pt${part}.csv`);
  writeFileSync(outPath, out, 'utf8');
  const sizeMb = (statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`  pt${part}: ${slice.length.toLocaleString('pt-BR')} linhas, ${sizeMb} MB → ${outPath}`);
}

console.log(`✓ ${part} parte(s) gerada(s)`);
