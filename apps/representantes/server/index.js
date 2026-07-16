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
import { requireAuth, requireRole } from './auth.js';
import { seed } from './seed.js';

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

// Painel do projeto (restrito a admin).
app.get(['/projeto', '/painel_projeto.html'], requireAuth, requireRole('admin'), (req, res) =>
  renderView(res, 'painel_projeto.html', {}));

// Página de aprovações (nova).
app.get('/aprovacoes', (req, res) => renderView(res, 'aprovacoes.html', {}));

app.use((req, res) => res.status(404).type('text').send('404'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gc-representantes] no ar em http://0.0.0.0:${PORT}  (EXCIA_MODE=${process.env.EXCIA_MODE || 'file'})`);
});
