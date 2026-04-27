CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "immichUrl" TEXT,
    "immichApiKey" TEXT,
    "immichAlbumId" TEXT,
    "gasPriceRegular" DOUBLE PRECISION,
    "gasPricePremium" DOUBLE PRECISION,
    "gasPriceDiesel" DOUBLE PRECISION,
    "savedVehicles" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
