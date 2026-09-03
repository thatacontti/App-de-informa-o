// Gera os dados do Catálogo de Produtos por coleção (produto × cor × imagem).
// Rodar NO VPS (onde db/analitico.sqlite já foi sincronizado da EXCIA):
//
//   cd apps/representantes && node scripts/gerar-catalogo.mjs
//
// Emite, em data/catalogo/, um JSON + CSV por coleção pedida. Sem argumentos,
// gera Inverno 2027 e Tropical 2027; ou passe alvos: `node scripts/gerar-catalogo.mjs Inverno:2027 Tropical:2027`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverColecoes, linhasCatalogo, paraCSV, listarColecoes } from '../server/lib/catalogoProdutos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'catalogo');
fs.mkdirSync(OUT, { recursive: true });

const alvos = (process.argv.slice(2).length ? process.argv.slice(2) : ['Inverno:2027', 'Tropical:2027'])
  .map((a) => { const [temporada, ano] = a.split(':'); return { temporada, ano: Number(ano) }; });

console.log('Coleções catalogadas na base:');
for (const c of listarColecoes()) console.log(`  ${c.codigo}\t${c.descricao}\t[${c.temporada || '?'} ${c.ano || '?'}]`);
console.log('');

for (const alvo of alvos) {
  const cols = resolverColecoes(alvo);
  const slug = `${alvo.temporada}_${alvo.ano}`.replace(/\W+/g, '_');
  if (!cols.length) {
    console.warn(`⚠ ${alvo.temporada} ${alvo.ano}: nenhuma coleção correspondente na base — pulei.`);
    continue;
  }
  const r = linhasCatalogo({ colecoes: new Set(cols.map((c) => c.codigo)), corAtiva: false });
  fs.writeFileSync(path.join(OUT, `catalogo_${slug}.json`),
    JSON.stringify({ colecoes: cols, gerado_em: new Date().toISOString(), metricas: r.metricas, alertas: r.alertas, linhas: r.linhas }, null, 2));
  fs.writeFileSync(path.join(OUT, `catalogo_${slug}.csv`), '﻿' + paraCSV(r.linhas));
  console.log(`✅ ${alvo.temporada} ${alvo.ano} → coleções ${cols.map((c) => c.codigo).join(',')} · ${r.metricas.qtd_produtos} produtos · ${r.metricas.qtd_linhas} linhas (produto×cor) · cobertura imagem ${r.metricas.pct_cobertura_imagem ?? '—'}%`);
  console.log(`   arquivos: data/catalogo/catalogo_${slug}.json e .csv`);
}
