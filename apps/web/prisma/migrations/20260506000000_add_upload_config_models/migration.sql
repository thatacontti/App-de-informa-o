-- Upload + config infrastructure (step: admin upload pipelines).
--
-- Adds five tables that back the /admin upload routes:
--   ImportBatch    : generic batch tracker (Excia CSV, profiles CSV, JSON configs)
--   AppConfig      : key/value knobs (fallback JSON URLs, compare collection, ...)
--   ClientProfile  : codcli → CustomerProfile mirror of the profiles upload
--   CityProfile    : decoupled city → IBGE tier upload (no FK to City)
--   BaselineV26    : raw V26 baseline upload (no FK to Customer)
--
-- All tables are additive; no changes to existing tables.

-- CreateTable: ImportBatch
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filename" TEXT,
    "collection" TEXT,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsOk" INTEGER NOT NULL DEFAULT 0,
    "recordsFail" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_source_startedAt_idx" ON "ImportBatch"("source", "startedAt");
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX "ImportBatch_collection_idx" ON "ImportBatch"("collection");

-- CreateTable: AppConfig
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable: ClientProfile
CREATE TABLE "ClientProfile" (
    "codcli" TEXT NOT NULL,
    "profile" "CustomerProfile" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("codcli")
);

CREATE INDEX "ClientProfile_profile_idx" ON "ClientProfile"("profile");

-- CreateTable: CityProfile
CREATE TABLE "CityProfile" (
    "id" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "perfil" "IbgePopulationTier" NOT NULL,
    "popMil" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CityProfile_uf_cityName_key" ON "CityProfile"("uf", "cityName");
CREATE INDEX "CityProfile_perfil_idx" ON "CityProfile"("perfil");

-- CreateTable: BaselineV26
CREATE TABLE "BaselineV26" (
    "codcli" TEXT NOT NULL,
    "brand" "Brand" NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaselineV26_pkey" PRIMARY KEY ("codcli", "brand")
);

CREATE INDEX "BaselineV26_brand_idx" ON "BaselineV26"("brand");
