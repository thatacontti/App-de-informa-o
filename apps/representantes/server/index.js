// Plataforma do Representante · Grupo Catarina
// Express + SQLite. Serve os HTMLs aprovados e a API segregada.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, ensureSchema, isSeeded } from './db.js';
import { api } from './routes/api.js';
import { requireAuth, requireAuthPage, requireRole, isDiretoria } from './auth.js';
import { seed } from './seed.js';
import { painelDisponivel, resolveRepNome, listRepsPainel, buildPainelRep } from './lib/painelRep.js';
import { intel } from './routes/intel.js';
import { catalogo } from './routes/catalogo.js';
import { agendarSync } from './lib/intelSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);

// ---- bootstrap: schema + seed idempotente ----
ensureSchema();
if (!isSeeded()) {
  console.log('[boot] banco vazio — rodando seed inicial...');
  const r = seed();
  console.log(`[boot] seed: ${r.reps} reps, ${r.n} clientes.`);
}

const app = express();
app.set('trust proxy', 1); // atrás do Nginx

app.use(helmet({
  contentSecurityPolicy: false, // os HTMLs usam estilos/inline scripts aprovados
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '25mb' })); // fotos base64 na prescrição

// ---- API ----
app.use('/api', api);
app.use('/api/intel', intel);
app.use('/api/catalogo', catalogo);

// ---- estáticos ----
app.use('/assets', express.static(path.join(PUBLIC, 'assets'), { maxAge: '7d' }));
app.use('/produtos', express.static(path.join(PUBLIC, 'produtos'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(PUBLIC, 'uploads')));

// Manuais/políticas em PDF (fase estática → agora servidos aqui).
const MANUAIS = path.join(PUBLIC, 'manuais');
fs.mkdirSync(MANUAIS, { recursive: true });
app.use('/manuais', express.static(MANUAIS));
app.get('/api/manuais', (req, res) => {
  const files = fs.existsSync(MANUAIS)
    ? fs.readdirSync(MANUAIS).filter((f) => f.toLowerCase().endsWith('.pdf'))
    : [];
  res.json(files.map((f) => ({ nome: f.replace(/[-_]/g, ' ').replace(/\.pdf$/i, ''), url: `/manuais/${f}` })));
});

// ---- health ----
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// ---- views com injeção server-side ----
const REPS = () => db.prepare(`SELECT cod, nome, ufs, regiao FROM usuarios WHERE papel='representante'`).all()
  .map((r) => ({ cod: r.cod, nome: r.nome, ufs: JSON.parse(r.ufs || '[]'), reg: r.regiao }));

function renderView(res, file, boot = {}) {
  let html;
  try {
    html = fs.readFileSync(path.join(VIEWS, file), 'utf-8');
  } catch {
    return res.status(404).type('text').send('view não encontrada');
  }
  const tag = `<script>window.__BOOT__=${JSON.stringify(boot)};</script>`;
  html = html.includes('</head>') ? html.replace('</head>', `${tag}\n</head>`) : tag + html;
  res.type('html').send(html);
}

// Plataforma (login + painel). Injeta a lista de reps para o select.
app.get(['/', '/plataforma', '/plataforma.html'], (req, res) =>
  renderView(res, 'plataforma.html', { reps: REPS() }));

// Formulário (análise da ação + kit).
app.get(['/formulario', '/formulario.html'], (req, res) =>
  renderView(res, 'formulario.html', {}));

// Painel de coleção completo.
app.get(['/colecao', '/painel-colecao', '/painel_colecao.html'], (req, res) =>
  renderView(res, 'painel_colecao.html', {}));

// Inteligência de Compra e Sugestão de Pedido (página Inteligência do Cliente).
app.get(['/inteligencia', '/inteligencia.html'], requireAuthPage, (req, res) =>
  renderView(res, 'inteligencia.html', {}));

// Catálogo de Produtos por Coleção (produto x cor x imagem).
app.get(['/catalogo', '/catalogo.html'], requireAuthPage, (req, res) =>
  renderView(res, 'catalogo.html', {}));

// Painel V27 POR REPRESENTANTE (M1): recorte segregado no servidor.
// Representante abre o próprio; diretoria/gestão escolhe via ?rep= (picker sem parâmetro).
function paginaAviso(res, titulo, msg, status = 200) {
  res.status(status).type('html').send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#ECEDEF;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="background:#fff;border-radius:20px;padding:36px 40px;max-width:460px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
<h2 style="margin:0 0 10px;color:#1f2937">${titulo}</h2><p style="color:#4b5563;line-height:1.5">${msg}</p>
<a href="/" style="color:#2563EB;font-weight:600;text-decoration:none">← Voltar à plataforma</a></div></body></html>`);
}

app.get(['/meu-painel', '/painel-rep'], requireAuthPage, (req, res) => {
  if (!painelDisponivel()) {
    return paginaAviso(res, 'Painel indisponível',
      'As fontes de dados do Painel V27 não estão instaladas neste servidor (data/painel_v27). Avise a administração.', 503);
  }
  let nome = null;
  if (req.user.papel === 'representante') {
    nome = resolveRepNome(req.user);
    if (!nome) {
      return paginaAviso(res, 'Painel em preparação',
        'Sua representação ainda não tem dados consolidados no Painel V27 (preview comercial). Assim que a próxima carga entrar, seu painel aparece aqui automaticamente.');
    }
  } else if (isDiretoria(req.user)) {
    nome = req.query.rep ? String(req.query.rep) : null;
    if (!nome) {
      const links = listRepsPainel()
        .map((r) => `<li style="margin:6px 0"><a style="color:#2563EB;text-decoration:none;font-weight:600" href="/meu-painel?rep=${encodeURIComponent(r.full)}">${r.short}</a> <span style="color:#6b7280;font-size:.85rem">· ${r.full}</span></li>`)
        .join('');
      return res.type('html').send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Painéis por representante</title></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#ECEDEF;margin:0;padding:40px">
<div style="background:#fff;border-radius:20px;padding:32px 36px;max-width:640px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.08)">
<h2 style="margin:0 0 4px;color:#1f2937">Painel V27 por representante</h2>
<p style="color:#6b7280;margin:0 0 16px">Visão da diretoria — escolha a representação:</p>
<ul style="list-style:none;padding:0;margin:0;columns:1">${links}</ul>
<p style="margin-top:18px"><a href="/" style="color:#2563EB;font-weight:600;text-decoration:none">← Voltar à plataforma</a></p></div></body></html>`);
    }
  } else {
    return res.status(403).type('text').send('sem permissão');
  }

  const refresh = req.user.papel === 'admin' && req.query.refresh === '1';
  let html;
  try {
    html = buildPainelRep(nome, { refresh });
  } catch (e) {
    console.error('[painel-rep] erro ao gerar painel:', e);
    return paginaAviso(res, 'Erro ao gerar o painel',
      'Não foi possível montar o painel agora. Tente novamente em instantes; se persistir, avise a administração.', 500);
  }
  if (!html) {
    return paginaAviso(res, 'Sem dados no recorte',
      'Não há registros do preview comercial V27 para essa representação.', 404);
  }
  res.type('html').send(html);
});

// Painel do projeto (restrito a admin).
app.get(['/projeto', '/painel_projeto.html'], requireAuth, requireRole('admin'), (req, res) =>
  renderView(res, 'painel_projeto.html', {}));

// Página de aprovações (nova).
app.get('/aprovacoes', (req, res) => renderView(res, 'aprovacoes.html', {}));

app.use((req, res) => res.status(404).type('text').send('404'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gc-representantes] no ar em http://0.0.0.0:${PORT}  (EXCIA_MODE=${process.env.EXCIA_MODE || 'file'})`);
  agendarSync(); // Inteligência de Compra: sync EXCIA inicial + diário
});
