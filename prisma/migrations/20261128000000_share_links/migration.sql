-- Read-only share links: a random secret per trip (null = not shared).
ALTER TABLE "Trip" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Trip_shareToken_key" ON "Trip"("shareToken");
