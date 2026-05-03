-- Structural seed embedded as SQL so it ships inside `prisma migrate
-- deploy` (which is the only seed-capable step the standalone web image
-- has at runtime). Idempotent via ON CONFLICT DO NOTHING — re-running
-- against a populated DB is a no-op.
--
-- Includes:
--   · 27 Brazilian UFs (geography reference)
--   · 3 default users (admin / gestor / analista, password 'Catarina2026!'
--     — must be rotated post-deploy)
--   · 3 live DataSources (ERP / CRM / SharePoint XLSX placeholders)
--   · 9 CSV histórico DataSources pointing at /app/Pasta1_v0X.csv

-- =====================================================
-- UFs
-- =====================================================
INSERT INTO "UF" ("id", "name", "region") VALUES
  ('AC', 'Acre',                'N'),
  ('AL', 'Alagoas',              'NE'),
  ('AP', 'Amapá',                'N'),
  ('AM', 'Amazonas',             'N'),
  ('BA', 'Bahia',                'NE'),
  ('CE', 'Ceará',                'NE'),
  ('DF', 'Distrito Federal',     'CO'),
  ('ES', 'Espírito Santo',       'SE'),
  ('GO', 'Goiás',                'CO'),
  ('MA', 'Maranhão',             'NE'),
  ('MT', 'Mato Grosso',          'CO'),
  ('MS', 'Mato Grosso do Sul',   'CO'),
  ('MG', 'Minas Gerais',         'SE'),
  ('PA', 'Pará',                 'N'),
  ('PB', 'Paraíba',              'NE'),
  ('PR', 'Paraná',               'S'),
  ('PE', 'Pernambuco',           'NE'),
  ('PI', 'Piauí',                'NE'),
  ('RJ', 'Rio de Janeiro',       'SE'),
  ('RN', 'Rio Grande do Norte',  'NE'),
  ('RS', 'Rio Grande do Sul',    'S'),
  ('RO', 'Rondônia',             'N'),
  ('RR', 'Roraima',              'N'),
  ('SC', 'Santa Catarina',       'S'),
  ('SP', 'São Paulo',            'SE'),
  ('SE', 'Sergipe',              'NE'),
  ('TO', 'Tocantins',            'N')
ON CONFLICT ("id") DO NOTHING;

-- =====================================================
-- Default users
-- The bcrypt hash below was generated from 'Catarina2026!' with
-- bcryptjs cost 12. Rotate via the UI immediately after deploy.
-- =====================================================
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "active", "updatedAt")
VALUES
  ('seed_admin',    'admin@catarina.local',    '$2a$12$Fqujan0GklBh.a1jx.ktWuS6RlaB1cfogNB7Rn7r9NnRagvBtYCCm', 'Administrador',     'ADMIN',    true, NOW()),
  ('seed_gestor',   'gestor@catarina.local',   '$2a$12$Fqujan0GklBh.a1jx.ktWuS6RlaB1cfogNB7Rn7r9NnRagvBtYCCm', 'Gestor Comercial',  'GESTOR',   true, NOW()),
  ('seed_analista', 'analista@catarina.local', '$2a$12$Fqujan0GklBh.a1jx.ktWuS6RlaB1cfogNB7Rn7r9NnRagvBtYCCm', 'Analista de Mix',   'ANALISTA', true, NOW())
ON CONFLICT ("email") DO NOTHING;

-- =====================================================
-- Live DataSources (ERP / CRM / XLSX) — placeholders the admin edits
-- with real endpoints. Inactive on the scheduler when USE_MOCK_CONNECTORS
-- is true; the worker reads them through the fixture connector instead.
-- =====================================================
INSERT INTO "DataSource" ("id", "type", "name", "endpoint", "frequencyMinutes", "active", "updatedAt") VALUES
  ('seed_erp_vendas', 'ERP_DB',  'ERP · Vendas',          'postgresql://srv-erp.catarina.local:5432/vendas?view=vw_painel_v27', 5,    true, NOW()),
  ('seed_crm_deals',  'CRM_API', 'CRM · Deals',           'https://api.crm-catarina.com/v2/deals',                              5,    true, NOW()),
  ('seed_xlsx_metas', 'XLSX',    'SharePoint · Metas V27','/Diretoria/Metas/V27.xlsx',                                          1440, true, NOW())
ON CONFLICT ("type", "name") DO NOTHING;

-- =====================================================
-- CSV histórico (2019-2025) — 9 inactive DataSources. Não rodam no
-- scheduler; o admin enfileira manualmente via /admin/datasources.
-- =====================================================
INSERT INTO "DataSource" ("id", "type", "name", "endpoint", "frequencyMinutes", "active", "updatedAt") VALUES
  ('seed_csv_v01', 'CSV_HISTORICO', 'CSV · Histórico v01', '/app/Pasta1_v01.csv', 0, false, NOW()),
  ('seed_csv_v02', 'CSV_HISTORICO', 'CSV · Histórico v02', '/app/Pasta1_v02.csv', 0, false, NOW()),
  ('seed_csv_v03', 'CSV_HISTORICO', 'CSV · Histórico v03', '/app/Pasta1_v03.csv', 0, false, NOW()),
  ('seed_csv_v04', 'CSV_HISTORICO', 'CSV · Histórico v04', '/app/Pasta1_v04.csv', 0, false, NOW()),
  ('seed_csv_v05', 'CSV_HISTORICO', 'CSV · Histórico v05', '/app/Pasta1_v05.csv', 0, false, NOW()),
  ('seed_csv_v06', 'CSV_HISTORICO', 'CSV · Histórico v06', '/app/Pasta1_v06.csv', 0, false, NOW()),
  ('seed_csv_v07', 'CSV_HISTORICO', 'CSV · Histórico v07', '/app/Pasta1_v07.csv', 0, false, NOW()),
  ('seed_csv_v08', 'CSV_HISTORICO', 'CSV · Histórico v08', '/app/Pasta1_v08.csv', 0, false, NOW()),
  ('seed_csv_v09', 'CSV_HISTORICO', 'CSV · Histórico v09', '/app/Pasta1_v09.csv', 0, false, NOW())
ON CONFLICT ("type", "name") DO NOTHING;
