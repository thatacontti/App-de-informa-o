// Transforma Pasta1_v0X.csv (ERP do Catarina, Latin-1, ;-delim, 21 cols)
// no formato que o HistoricalUploader do app Base44 (catarina-vibe-flow)
// aceita:
//
//   - UTF-8
//   - vírgula como delimitador
//   - 17 colunas exatas, na ordem documentada
//   - DESC_GRUPO (que não existe no Pasta1) é mapeado pra DESC_PROD
//     (que costuma ser o tipo do produto, ex: "BLUSA INF. FEM.")
//
// Uso:
//   node scripts/transform-pasta1-to-base44.mjs Pasta1_v09.csv data/base44-uploads/v09.csv
//
// Input columns (Pasta1):
//   NUMERO; DT_EMISSAO; CODCLI; NOME; NOME_CID; COD_EST; GRUPO_CLI;
//   DESC_GRUPO_CLI; CODREP; NOME_REP; PROD; DESC_PROD; DESCRICAO2;
//   DESC_MARCA; DESC_LINHA; DESC_COLECAO; DESC_ETIQUETA; DESC_COORDENADO;
//   CUSTO_IND; QTDE; VALOR_LIQ
//
// Output columns (Base44 HistoricalUploader):
//   NUMERO, DT_EMISSAO, CODCLI, NOME, DESC_MARCA, DESC_LINHA,
//   DESC_COLECAO, DESC_GRUPO, DESC_COORDENADO, PROD, DESC_PROD,
//   COD_EST, NOME_CID, NOME_REP, QTDE, VALOR_LIQ, CUSTO_IND

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('uso: node scripts/transform-pasta1-to-base44.mjs <input> <output>');
  process.exit(1);
}

const PASTA1_COLS = {
  NUMERO: 0,
  DT_EMISSAO: 1,
  CODCLI: 2,
  NOME: 3,
  NOME_CID: 4,
  COD_EST: 5,
  GRUPO_CLI: 6,
  DESC_GRUPO_CLI: 7,
  CODREP: 8,
  NOME_REP: 9,
  PROD: 10,
  DESC_PROD: 11,
  DESCRICAO2: 12,
  DESC_MARCA: 13,
  DESC_LINHA: 14,
  DESC_COLECAO: 15,
  DESC_ETIQUETA: 16,
  DESC_COORDENADO: 17,
  CUSTO_IND: 18,
  QTDE: 19,
  VALOR_LIQ: 20,
};

const OUT_HEADER = [
  'NUMERO',
  'DT_EMISSAO',
  'CODCLI',
  'NOME',
  'DESC_MARCA',
  'DESC_LINHA',
  'DESC_COLECAO',
  'DESC_GRUPO',
  'DESC_COORDENADO',
  'PROD',
  'DESC_PROD',
  'COD_EST',
  'NOME_CID',
  'NOME_REP',
  'QTDE',
  'VALOR_LIQ',
  'CUSTO_IND',
];

/** Quote field só se contiver vírgula, quote, ou newline. */
function csvQuote(v) {
  const s = String(v ?? '').trim();
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const t0 = Date.now();
const inputBytes = readFileSync(inPath);
const sizeMb = (inputBytes.length / 1024 / 1024).toFixed(1);
console.log(`▶ ${inPath} (${sizeMb} MB) → ${outPath}`);

const text = inputBytes.toString('latin1');
const lines = text.split(/\r?\n/);

const collections = new Map();
const outRows = [OUT_HEADER.join(',')];
let kept = 0;
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const f = line.split(';');
  if (f.length < 21) {
    skipped++;
    continue;
  }
  const colecao = (f[PASTA1_COLS.DESC_COLECAO] ?? '').trim();
  if (!colecao) {
    skipped++;
    continue;
  }
  collections.set(colecao, (collections.get(colecao) ?? 0) + 1);

  // Pasta1 não tem DESC_GRUPO (grupo de produto) — usa DESC_PROD como
  // proxy. O HistoricalUploader vai aceitar mesmo se DESC_GRUPO for
  // genérico ("BLUSA INF. FEM.") em vez de um enum tipo "VESTIDO".
  const descProd = (f[PASTA1_COLS.DESC_PROD] ?? '').trim();

  const out = [
    csvQuote(f[PASTA1_COLS.NUMERO]),
    csvQuote(f[PASTA1_COLS.DT_EMISSAO]),
    csvQuote(f[PASTA1_COLS.CODCLI]),
    csvQuote(f[PASTA1_COLS.NOME]),
    csvQuote(f[PASTA1_COLS.DESC_MARCA]),
    csvQuote(f[PASTA1_COLS.DESC_LINHA]),
    csvQuote(colecao),
    csvQuote(descProd), // DESC_GRUPO ← DESC_PROD (proxy)
    csvQuote(f[PASTA1_COLS.DESC_COORDENADO]),
    csvQuote(f[PASTA1_COLS.PROD]),
    csvQuote(descProd),
    csvQuote(f[PASTA1_COLS.COD_EST]),
    csvQuote(f[PASTA1_COLS.NOME_CID]),
    csvQuote(f[PASTA1_COLS.NOME_REP]),
    csvQuote(f[PASTA1_COLS.QTDE]),
    csvQuote(f[PASTA1_COLS.VALOR_LIQ]),
    csvQuote(f[PASTA1_COLS.CUSTO_IND]),
  ];
  outRows.push(out.join(','));
  kept++;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, outRows.join('\n'), 'utf8');

const ms = Date.now() - t0;
const outSizeMb = (statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`✓ ${kept.toLocaleString('pt-BR')} linhas mantidas, ${skipped} puladas em ${(ms / 1000).toFixed(1)}s`);
console.log(`  output: ${outSizeMb} MB`);
console.log('  coleções (raw):');
const sorted = [...collections.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, count] of sorted) {
  console.log(`    ${name.padEnd(30)} ${count.toLocaleString('pt-BR')}`);
}
