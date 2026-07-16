// Autenticação: JWT em cookie httpOnly. Login por Cód RC + senha.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_TTL = process.env.JWT_TTL || '12h';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'true') === 'true';
export const COOKIE_NAME = 'gc_rep_session';

export function verifyCredentials(cod, senha) {
  const u = db.prepare('SELECT * FROM usuarios WHERE cod = ?').get(String(cod));
  if (!u) return null;
  if (!bcrypt.compareSync(String(senha), u.senha_hash)) return null;
  return u;
}

export function issueToken(u) {
  return jwt.sign(
    { cod: u.cod, papel: u.papel, nome: u.nome },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Middleware: exige sessão válida; anexa req.user (linha completa de usuarios).
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const u = db.prepare('SELECT * FROM usuarios WHERE cod = ?').get(payload.cod);
    if (!u) return res.status(401).json({ error: 'sessão inválida' });
    req.user = u;
    next();
  } catch {
    return res.status(401).json({ error: 'sessão expirada' });
  }
}

// Variante para páginas HTML: sem sessão, redireciona ao login em vez de JSON.
export function requireAuthPage(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.redirect('/');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const u = db.prepare('SELECT * FROM usuarios WHERE cod = ?').get(payload.cod);
    if (!u) return res.redirect('/');
    req.user = u;
    next();
  } catch {
    return res.redirect('/');
  }
}

// Middleware factory por papel.
export function requireRole(...papeis) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'não autenticado' });
    if (!papeis.includes(req.user.papel))
      return res.status(403).json({ error: 'sem permissão' });
    next();
  };
}

// Diretoria (admin) enxerga tudo; representante só a própria carteira.
export function isDiretoria(user) {
  return user.papel === 'admin' || user.papel === 'gestor' || user.papel === 'marketing';
}
