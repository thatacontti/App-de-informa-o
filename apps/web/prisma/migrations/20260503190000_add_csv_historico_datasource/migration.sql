-- AlterEnum: registers CSV_HISTORICO as a first-class DataSourceType so
-- the historic CSV files appear in the admin/datasources table and can
-- be tested / synced from the same UI as the live ERP/CRM/XLSX sources.
ALTER TYPE "DataSourceType" ADD VALUE 'CSV_HISTORICO';
