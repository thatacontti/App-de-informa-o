// Seed: lê data/plataforma_data.json ({reps, db}) e popula
// usuarios, clientes e historico. Senha inicial de cada RC = seu Cód RC
// (troca obrigatória no 1º acesso). Diretoria: cod 0 / senha 0000.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db, ensureSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'plataforma_data.json');

// Ordem canônica das coleções (rótulos legíveis para o histórico).
const COLS = [
  ['I25', 'Inverno 2025'], ['T25', 'Tropical 2025'], ['V26', 'Verão 2026'],
  ['I26', 'Inverno 2026'], ['T26', 'Tropical 2026'], ['V27', 'Verão 2027'],
];
const COL_LABEL = Object.fromEntries(COLS);
const COL_ORDER = Object.fromEntries(COLS.map(([k], i) => [k, i]));

export function seed({ reset = false } = {}) {
  ensureSchema();
  const { reps, db: clientes } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  if (reset) {
    db.exec('DELETE FROM historico; DELETE FROM clientes; DELETE FROM usuarios;');
  }

  const tx = db.transaction(() => {
    // ---- usuarios (representantes) ----
    const upUser = db.prepare(`INSERT INTO usuarios
      (cod, nome, rz, email, senha_hash, papel, ufs, regiao, macro, precisa_trocar_senha)
      VALUES (@cod, @nome, @rz, @email, @senha_hash, @papel, @ufs, @regiao, @macro, 1)
      ON CONFLICT(cod) DO UPDATE SET nome=@nome, rz=@rz, email=@email,
        ufs=@ufs, regiao=@regiao, macro=@macro`);

    for (const r of reps) {
      upUser.run({
        cod: String(r.cod),
        nome: r.nome,
        rz: r.rz || '',
        email: r.email || '',
        senha_hash: bcrypt.hashSync(String(r.cod), 10),
        papel: 'representante',
        ufs: JSON.stringify(r.ufs || []),
        regiao: r.reg || '',
        macro: r.macro || '',
      });
    }

    // Diretoria / Carteira Casa (admin, visão total).
    // Administradora do site: Thatiane Marques (configurável por env).
    upUser.run({
      cod: '0', nome: process.env.ADMIN_NOME || 'Thatiane Marques',
      rz: 'Grupo Catarina',
      email: process.env.ADMIN_EMAIL || 'thatiane.marques@grupocatarina.com',
      senha_hash: bcrypt.hashSync('0000', 10),
      papel: 'admin', ufs: '["BR"]', regiao: 'Diretoria', macro: 'Nacional',
    });
    // Usuários de aprovação (fluxo do toolkit §7). Senha inicial = cod.
    upUser.run({
      cod: 'gestor', nome: 'Gestor Comercial', rz: 'Grupo Catarina',
      email: 'comercial@grupocatarina.com',
      senha_hash: bcrypt.hashSync('gestor', 10),
      papel: 'gestor', ufs: '["BR"]', regiao: 'Comercial', macro: 'Nacional',
    });
    upUser.run({
      cod: 'marketing', nome: 'Head Marketing', rz: 'Grupo Catarina',
      email: 'marketing@grupocatarina.com',
      senha_hash: bcrypt.hashSync('marketing', 10),
      papel: 'marketing', ufs: '["BR"]', regiao: 'Marketing', macro: 'Nacional',
    });

    // ---- clientes + historico ----
    const upCli = db.prepare(`INSERT INTO clientes
      (codcli, nome, cidade, uf, fat24m, curva, tendencia, rep_cod)
      VALUES (@codcli, @nome, @cidade, @uf, @fat24m, @curva, @tendencia, @rep_cod)
      ON CONFLICT(codcli) DO UPDATE SET nome=@nome, cidade=@cidade, uf=@uf,
        fat24m=@fat24m, curva=@curva, tendencia=@tendencia, rep_cod=@rep_cod`);
    const insHist = db.prepare(`INSERT INTO historico
      (codcli, marca, colecao_id, colecao, ordem, valor)
      VALUES (?, ?, ?, ?, ?, ?)`);

    let totalFat = 0;
    let n = 0;
    for (const [codcli, d] of Object.entries(clientes)) {
      upCli.run({
        codcli: String(codcli),
        nome: d.n, cidade: d.c, uf: d.u,
        fat24m: d.f || 0, curva: d.cv || '', tendencia: d.t || '',
        rep_cod: d.rep != null ? String(d.rep) : null,
      });
      db.prepare('DELETE FROM historico WHERE codcli=?').run(String(codcli));
      for (const [marca, cols] of Object.entries(d.h || {})) {
        for (const [colId, valor] of Object.entries(cols)) {
          insHist.run(String(codcli), marca, colId,
            COL_LABEL[colId] || colId, COL_ORDER[colId] ?? 99, valor);
        }
      }
      totalFat += d.f || 0;
      n++;
    }

    // Registro da carga inicial (data do rodapé vem daqui).
    db.prepare(`INSERT INTO cargas (data, responsavel, fonte, total_fat, n_clientes, status)
      VALUES (datetime('now'), 'seed', 'plataforma_data.json', ?, ?, 'publicada')`)
      .run(totalFat, n);

    return { totalFat, n, reps: reps.length };
  });

  const res = tx();
  return res;
}

// Execução direta: node server/seed.js [--reset]
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes('--reset');
  const res = seed({ reset });
  console.log(`[seed] ${res.reps} representantes, ${res.n} clientes, ` +
    `fat24m total = R$ ${Math.round(res.totalFat).toLocaleString('pt-BR')}`);
}
