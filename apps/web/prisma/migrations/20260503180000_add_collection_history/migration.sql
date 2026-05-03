-- AlterTable: Customer.profile gets a default for historic ingestion
-- (CSV rows without V26/V27 classification fall back to NOVO_27). The
-- active cycle still overwrites it with the real profile.
ALTER TABLE "Customer" ALTER COLUMN "profile" SET DEFAULT 'NOVO_27';

-- AlterTable: Sale.collection identifies the season the sale belongs to
-- (e.g. 'VERAO_2020', 'INVERNO_2026'). Required so historic ingestion
-- and current sync share the same dimension. Existing rows (if any)
-- are backfilled to 'V27' before the column is set NOT NULL.
ALTER TABLE "Sale" ADD COLUMN "collection" TEXT;
UPDATE "Sale" SET "collection" = 'V27' WHERE "collection" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "collection" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Sale_collection_brand_idx" ON "Sale"("collection", "brand");
CREATE INDEX "Sale_collection_date_idx" ON "Sale"("collection", "date");
