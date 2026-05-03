-- Cadastra a fonte Base44 (catarina-vibe-flow.base44.app) como
-- DataSource desativada. Admin preenche `configEncrypted` com o JSON
-- abaixo via Prisma Studio / SQL antes de ativar:
--   {
--     "apiKey": "<rotated-key>",
--     "entityName": "Sale",
--     "mapperName": "sale-default",
--     "serverUrl": "https://catarina-vibe-flow.base44.app",
--     "incrementalField": "updated_date"
--   }
--
-- Outras opções de mapper já registradas:
--   "salesdata-default"  → entidade SalesData (sem collectionCode,
--                          assume V27 por default)
INSERT INTO "DataSource" ("id", "type", "name", "endpoint", "frequencyMinutes", "active", "updatedAt") VALUES
  (
    'seed_base44_sale',
    'BASE44_API',
    'Base44 · Sale',
    '69f3d2ea55300f3afb7e35dc',
    0,
    false,
    NOW()
  )
ON CONFLICT ("type", "name") DO NOTHING;
