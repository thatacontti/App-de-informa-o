-- Plataforma do Representante · Grupo Catarina
-- Schema SQLite (better-sqlite3). Ver CLAUDE_SPEC.md §4.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  cod TEXT UNIQUE,
  nome TEXT,
  rz TEXT,
  email TEXT,
  senha_hash TEXT,
  papel TEXT CHECK(papel IN ('representante','gestor','marketing','admin')),
  ufs TEXT,
  regiao TEXT,
  macro TEXT,
  precisa_trocar_senha INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clientes (
  codcli TEXT PRIMARY KEY,
  nome TEXT,
  cidade TEXT,
  uf TEXT,
  fat24m REAL,
  curva TEXT,
  tendencia TEXT,
  rep_cod TEXT
);
CREATE INDEX IF NOT EXISTS idx_clientes_rep ON clientes(rep_cod);

CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY,
  codcli TEXT,
  marca TEXT,
  colecao_id TEXT,
  colecao TEXT,
  ordem INTEGER,
  valor REAL
);
CREATE INDEX IF NOT EXISTS idx_historico_codcli ON historico(codcli);

CREATE TABLE IF NOT EXISTS diagnosticos (
  id INTEGER PRIMARY KEY,
  protocolo TEXT UNIQUE,
  codcli TEXT,
  rep_cod TEXT,
  tipologia TEXT,
  motivo TEXT,
  notas TEXT,
  contrapartida TEXT,
  janela TEXT,
  fotos TEXT,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_diag_rep ON diagnosticos(rep_cod);

CREATE TABLE IF NOT EXISTS acoes (
  id INTEGER PRIMARY KEY,
  protocolo TEXT,
  codcli TEXT,
  kit TEXT,
  invest_min REAL,
  invest_max REAL,
  meta REAL,
  alcada TEXT,
  alertas TEXT,
  status TEXT DEFAULT 'em_aprovacao_comercial'
);
CREATE INDEX IF NOT EXISTS idx_acoes_protocolo ON acoes(protocolo);

CREATE TABLE IF NOT EXISTS aprovacoes (
  id INTEGER PRIMARY KEY,
  protocolo TEXT,
  instancia TEXT,
  aprovador TEXT,
  decisao TEXT,
  justificativa TEXT,
  data_decisao TEXT
);
CREATE INDEX IF NOT EXISTS idx_aprov_protocolo ON aprovacoes(protocolo);

CREATE TABLE IF NOT EXISTS cargas (
  id INTEGER PRIMARY KEY,
  data TEXT,
  responsavel TEXT,
  fonte TEXT,
  total_fat REAL,
  n_clientes INTEGER,
  status TEXT
);
