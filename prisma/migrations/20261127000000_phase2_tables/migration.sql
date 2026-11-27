-- Phase 2: real tables instead of one JSON blob per day.
--
-- * Days: their legs, stops and activities move from Day.data into Segment / Stop / Activity.
-- * Trips: lodgings move from Trip.lodgings into Lodging.
-- * Dates become DATE columns, money DECIMAL(12,2), trip type and leg mode enums.
-- * Expense.dayId gets a foreign key (orphans set to NULL first); receipts can live in files.
--
-- The old JSON columns (Day.data, Trip.lodgings) are kept, untouched, so the move can be checked
-- and undone; a later migration drops them. Everything runs in one transaction: if any row does
-- not convert (a bad date, a leg without coordinates…) nothing changes and the app does not start.

BEGIN;

CREATE TYPE "TripType" AS ENUM ('road_trip', 'flight', 'train', 'mixed');
CREATE TYPE "TransportMode" AS ENUM ('drive', 'flight', 'train', 'bus', 'ferry', 'walk');

-- ── Trip ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Trip"
  ALTER COLUMN "startDate" TYPE DATE USING "startDate"::date,
  ALTER COLUMN "endDate" TYPE DATE USING "endDate"::date,
  ALTER COLUMN "type" TYPE "TripType" USING "type"::"TripType",
  ALTER COLUMN "totalBudget" SET DATA TYPE DECIMAL(12,2);

-- ── Day ─────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Day"
  ALTER COLUMN "date" TYPE DATE USING "date"::date,
  ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "startCity" TEXT,
  ADD COLUMN "endCity" TEXT,
  ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Day" SET
  "title"     = NULLIF("data"->>'title', ''),
  "notes"     = NULLIF("data"->>'notes', ''),
  "startCity" = NULLIF("data"->>'startCity', ''),
  "endCity"   = NULLIF("data"->>'endCity', ''),
  "visited"   = COALESCE(("data"->>'visited')::boolean, false);

CREATE UNIQUE INDEX "Day_tripId_dayNumber_key" ON "Day"("tripId", "dayNumber");

-- ── Expense ─────────────────────────────────────────────────────────────────────────────────
UPDATE "Expense" e SET "dayId" = NULL
  WHERE "dayId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Day" d WHERE d."id" = e."dayId");

ALTER TABLE "Expense"
  ADD COLUMN "receiptFile" TEXT,
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "date" TYPE DATE USING "date"::date;

-- ── New tables ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromAddress" TEXT,
    "fromCity" TEXT,
    "fromState" TEXT,
    "fromCountry" TEXT,
    "fromLat" DOUBLE PRECISION NOT NULL,
    "fromLng" DOUBLE PRECISION NOT NULL,
    "fromId" TEXT,
    "toName" TEXT NOT NULL,
    "toAddress" TEXT,
    "toCity" TEXT,
    "toState" TEXT,
    "toCountry" TEXT,
    "toLat" DOUBLE PRECISION NOT NULL,
    "toLng" DOUBLE PRECISION NOT NULL,
    "toId" TEXT,
    "distance" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "cost" DECIMAL(12,2),
    "fuelCost" DECIMAL(12,2),
    "fuelGallons" DOUBLE PRECISION,
    "tollCost" DECIMAL(12,2),
    "bookingRef" TEXT,
    "confirmationText" TEXT,
    "departureTime" TEXT,
    "arrivalTime" TEXT,
    "carrier" TEXT,
    "flightNumber" TEXT,
    "notes" TEXT,
    "routeCoords" JSONB,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Stop" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rating" DOUBLE PRECISION,
    "duration" INTEGER,
    "notes" TEXT,
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "isAutoSuggested" BOOLEAN NOT NULL DEFAULT false,
    "osmId" TEXT,
    "placeName" TEXT NOT NULL,
    "placeAddress" TEXT,
    "placeCity" TEXT,
    "placeState" TEXT,
    "placeCountry" TEXT,
    "placeLat" DOUBLE PRECISION NOT NULL,
    "placeLng" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "time" TEXT,
    "duration" INTEGER,
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "rating" DOUBLE PRECISION,
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "isHighlight" BOOLEAN NOT NULL DEFAULT false,
    "placeName" TEXT,
    "placeAddress" TEXT,
    "placeCity" TEXT,
    "placeState" TEXT,
    "placeCountry" TEXT,
    "placeLat" DOUBLE PRECISION,
    "placeLng" DOUBLE PRECISION,
    "placeId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lodging" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "confirmationText" TEXT,
    "notes" TEXT,
    "cost" DECIMAL(12,2),
    "bookingRef" TEXT,
    "placeName" TEXT NOT NULL,
    "placeAddress" TEXT,
    "placeCity" TEXT,
    "placeState" TEXT,
    "placeCountry" TEXT,
    "placeLat" DOUBLE PRECISION NOT NULL,
    "placeLng" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,

    CONSTRAINT "Lodging_pkey" PRIMARY KEY ("id")
);

-- ── Copy the JSON into the new tables ───────────────────────────────────────────────────────
-- Order in the JSON arrays becomes "position" (0-based). Missing ids get a new uuid.

INSERT INTO "Segment" (
  "id", "dayId", "position", "mode",
  "fromName", "fromAddress", "fromCity", "fromState", "fromCountry", "fromLat", "fromLng", "fromId",
  "toName", "toAddress", "toCity", "toState", "toCountry", "toLat", "toLng", "toId",
  "distance", "duration", "cost", "fuelCost", "fuelGallons", "tollCost",
  "bookingRef", "confirmationText", "departureTime", "arrivalTime", "carrier", "flightNumber", "notes",
  "routeCoords")
SELECT
  COALESCE(s->>'id', gen_random_uuid()::text), d."id", (x.o - 1)::int, (s->>'mode')::"TransportMode",
  COALESCE(s->'from'->>'name', ''), s->'from'->>'address', s->'from'->>'city', s->'from'->>'state',
  s->'from'->>'country', (s->'from'->'coords'->>'lat')::float8, (s->'from'->'coords'->>'lng')::float8, s->'from'->>'id',
  COALESCE(s->'to'->>'name', ''), s->'to'->>'address', s->'to'->>'city', s->'to'->>'state',
  s->'to'->>'country', (s->'to'->'coords'->>'lat')::float8, (s->'to'->'coords'->>'lng')::float8, s->'to'->>'id',
  (s->>'distance')::float8, (s->>'duration')::float8, (s->>'cost')::numeric, (s->>'fuelCost')::numeric,
  (s->>'fuelGallons')::float8, (s->>'tollCost')::numeric,
  s->>'bookingRef', s->>'confirmationText', s->>'departureTime', s->>'arrivalTime', s->>'carrier',
  s->>'flightNumber', s->>'notes',
  CASE WHEN jsonb_typeof(s->'routeCoords') = 'array' THEN s->'routeCoords' END
FROM "Day" d
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d."data"->'segments', '[]'::jsonb)) WITH ORDINALITY AS x(s, o);

INSERT INTO "Stop" (
  "id", "segmentId", "position", "type", "name", "description", "rating", "duration", "notes",
  "visited", "isAutoSuggested", "osmId",
  "placeName", "placeAddress", "placeCity", "placeState", "placeCountry", "placeLat", "placeLng", "placeId")
SELECT
  COALESCE(st->>'id', gen_random_uuid()::text), seg."id", (y.o - 1)::int, COALESCE(st->>'type', 'attraction'),
  COALESCE(st->>'name', st->'location'->>'name', ''), st->>'description', (st->>'rating')::float8,
  round((st->>'duration')::numeric)::int, st->>'notes',
  COALESCE((st->>'visited')::boolean, false), COALESCE((st->>'isAutoSuggested')::boolean, false), st->>'osmId',
  COALESCE(st->'location'->>'name', ''), st->'location'->>'address', st->'location'->>'city',
  st->'location'->>'state', st->'location'->>'country',
  (st->'location'->'coords'->>'lat')::float8, (st->'location'->'coords'->>'lng')::float8, st->'location'->>'id'
FROM "Day" d
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d."data"->'segments', '[]'::jsonb)) AS x(s)
JOIN "Segment" seg ON seg."id" = x.s->>'id' AND seg."dayId" = d."id"
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x.s->'stops', '[]'::jsonb)) WITH ORDINALITY AS y(st, o);

INSERT INTO "Activity" (
  "id", "dayId", "position", "name", "type", "time", "duration", "cost", "notes", "website", "phone",
  "rating", "visited", "isHighlight",
  "placeName", "placeAddress", "placeCity", "placeState", "placeCountry", "placeLat", "placeLng", "placeId")
SELECT
  COALESCE(a->>'id', gen_random_uuid()::text), d."id", (x.o - 1)::int, COALESCE(a->>'name', ''),
  COALESCE(a->>'type', 'other'), a->>'time', round((a->>'duration')::numeric)::int, (a->>'cost')::numeric,
  a->>'notes', a->>'website', a->>'phone', (a->>'rating')::float8,
  COALESCE((a->>'visited')::boolean, false), COALESCE((a->>'isHighlight')::boolean, false),
  a->'location'->>'name', a->'location'->>'address', a->'location'->>'city', a->'location'->>'state',
  a->'location'->>'country', (a->'location'->'coords'->>'lat')::float8, (a->'location'->'coords'->>'lng')::float8,
  a->'location'->>'id'
FROM "Day" d
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d."data"->'activities', '[]'::jsonb)) WITH ORDINALITY AS x(a, o);

INSERT INTO "Lodging" (
  "id", "tripId", "name", "checkIn", "checkOut", "confirmationText", "notes", "cost", "bookingRef",
  "placeName", "placeAddress", "placeCity", "placeState", "placeCountry", "placeLat", "placeLng", "placeId")
SELECT
  COALESCE(l->>'id', gen_random_uuid()::text), t."id", COALESCE(l->>'name', ''),
  (l->>'checkIn')::date, (l->>'checkOut')::date, l->>'confirmationText', l->>'notes', (l->>'cost')::numeric,
  l->>'bookingRef',
  COALESCE(l->'location'->>'name', l->>'name', ''), l->'location'->>'address', l->'location'->>'city',
  l->'location'->>'state', l->'location'->>'country',
  (l->'location'->'coords'->>'lat')::float8, (l->'location'->'coords'->>'lng')::float8, l->'location'->>'id'
FROM "Trip" t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t."lodgings") = 'array' THEN t."lodgings" ELSE '[]'::jsonb END) AS x(l);

-- Every stop in the JSON must have landed (a stop is only copied if its leg was).
DO $$
DECLARE want int; got int;
BEGIN
  SELECT count(*) INTO want FROM "Day" d,
    jsonb_array_elements(COALESCE(d."data"->'segments', '[]'::jsonb)) s,
    jsonb_array_elements(COALESCE(s->'stops', '[]'::jsonb)) st;
  SELECT count(*) INTO got FROM "Stop";
  IF want <> got THEN RAISE EXCEPTION 'Stop copy mismatch: % in JSON, % copied', want, got; END IF;
END $$;

-- ── Indexes and foreign keys ────────────────────────────────────────────────────────────────
CREATE INDEX "Segment_dayId_idx" ON "Segment"("dayId");
CREATE INDEX "Stop_segmentId_idx" ON "Stop"("segmentId");
CREATE INDEX "Activity_dayId_idx" ON "Activity"("dayId");
CREATE INDEX "Lodging_tripId_idx" ON "Lodging"("tripId");
CREATE INDEX "Expense_dayId_idx" ON "Expense"("dayId");

ALTER TABLE "Segment" ADD CONSTRAINT "Segment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lodging" ADD CONSTRAINT "Lodging_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Leftover from an earlier migration: Prisma sets updatedAt itself.
ALTER TABLE "AppSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

COMMIT;
