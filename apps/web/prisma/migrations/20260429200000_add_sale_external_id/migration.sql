-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "externalId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_source_externalId_key" ON "Sale"("source", "externalId");

