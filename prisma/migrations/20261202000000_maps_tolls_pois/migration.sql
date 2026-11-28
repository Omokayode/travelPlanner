-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "googleMapsKey" TEXT,
ADD COLUMN     "googleServerKey" TEXT,
ADD COLUMN     "mapStyle" TEXT,
ADD COLUMN     "tollPass" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "tollSource" TEXT;

-- CreateTable
CREATE TABLE "Poi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "tags" JSONB,
    "areaKey" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiArea" (
    "key" TEXT NOT NULL,
    "south" DOUBLE PRECISION NOT NULL,
    "west" DOUBLE PRECISION NOT NULL,
    "north" DOUBLE PRECISION NOT NULL,
    "east" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoiArea_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Poi_areaKey_idx" ON "Poi"("areaKey");

-- CreateIndex
CREATE INDEX "Poi_lat_lng_idx" ON "Poi"("lat", "lng");

