// Banco analítico da Inteligência de Compra (separado do transacional gc.sqlite).
// Armazena o espelho histórico da EXCIA + agregados por cliente + feedback do rep.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', 'db');
fs.mkdirSync(DB_DIR, { recursive: true });

export const idb = new Database(path.join(DB_DIR, 'analitico.sqlite'));
idb.pragma('journal_mode = WAL');
idb.pragma('synchronous = NORMAL');

idb.exec(`
CREATE TABLE IF NOT EXISTS clientes_ex (
  codcli TEXT PRIMARY KEY,
  nome TEXT, fantasia TEXT, cnpj TEXT,
  cidade TEXT, uf TEXT,
  data_cad TEXT,              -- ISO
  condicao TEXT, sit_cli TEXT, ativo TEXT,
  codrep TEXT,                -- JSON array de codrep
  dt_altera TEXT,
  raw TEXT                    -- payload completo (JSON) p/ campos não normalizados
);
CREATE TABLE IF NOT EXISTS pedidos (
  numero TEXT PRIMARY KEY,
  codcli TEXT, codrep TEXT, nome_rep TEXT,
  dt_emissao TEXT,            -- ISO
  colecao TEXT, pgto TEXT,
  valor_liq REAL, qtde_fat REAL, cancelado REAL,
  situacao TEXT,              -- derivado: faturado>0 = F
  itens_ok INTEGER DEFAULT 0, -- 1 = itens já sincronizados
  dt_altera TEXT
);
CREATE INDEX IF NOT EXISTS ix_pedidos_cli ON pedidos(codcli);
CREATE TABLE IF NOT EXISTS pedido_itens (
  numero TEXT, ordem INTEGER, codigo TEXT,
  cor TEXT, desc_cor TEXT, tam TEXT,
  preco REAL, qtde REAL, faturado REAL, cancelado REAL,
  estampa TEXT, desc_estampa TEXT,
  PRIMARY KEY (numero, ordem, codigo, cor, tam)
);
CREATE INDEX IF NOT EXISTS ix_itens_codigo ON pedido_itens(codigo);
CREATE TABLE IF NOT EXISTS produtos (
  codigo TEXT PRIMARY KEY,
  descricao TEXT, grupo TEXT, linha TEXT, familia TEXT, marca TEXT,
  colecao TEXT, etiqueta TEXT, unidade TEXT,
  preco_tabela REAL, data_cad TEXT, ativo TEXT, status TEXT,
  cores TEXT, tams TEXT,      -- JSON arrays
  dt_altera TEXT,
  raw TEXT
);
CREATE INDEX IF NOT EXISTS ix_produtos_colecao ON produtos(colecao);
CREATE TABLE IF NOT EXISTS catalogos (
  tipo TEXT, codigo TEXT, descricao TEXT, raw TEXT,
  PRIMARY KEY (tipo, codigo)
);
CREATE TABLE IF NOT EXISTS cliente_stats (
  codcli TEXT PRIMARY KEY,
  atualizado_em TEXT,
  stats TEXT                  -- JSON: agregados p/ clusters e similaridade
);
CREATE TABLE IF NOT EXISTS sync_state (
  chave TEXT PRIMARY KEY,
  cursor TEXT,                -- última data sincronizada (ISO)
  executado_em TEXT,
  status TEXT, detalhe TEXT
);
CREATE TABLE IF NOT EXISTS feedback_sugestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codcli TEXT, colecao TEXT, codigo TEXT,
  sugestao TEXT,              -- JSON: {tipo, score, qtd_total, grade, valor}
  acao TEXT CHECK(acao IN ('aceito','alterado','rejeitado')),
  alteracao TEXT,             -- JSON: grade/qtd efetivas informadas pelo rep
  usuario TEXT, usuario_nome TEXT,
  criado_em TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS img_cache (
  codigo TEXT PRIMARY KEY,
  arquivo TEXT, base64 TEXT,
  atualizado_em TEXT
);
-- Roteirização: cache de geocodificação (OSM) e prospects.
CREATE TABLE IF NOT EXISTS geocode (
  chave TEXT PRIMARY KEY,     -- ex.: cep:88495000 | cid:TOLEDO|PR
  lat REAL, lon REAL,
  display TEXT, ok INTEGER DEFAULT 1,   -- ok=0 = não encontrado (cache negativo)
  atualizado_em TEXT
);
CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT, cidade TEXT, uf TEXT, cep TEXT, endereco TEXT,
  origem TEXT,                -- google | instagram | manual
  rep_cod TEXT, lat REAL, lon REAL,
  obs TEXT, criado_por TEXT, criado_em TEXT DEFAULT (datetime('now','localtime'))
);
`);

export function getSync(chave) {
  return idb.prepare('SELECT * FROM sync_state WHERE chave=?').get(chave) || null;
}
export function setSync(chave, { cursor = null, status = 'ok', detalhe = '' } = {}) {
  idb.prepare(`INSERT INTO sync_state (chave, cursor, executado_em, status, detalhe)
    VALUES (?, ?, datetime('now','localtime'), ?, ?)
    ON CONFLICT(chave) DO UPDATE SET cursor=COALESCE(excluded.cursor, cursor),
      executado_em=excluded.executado_em, status=excluded.status, detalhe=excluded.detalhe`)
    .run(chave, cursor, status, detalhe);
}
