// API do Catálogo de Produtos por Coleção (produto × cor × imagem).
// Segurança: dado de catálogo (não é PII de cliente) — qualquer usuário
// autenticado consulta; o token EXCIA nunca sai do backend.
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { idb } from '../lib/intelDb.js';
import { exciaGet, exciaConfigurado } from '../lib/exciaClient.js';
import {
  resolverColecoes, listarColecoes, linhasCatalogo, detalheProduto, paraCSV,
} from '../lib/catalogoProdutos.js';

export const catalogo = Router();
catalogo.use(requireAuth);

function montarFiltro(q) {
  const cols = resolverColecoes({
    colecao: q.colecao || undefined,
    temporada: q.temporada || undefined,
    ano: q.ano ? Number(q.ano) : undefined,
  });
  const filtro = {
    colecoes: new Set(cols.map((c) => c.codigo)),
    q: q.q || '',
    corAtiva: q.corAtiva === 'todas' ? false : true,
    comImagem: q.comImagem === 'com' || q.comImagem === 'sem' ? q.comImagem : null,
    cor: q.cor || '',
    status: q.status || '',
  };
  return { cols, filtro };
}

// GET /api/catalogo?temporada=Inverno&ano=2027&q=&corAtiva=&comImagem=&cor=&status=
catalogo.get('/', (req, res) => {
  const { cols, filtro } = montarFiltro(req.query);
  const r = linhasCatalogo(filtro);
  res.json({
    colecoes: cols,
    filtro: { ...filtro, colecoes: [...filtro.colecoes] },
    metricas: r.metricas,
    alertas: r.alertas.slice(0, 500),
    total_alertas: r.alertas.length,
    linhas: r.linhas,
  });
});

// GET /api/catalogo/colecoes — para popular os selects de filtro dinamicamente.
catalogo.get('/colecoes', (_req, res) => res.json(listarColecoes()));

// GET /api/catalogo/produto/:codigo — drill-down.
catalogo.get('/produto/:codigo', (req, res) => {
  const d = detalheProduto(req.params.codigo);
  if (!d) return res.status(404).json({ error: 'produto não encontrado' });
  res.json(d);
});

// GET /api/catalogo/export.csv?... — mesma consulta, download CSV.
catalogo.get('/export.csv', (req, res) => {
  const { cols, filtro } = montarFiltro(req.query);
  const r = linhasCatalogo(filtro);
  const nome = cols.length === 1 ? cols[0].descricao.replace(/\W+/g, '_') : (req.query.temporada || 'catalogo');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="catalogo_${nome}.csv"`);
  res.send('﻿' + paraCSV(r.linhas)); // BOM p/ Excel
});

// ---- imagem por cor (proxy + cache) com fallback para a imagem geral -------
async function buscarImagem(codigo, cor) {
  const chave = cor ? `${codigo}-${cor}` : codigo;
  const cache = idb.prepare('SELECT base64 FROM img_cache WHERE codigo=?').get(chave);
  if (cache) return cache.base64 || null; // "" = sabidamente sem imagem
  if (!exciaConfigurado()) return null;
  let base64 = null, arquivo = '';
  try {
    const regs = await exciaGet('CarregaImagemProduto', { codigo, tipo_item: 'P' });
    const imgs = Array.isArray(regs) ? (regs[0]?.imagens || []) : [];
    // 1ª escolha: imagem específica da cor; fallback: imagem geral (sem cor).
    const daCor = cor ? imgs.find((im) => String(im.cor || '').trim() === String(cor).trim()) : null;
    const geral = imgs.find((im) => !String(im.cor || '').trim()) || imgs[0];
    const alvo = daCor || geral;
    base64 = alvo?.imagem || null; arquivo = alvo?.arquivo || '';
  } catch { base64 = null; }
  idb.prepare(`INSERT OR REPLACE INTO img_cache (codigo, arquivo, base64, atualizado_em)
    VALUES (?, ?, ?, datetime('now'))`).run(chave, arquivo, base64 || '');
  return base64;
}

catalogo.get('/imagem/:codigo/:cor?', async (req, res) => {
  const b64 = await buscarImagem(String(req.params.codigo).trim(), req.params.cor ? String(req.params.cor).trim() : '');
  if (!b64) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('image/jpeg').send(Buffer.from(b64, 'base64'));
});
