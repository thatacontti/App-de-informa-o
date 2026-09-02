// Gera o Catálogo de Produtos por coleção em .xlsx (uma aba por coleção),
// do cadastro EXCIA já sincronizado. Rodar no VPS:
//   cd apps/representantes && node scripts/gerar-catalogo-xlsx.mjs
// Sem args: Inverno 2027 + Tropical 2027. Ou: node scripts/gerar-catalogo-xlsx.mjs Inverno:2027 Tropical:2027
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverColecoes, linhasCatalogo } from '../server/lib/catalogoProdutos.js';
import { buildXlsx } from '../server/lib/xlsx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'catalogo');
fs.mkdirSync(OUT, { recursive: true });

const HEAD = ['Referência', 'Código EXCIA', 'Descrição', 'Marca', 'Coleção', 'Cód. Cor', 'Cor', 'Cor Ativa', 'Status', 'Possui Imagem', 'Preço Tabela'];
const linha = (l) => [l.referencia, l.codigo, l.descricao, l.marca, l.colecao, l.cor, l.desc_cor, l.cor_ativa, l.status, l.possui_imagem === 'Sim' ? 'Sim' : (l.possui_imagem === 'Não' ? 'Não' : 'a resolver'), Number(l.preco_tabela || 0)];

const alvos = (process.argv.slice(2).length ? process.argv.slice(2) : ['Inverno:2027', 'Tropical:2027'])
  .map((a) => { const [temporada, ano] = a.split(':'); return { temporada, ano: Number(ano) }; });

const sheets = [];
for (const alvo of alvos) {
  const cols = resolverColecoes(alvo);
  if (!cols.length) { console.warn(`⚠ ${alvo.temporada} ${alvo.ano}: sem coleção correspondente`); continue; }
  const r = linhasCatalogo({ colecoes: new Set(cols.map((c) => c.codigo)), corAtiva: false });
  const rows = r.linhas.slice().sort((a, b) => (a.marca + a.referencia).localeCompare(b.marca + b.referencia, 'pt')).map(linha);
  sheets.push({ name: `${alvo.temporada} ${alvo.ano}`, header: HEAD, rows });
  console.log(`${alvo.temporada} ${alvo.ano} -> ${cols.map((c) => c.codigo).join(',')} · ${r.metricas.qtd_produtos} produtos, ${r.metricas.qtd_linhas} linhas`);
}
if (sheets.length) {
  const dest = path.join(OUT, 'Catalogo_' + alvos.map((a) => a.temporada + a.ano).join('_') + '.xlsx');
  fs.writeFileSync(dest, buildXlsx(sheets));
  console.log('xlsx:', dest);
}
