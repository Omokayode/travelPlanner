-- Remove the pre-Phase-2 JSON copies. Since 1.5.0 days, legs, stops, activities and lodgings
-- live in their own tables and these columns were neither read nor written.
-- (Take a pg_dump first: this cannot be undone without one.)
ALTER TABLE "Day" DROP COLUMN "data";
ALTER TABLE "Trip" DROP COLUMN "lodgings";
