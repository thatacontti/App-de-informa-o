-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTOR', 'ANALISTA');

-- CreateEnum
CREATE TYPE "Brand" AS ENUM ('KIKI', 'MA', 'VALENT');

-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('BEBE', 'PRIMEIROS_PASSOS', 'INFANTIL', 'TEEN');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('ENTRADA', 'MEDIO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "CustomerProfile" AS ENUM ('VIP_3PLUS', 'VIP', 'FREQUENTE', 'REGULAR', 'NOVO_25', 'NOVO_27');

-- CreateEnum
CREATE TYPE "BrazilRegion" AS ENUM ('N', 'NE', 'CO', 'SE', 'S');

-- CreateEnum
CREATE TYPE "IbgePopulationTier" AS ENUM ('METRO', 'GRANDE', 'MEDIA', 'PEQUENA', 'MICRO');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('ERP_DB', 'CRM_API', 'XLSX');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('GLOBAL', 'BRAND', 'UF', 'REP');

-- CreateEnum
CREATE TYPE "TargetUnit" AS ENUM ('BRL', 'UNITS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ANALISTA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UF" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" "BrazilRegion" NOT NULL,

    CONSTRAINT "UF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ufId" TEXT NOT NULL,
    "ibgeTier" "IbgePopulationTier" NOT NULL,
    "popK" INTEGER,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Representative" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Representative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepUF" (
    "repId" TEXT NOT NULL,
    "ufId" TEXT NOT NULL,

    CONSTRAINT "RepUF_pkey" PRIMARY KEY ("repId","ufId")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile" "CustomerProfile" NOT NULL,
    "cityId" TEXT,
    "repId" TEXT,
    "ufId" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBrandRevenue" (
    "customerId" TEXT NOT NULL,
    "brand" "Brand" NOT NULL,
    "period" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "CustomerBrandRevenue_pkey" PRIMARY KEY ("customerId","brand","period")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" "Brand" NOT NULL,
    "line" "ProductLine" NOT NULL,
    "productGroup" TEXT NOT NULL,
    "coordSeason" TEXT,
    "priceTier" "PriceTier" NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "designer" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "repId" TEXT,
    "cityId" TEXT,
    "ufId" TEXT NOT NULL,
    "brand" "Brand" NOT NULL,
    "productLine" "ProductLine" NOT NULL,
    "productGroup" TEXT NOT NULL,
    "priceTier" "PriceTier" NOT NULL,
    "qty" INTEGER NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2),
    "unitCost" DECIMAL(10,4),
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "configEncrypted" TEXT,
    "frequencyMinutes" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "SyncStatus",
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "recordsOut" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "scopeKey" TEXT,
    "brand" "Brand",
    "ufId" TEXT,
    "repId" TEXT,
    "period" TEXT NOT NULL,
    "unit" "TargetUnit" NOT NULL DEFAULT 'BRL',
    "valueTarget" DECIMAL(14,2) NOT NULL,
    "valueAchieved" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingSnapshot" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "headlinesJson" JSONB NOT NULL,
    "risksJson" JSONB NOT NULL,
    "decisionsJson" JSONB NOT NULL,
    "pdfPath" TEXT,

    CONSTRAINT "BriefingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "City_ibgeTier_idx" ON "City"("ibgeTier");

-- CreateIndex
CREATE UNIQUE INDEX "City_ufId_name_key" ON "City"("ufId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Representative_fullName_key" ON "Representative"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_profile_idx" ON "Customer"("profile");

-- CreateIndex
CREATE INDEX "Customer_ufId_idx" ON "Customer"("ufId");

-- CreateIndex
CREATE INDEX "Customer_repId_idx" ON "Customer"("repId");

-- CreateIndex
CREATE INDEX "CustomerBrandRevenue_brand_period_idx" ON "CustomerBrandRevenue"("brand", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_brand_line_idx" ON "Product"("brand", "line");

-- CreateIndex
CREATE INDEX "Product_priceTier_idx" ON "Product"("priceTier");

-- CreateIndex
CREATE INDEX "Product_productGroup_idx" ON "Product"("productGroup");

-- CreateIndex
CREATE INDEX "Sale_brand_date_idx" ON "Sale"("brand", "date");

-- CreateIndex
CREATE INDEX "Sale_ufId_date_idx" ON "Sale"("ufId", "date");

-- CreateIndex
CREATE INDEX "Sale_customerId_date_idx" ON "Sale"("customerId", "date");

-- CreateIndex
CREATE INDEX "Sale_productLine_date_idx" ON "Sale"("productLine", "date");

-- CreateIndex
CREATE INDEX "Sale_priceTier_idx" ON "Sale"("priceTier");

-- CreateIndex
CREATE INDEX "Sale_productSku_idx" ON "Sale"("productSku");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_type_name_key" ON "DataSource"("type", "name");

-- CreateIndex
CREATE INDEX "SyncRun_dataSourceId_startedAt_idx" ON "SyncRun"("dataSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- CreateIndex
CREATE INDEX "Target_scope_period_idx" ON "Target"("scope", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Target_scope_scopeKey_period_unit_key" ON "Target"("scope", "scopeKey", "period", "unit");

-- CreateIndex
CREATE INDEX "BriefingSnapshot_generatedAt_idx" ON "BriefingSnapshot"("generatedAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "UF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepUF" ADD CONSTRAINT "RepUF_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepUF" ADD CONSTRAINT "RepUF_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "UF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Representative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "UF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrandRevenue" ADD CONSTRAINT "CustomerBrandRevenue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productSku_fkey" FOREIGN KEY ("productSku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Representative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "UF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "UF"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Representative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
