-- AlterEnum: registers BASE44_API as a first-class DataSourceType so o
-- admin pode cadastrar uma fonte apontando para um app Base44 (via
-- @base44/sdk). Sync usa o entityName configurado no DataSource.endpoint
-- (ou em config) e o mapper bake-in pro app específico.
ALTER TYPE "DataSourceType" ADD VALUE 'BASE44_API';
