// Base de sugestão da coleção nova (Inverno 27 + Tropical 27) — curadoria
// oficial exportada do "Painel Famílias × Faixa de Preço 2027".
// Cada produto já vem com a FAIXA (Entrada/Médio/Premium) classificada pela
// empresa por segmento (marca × grade × tipo), família, estética (aviamentos),
// volume planejado, ABC e preços. As imagens vêm embutidas (não usa EXCIA).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', '..', 'data', 'plano_2027');

let _cache = null;
function load() {
  if (_cache) return _cache;
  try {
    const plano = JSON.parse(fs.readFileSync(path.join(DIR, 'plano.json'), 'utf-8'));
    const porCod = new Map(plano.D.map((p) => [p.cod, p]));
    _cache = { D: plano.D, CAT: plano.CAT, porCod, temImagens: fs.existsSync(path.join(DIR, 'imagens.json')) };
  } catch {
    _cache = { D: [], CAT: {}, porCod: new Map(), temImagens: false };
  }
  return _cache;
}

export function planoDisponivel() {
  return load().D.length > 0;
}

// Coleções oferecidas pelo plano (rótulo → filtro col).
export function colecoesPlano() {
  const { D } = load();
  const cols = [...new Set(D.map((p) => p.col))];
  const rot = { INVERNO: 'Inverno 2027 (plano)', TROPICAL: 'Tropical 2027 (plano)' };
  const temporada = { INVERNO: 'Inverno', TROPICAL: 'Verão' };
  return cols.map((c) => ({
    codigo: `PLANO:${c}`, col: c,
    descricao: rot[c] || `${c} 2027 (plano)`,
    temporada: temporada[c] || null,
    produtos: D.filter((p) => p.col === c).length,
  }));
}

// Produtos de uma coleção do plano (col = 'INVERNO' | 'TROPICAL').
export function produtosPlano(col) {
  return load().D.filter((p) => p.col === String(col).toUpperCase());
}

export function catPlano() {
  return load().CAT;
}

// Imagem (base64 sem prefixo) de um código do plano; carregada sob demanda.
let _imgs = null;
export function imagemPlano(cod) {
  if (!load().temImagens) return null;
  if (!_imgs) {
    try { _imgs = JSON.parse(fs.readFileSync(path.join(DIR, 'imagens.json'), 'utf-8')); } catch { _imgs = {}; }
  }
  return _imgs[cod] || null;
}
