// API da Plataforma do Representante. Segregação por carteira é feita
// AQUI (servidor), nunca no cliente. Ver CLAUDE_SPEC.md §5.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import {
  verifyCredentials, issueToken, setSessionCookie, clearSessionCookie,
  requireAuth, requireRole, isDiretoria,
} from '../auth.js';
import { prescrever, alcadaPorValor } from '../lib/motor.js';
import { getColecaoStatus, pingExcia, syncLive, EXCIA_MODE } from '../lib/excia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const api = express.Router();

// ---------- helpers de leitura (reconstroem o shape do frontend) ----------
const COL_ORDER = { I25: 0, T25: 1, V26: 2, I26: 3, T26: 4, V27: 5 };

function histShape(codcli) {
  const rows = db.prepare('SELECT marca, colecao_id, valor FROM historico WHERE codcli=?').all(codcli);
  const h = {};
  for (const r of rows) {
    (h[r.marca] ||= {})[r.colecao_id] = r.valor;
  }
  return h;
}

function clienteDbShape(row) {
  return {
    n: row.nome, c: row.cidade, u: row.uf, f: row.fat24m,
    h: histShape(row.codcli), t: row.tendencia, cv: row.curva, rep: row.rep_cod,
  };
}

// Carteira do usuário: representante vê só a própria; diretoria/gestão vê tudo.
function carteiraRows(user) {
  if (isDiretoria(user)) return db.prepare('SELECT * FROM clientes').all();
  return db.prepare('SELECT * FROM clientes WHERE rep_cod=?').all(String(user.cod));
}

function podeVerCliente(user, row) {
  if (!row) return false;
  if (isDiretoria(user)) return true;
  return String(row.rep_cod) === String(user.cod);
}

// ---------- login ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

api.post('/login', loginLimiter, (req, res) => {
  const { cod, senha } = req.body || {};
  if (!cod || senha == null) return res.status(400).json({ error: 'cod e senha obrigatórios' });
  const u = verifyCredentials(cod, senha);
  if (!u) return res.status(401).json({ error: 'Código de acesso incorreto para este representante.' });

  setSessionCookie(res, issueToken(u));

  // monta a carteira (db) já filtrada
  const dbOut = {};
  for (const row of carteiraRows(u)) dbOut[row.codcli] = clienteDbShape(row);

  res.json({
    rep: {
      cod: u.cod, nome: u.nome, rz: u.rz, reg: u.regiao,
      ufs: JSON.parse(u.ufs || '[]'), papel: u.papel,
      precisa_trocar_senha: !!u.precisa_trocar_senha,
    },
    db: dbOut,
  });
});

api.post('/logout', (req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

api.get('/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({ cod: u.cod, nome: u.nome, reg: u.regiao, ufs: JSON.parse(u.ufs || '[]'), papel: u.papel });
});

// Troca de senha (1º acesso).
api.post('/senha', requireAuth, (req, res) => {
  const { nova } = req.body || {};
  if (!nova || String(nova).length < 4) return res.status(400).json({ error: 'senha mínima de 4 caracteres' });
  db.prepare('UPDATE usuarios SET senha_hash=?, precisa_trocar_senha=0 WHERE cod=?')
    .run(bcrypt.hashSync(String(nova), 10), req.user.cod);
  res.json({ ok: true });
});

// ---------- lista de reps (login select — só nomes) ----------
api.get('/reps', (req, res) => {
  const rows = db.prepare(`SELECT cod, nome, ufs, regiao FROM usuarios WHERE papel='representante'`).all();
  res.json(rows.map((r) => ({ cod: r.cod, nome: r.nome, ufs: JSON.parse(r.ufs || '[]'), reg: r.regiao })));
});

// ---------- carteira ----------
api.get('/carteira', requireAuth, (req, res) => {
  const rows = carteiraRows(req.user).map((r) => {
    const h = histShape(r.codcli);
    const tot = (k) => Object.values(h).reduce((s, m) => s + (m[k] || 0), 0);
    return { cod: r.codcli, n: r.nome, c: r.cidade, u: r.uf, f: r.fat24m,
      cv: r.curva, t: r.tendencia, v26: tot('V26'), v27: tot('V27') };
  });
  if (req.query.format === 'csv') {
    const head = 'codigo;nome;cidade;uf;fat24m;curva;tendencia;v26;v27\n';
    const body = rows.map((c) => [c.cod, c.n, c.c, c.u, Math.round(c.f), c.cv, c.t, Math.round(c.v26), Math.round(c.v27)].join(';')).join('\n');
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="carteira.csv"');
    return res.send('﻿' + head + body);
  }
  res.json(rows);
});

// ---------- cliente detalhe (403 se fora da carteira) ----------
api.get('/cliente/:codcli', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM clientes WHERE codcli=?').get(String(req.params.codcli));
  if (!row) return res.status(404).json({ error: 'Cliente não encontrado no cadastro.' });
  if (!podeVerCliente(req.user, row)) return res.status(403).json({ error: 'Cliente fora da sua carteira.' });
  res.json(clienteDbShape(row));
});

// ---------- painel (agregados) ----------
api.get('/painel', requireAuth, (req, res) => {
  const rows = carteiraRows(req.user).map((r) => {
    const h = histShape(r.codcli);
    const tot = (k) => Object.values(h).reduce((s, m) => s + (m[k] || 0), 0);
    return { cod: r.codcli, n: r.nome, v26: tot('V26'), v27: tot('V27') };
  });
  const v26 = rows.reduce((s, c) => s + c.v26, 0);
  const v27 = rows.reduce((s, c) => s + c.v27, 0);
  const ativos = rows.filter((c) => c.v27 > 0).length;
  const risco = rows.filter((c) => c.v26 > 0 && c.v27 === 0);
  res.json({ v26, v27, ativos, nClientes: rows.length, risco });
});

// ---------- status de coleção (Excia) ----------
api.get('/colecao', requireAuth, (req, res) => {
  res.json(getColecaoStatus());
});

// ---------- prescrição (motor = fonte da verdade) ----------
api.post('/prescricao', requireAuth, (req, res) => {
  const b = req.body || {};
  const { codcli, fantasia, tipologia, contra, motivo, janela, notas = {}, fotos = [] } = b;

  if (!codcli || !motivo) return res.status(400).json({ error: 'codcli e motivo são obrigatórios.' });
  if (!Array.isArray(fotos) || fotos.length < 2)
    return res.status(400).json({ error: 'Suba pelo menos 2 fotos do PDV (fachada + exposição das marcas).' });

  const cli = db.prepare('SELECT * FROM clientes WHERE codcli=?').get(String(codcli));
  if (!cli) return res.status(404).json({ error: 'Cliente não encontrado.' });
  if (!podeVerCliente(req.user, cli)) return res.status(403).json({ error: 'Cliente fora da sua carteira.' });

  // motor autoritativo
  const out = prescrever({ curva: cli.curva, tend: cli.tendencia, tipologia, contra, notas });

  // protocolo único
  const yy = new Date().getFullYear().toString().slice(2);
  let protocolo;
  for (let i = 0; i < 20; i++) {
    protocolo = `${codcli}-${yy}${Math.floor(Math.random() * 900) + 100}`;
    if (!db.prepare('SELECT 1 FROM diagnosticos WHERE protocolo=?').get(protocolo)) break;
  }

  // salva fotos no disco
  const fotoDir = path.join(UPLOAD_DIR, protocolo);
  fs.mkdirSync(fotoDir, { recursive: true });
  const fotoPaths = [];
  fotos.forEach((dataUri, i) => {
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUri || '');
    if (!m) return;
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const fp = path.join(fotoDir, `foto_${i + 1}.${ext}`);
    fs.writeFileSync(fp, Buffer.from(m[2], 'base64'));
    fotoPaths.push(`/uploads/${protocolo}/foto_${i + 1}.${ext}`);
  });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO diagnosticos
      (protocolo, codcli, rep_cod, tipologia, motivo, notas, contrapartida, janela, fotos, criado_em)
      VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`)
      .run(protocolo, String(codcli), String(req.user.cod), tipologia || '', motivo,
        JSON.stringify(notas), contra || '', janela || '', JSON.stringify(fotoPaths));

    db.prepare(`INSERT INTO acoes
      (protocolo, codcli, kit, invest_min, invest_max, meta, alcada, alertas, status)
      VALUES (?,?,?,?,?,?,?,?,'em_aprovacao_comercial')`)
      .run(protocolo, String(codcli), JSON.stringify(out.kit),
        out.invMin, out.invMax, out.meta, out.alcada, JSON.stringify(out.alertas));

    db.prepare(`INSERT INTO aprovacoes (protocolo, instancia, decisao, data_decisao)
      VALUES (?, 'representante', 'enviado', datetime('now'))`).run(protocolo);
  });
  tx();

  res.json({
    protocolo, ...out, codcli, fantasia: fantasia || '',
    fat: cli.fat24m, curva: cli.curva, tend: cli.tendencia, tipologia,
    rep: req.user.nome, fotos: fotoPaths.length,
  });
});

// ---------- minhas prescrições ----------
api.get('/prescricoes', requireAuth, (req, res) => {
  const where = isDiretoria(req.user) ? '' : 'WHERE d.rep_cod=?';
  const args = isDiretoria(req.user) ? [] : [String(req.user.cod)];
  const rows = db.prepare(`
    SELECT d.protocolo, d.codcli, d.motivo, d.criado_em, d.tipologia,
           a.invest_min, a.invest_max, a.meta, a.alcada, a.status, a.kit,
           c.nome AS cliente
    FROM diagnosticos d
    JOIN acoes a ON a.protocolo=d.protocolo
    LEFT JOIN clientes c ON c.codcli=d.codcli
    ${where} ORDER BY d.criado_em DESC`).all(...args);
  res.json(rows.map((r) => ({ ...r, kit: JSON.parse(r.kit || '[]') })));
});

// ---------- fila de aprovações ----------
const INSTANCIA_POR_STATUS = {
  em_aprovacao_comercial: 'comercial',
  em_aprovacao_marketing: 'marketing',
  em_aprovacao_shopping: 'shopping',
};

api.get('/aprovacoes', requireAuth, requireRole('gestor', 'marketing', 'admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT d.protocolo, d.codcli, d.motivo, d.tipologia, d.criado_em, d.rep_cod,
           a.invest_min, a.invest_max, a.meta, a.alcada, a.status, a.kit, a.alertas,
           c.nome AS cliente, u.nome AS representante
    FROM diagnosticos d
    JOIN acoes a ON a.protocolo=d.protocolo
    LEFT JOIN clientes c ON c.codcli=d.codcli
    LEFT JOIN usuarios u ON u.cod=d.rep_cod
    WHERE a.status LIKE 'em_aprovacao_%'
    ORDER BY d.criado_em ASC`).all();
  res.json(rows.map((r) => ({ ...r, kit: JSON.parse(r.kit || '[]'), alertas: JSON.parse(r.alertas || '[]'),
    instancia: INSTANCIA_POR_STATUS[r.status] || r.status })));
});

// ---------- decisão de aprovação ----------
api.post('/aprovacoes/:protocolo', requireAuth, requireRole('gestor', 'marketing', 'admin'), (req, res) => {
  const { decisao, justificativa } = req.body || {};
  if (!['aprovar', 'ajustar', 'reprovar'].includes(decisao))
    return res.status(400).json({ error: 'decisão inválida' });
  if (decisao === 'reprovar' && !justificativa)
    return res.status(400).json({ error: 'Justificativa obrigatória na reprovação.' });

  const acao = db.prepare('SELECT * FROM acoes WHERE protocolo=?').get(req.params.protocolo);
  if (!acao) return res.status(404).json({ error: 'protocolo não encontrado' });
  const diag = db.prepare('SELECT tipologia FROM diagnosticos WHERE protocolo=?').get(req.params.protocolo);

  const instancia = INSTANCIA_POR_STATUS[acao.status] || 'comercial';
  let novo = acao.status;
  if (decisao === 'reprovar') novo = 'reprovada';
  else if (decisao === 'ajustar') novo = 'em_ajuste';
  else {
    // avança conforme toolkit §7 (shopping P3 entra antes do termo)
    if (acao.status === 'em_aprovacao_comercial') novo = 'em_aprovacao_marketing';
    else if (acao.status === 'em_aprovacao_marketing')
      novo = diag?.tipologia === 'P3' ? 'em_aprovacao_shopping' : 'aguardando_termo';
    else if (acao.status === 'em_aprovacao_shopping') novo = 'aguardando_termo';
  }

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO aprovacoes (protocolo, instancia, aprovador, decisao, justificativa, data_decisao)
      VALUES (?,?,?,?,?,datetime('now'))`)
      .run(req.params.protocolo, instancia, req.user.nome, decisao, justificativa || '');
    db.prepare('UPDATE acoes SET status=? WHERE protocolo=?').run(novo, req.params.protocolo);
  });
  tx();
  res.json({ ok: true, protocolo: req.params.protocolo, status: novo });
});

// ---------- histórico de cargas (rodapé) ----------
api.get('/cargas', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM cargas ORDER BY id DESC LIMIT 20').all());
});

// ---------- Excia: status + sync manual (admin) ----------
api.get('/excia/status', requireAuth, async (req, res) => {
  res.json({ mode: EXCIA_MODE, ...(await pingExcia()) });
});
api.post('/excia/sync', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const r = await syncLive({ since: req.body?.since, db });
    res.json(r);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});
