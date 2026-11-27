-- 1.7.0: a day is an ordered list of places; how you get to each place (drive, flight…) is
-- stored on that place ("travel"). Legs, stops and activities are copied into Place:
--   per day, in leg order: the leg's start (unless it is where the previous leg ended),
--   then the leg's stops, then its destination carrying the leg as travel; activities last.
-- A destination reached via stops gets travelKey NULL so the app re-routes stop by stop on the
-- next save; other drives keep their numbers. Flights/trains keep what was typed (travelAuto false).
-- Segment, Stop and Activity are left as they are (read-only) until the move is checked.
-- Also: AppSettings.homeCity (where most trips start) and visitedCities rebuilt as unique
-- "City, State" labels from visited days, never a state on its own, never the home city.

BEGIN;

ALTER TABLE "AppSettings" ADD COLUMN "homeCity" TEXT;

CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "arriveTime" TEXT,
    "stayMinutes" INTEGER,
    "notes" TEXT,
    "cost" DECIMAL(12,2),
    "website" TEXT,
    "phone" TEXT,
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "osmId" TEXT,
    "placeName" TEXT NOT NULL,
    "placeAddress" TEXT,
    "placeCity" TEXT,
    "placeState" TEXT,
    "placeCountry" TEXT,
    "placeLat" DOUBLE PRECISION NOT NULL,
    "placeLng" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "travelMode" "TransportMode",
    "travelAuto" BOOLEAN NOT NULL DEFAULT true,
    "travelKey" TEXT,
    "travelMiles" DOUBLE PRECISION,
    "travelMinutes" DOUBLE PRECISION,
    "travelRoute" JSONB,
    "fuelCost" DECIMAL(12,2),
    "fuelGallons" DOUBLE PRECISION,
    "tollCost" DECIMAL(12,2),
    "travelCost" DECIMAL(12,2),
    "carrier" TEXT,
    "flightNumber" TEXT,
    "bookingRef" TEXT,
    "confirmationText" TEXT,
    "departureTime" TEXT,
    "arrivalTime" TEXT,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- "lat,lng>lat,lng" exactly as lib/server/travel.ts builds it (5 decimals)
CREATE FUNCTION pg_temp.hop(alat float8, alng float8, blat float8, blng float8) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
    SELECT round(alat::numeric, 5)::text || ',' || round(alng::numeric, 5)::text || '>' ||
           round(blat::numeric, 5)::text || ',' || round(blng::numeric, 5)::text $$;

WITH segs AS (
  SELECT s.*,
         lag(s."toLat") OVER w AS prev_lat,
         lag(s."toLng") OVER w AS prev_lng,
         EXISTS (SELECT 1 FROM "Stop" x WHERE x."segmentId" = s."id") AS has_stops
  FROM "Segment" s
  WINDOW w AS (PARTITION BY s."dayId" ORDER BY s."position")
),
rows AS (
  -- start of a leg (not repeated when the previous leg ended there)
  SELECT s."dayId", s."position" AS sp, 0 AS part, 0 AS sub,
         s."id" || '-start' AS id, s."fromName" AS name,
         CASE s."mode" WHEN 'flight' THEN 'airport' WHEN 'train' THEN 'station' ELSE 'city' END AS category,
         NULL::text AS notes, false AS visited, NULL::text AS osm_id,
         s."fromName" AS p_name, s."fromAddress" AS p_address, s."fromCity" AS p_city, s."fromState" AS p_state,
         s."fromCountry" AS p_country, s."fromLat" AS p_lat, s."fromLng" AS p_lng, s."fromId" AS p_id,
         NULL::"TransportMode" AS t_mode, true AS t_auto, NULL::text AS t_key,
         NULL::float8 AS t_miles, NULL::float8 AS t_minutes, NULL::jsonb AS t_route,
         NULL::numeric AS t_fuel, NULL::float8 AS t_gallons, NULL::numeric AS t_toll, NULL::numeric AS t_cost,
         NULL::text AS carrier, NULL::text AS flight, NULL::text AS booking, NULL::text AS confirmation,
         NULL::text AS dep, NULL::text AS arr
  FROM segs s
  WHERE s.prev_lat IS NULL OR abs(s.prev_lat - s."fromLat") > 0.0005 OR abs(s.prev_lng - s."fromLng") > 0.0005

  UNION ALL
  -- stops along the leg
  SELECT g."dayId", g."position", 1, st."position",
         st."id", st."name", st."type",
         NULLIF(concat_ws(E'\n', st."description", st."notes"), ''), st."visited", st."osmId",
         st."placeName", st."placeAddress", st."placeCity", st."placeState", st."placeCountry",
         st."placeLat", st."placeLng", st."placeId",
         NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
         NULL, NULL, NULL, NULL, NULL, NULL
  FROM "Stop" st JOIN "Segment" g ON g."id" = st."segmentId"

  UNION ALL
  -- destination, reached by the leg
  SELECT s."dayId", s."position", 2, 0,
         s."id", s."toName",
         CASE s."mode" WHEN 'flight' THEN 'airport' WHEN 'train' THEN 'station' ELSE 'city' END,
         s."notes", false, NULL,
         s."toName", s."toAddress", s."toCity", s."toState", s."toCountry", s."toLat", s."toLng", s."toId",
         s."mode",
         s."mode" IN ('drive', 'walk'),
         CASE WHEN s."mode" IN ('drive', 'walk') AND NOT s.has_stops
              THEN pg_temp.hop(s."fromLat", s."fromLng", s."toLat", s."toLng") END,
         s."distance", s."duration", s."routeCoords",
         s."fuelCost", s."fuelGallons", s."tollCost", s."cost",
         s."carrier", s."flightNumber", s."bookingRef", s."confirmationText", s."departureTime", s."arrivalTime"
  FROM segs s

  UNION ALL
  -- activities (none in use so far) with a location, after everything else
  SELECT a."dayId", 1000000, 3, a."position",
         a."id", a."name",
         CASE a."type" WHEN 'accommodation' THEN 'lodging' WHEN 'outdoor' THEN 'park' WHEN 'food' THEN 'food'
                       WHEN 'shopping' THEN 'shopping' WHEN 'nightlife' THEN 'nightlife'
                       WHEN 'attraction' THEN 'attraction' ELSE 'other' END,
         a."notes", a."visited", NULL,
         a."placeName", a."placeAddress", a."placeCity", a."placeState", a."placeCountry",
         a."placeLat", a."placeLng", a."placeId",
         NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
         NULL, NULL, NULL, NULL, NULL, NULL
  FROM "Activity" a WHERE a."placeLat" IS NOT NULL AND a."placeLng" IS NOT NULL
)
INSERT INTO "Place" (
  "id", "dayId", "position", "name", "category", "notes", "visited", "osmId",
  "placeName", "placeAddress", "placeCity", "placeState", "placeCountry", "placeLat", "placeLng", "placeId",
  "travelMode", "travelAuto", "travelKey", "travelMiles", "travelMinutes", "travelRoute",
  "fuelCost", "fuelGallons", "tollCost", "travelCost",
  "carrier", "flightNumber", "bookingRef", "confirmationText", "departureTime", "arrivalTime")
SELECT r.id, r."dayId",
       (row_number() OVER (PARTITION BY r."dayId" ORDER BY r.sp, r.part, r.sub) - 1)::int,
       COALESCE(NULLIF(r.name, ''), r.p_name, 'Place'), r.category, r.notes, r.visited, r.osm_id,
       COALESCE(r.p_name, ''), r.p_address, r.p_city, r.p_state, r.p_country, r.p_lat, r.p_lng, r.p_id,
       r.t_mode, r.t_auto, r.t_key, r.t_miles, r.t_minutes, r.t_route,
       r.t_fuel, r.t_gallons, r.t_toll, r.t_cost,
       r.carrier, r.flight, r.booking, r.confirmation, r.dep, r.arr
FROM rows r;

-- The first place of a day has no travel (a leg start that was dropped as a repeat can't be first,
-- but a day starting with a stop or activity could be).
UPDATE "Place" p SET "travelMode" = NULL, "travelKey" = NULL, "travelMiles" = NULL, "travelMinutes" = NULL,
  "travelRoute" = NULL, "fuelCost" = NULL, "fuelGallons" = NULL, "tollCost" = NULL, "travelCost" = NULL
WHERE p."position" = 0 AND p."travelMode" IS NOT NULL;

-- Every leg and stop must have landed.
DO $$
DECLARE missing int;
BEGIN
  SELECT (SELECT count(*) FROM "Segment" s WHERE NOT EXISTS (SELECT 1 FROM "Place" p WHERE p."id" = s."id"))
       + (SELECT count(*) FROM "Stop" s WHERE NOT EXISTS (SELECT 1 FROM "Place" p WHERE p."id" = s."id"))
    INTO missing;
  IF missing > 0 THEN RAISE EXCEPTION 'Place copy incomplete: % legs/stops missing', missing; END IF;
END $$;

CREATE INDEX "Place_dayId_idx" ON "Place"("dayId");
ALTER TABLE "Place" ADD CONSTRAINT "Place_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Home city: where most trips start (first place of day 1).
CREATE FUNCTION pg_temp.city_label(cat text, pname text, city text, state text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
    -- the place's city; a "city" place without one uses its name, unless that name is just the state
    SELECT CASE WHEN c IS NULL THEN NULL ELSE c || COALESCE(', ' || NULLIF(state, ''), '') END
    FROM (SELECT COALESCE(NULLIF(city, ''),
                          CASE WHEN cat = 'city' AND lower(pname) IS DISTINCT FROM lower(state) THEN NULLIF(pname, '') END) AS c) s $$;

INSERT INTO "AppSettings" ("id", "homeCity", "updatedAt")
SELECT 'singleton', h.label, now() FROM (
  SELECT q.label FROM (
    SELECT pg_temp.city_label(p."category", p."placeName", p."placeCity", p."placeState") AS label
    FROM "Place" p JOIN "Day" d ON d."id" = p."dayId"
    WHERE d."dayNumber" = 1 AND p."position" = 0
  ) q
  WHERE q.label IS NOT NULL
  GROUP BY q.label ORDER BY count(*) DESC, q.label LIMIT 1
) h
ON CONFLICT ("id") DO UPDATE SET "homeCity" = COALESCE("AppSettings"."homeCity", EXCLUDED."homeCity");

-- Cities visited, rebuilt: unique "City, State" from visited days, in the order first reached.
UPDATE "Trip" t SET "visitedCities" = COALESCE((
  SELECT array_agg(x.label ORDER BY x.first_seen)
  FROM (
    SELECT pg_temp.city_label(p."category", p."placeName", p."placeCity", p."placeState") AS label,
           min(d."dayNumber" * 100000 + p."position") AS first_seen
    FROM "Place" p JOIN "Day" d ON d."id" = p."dayId"
    WHERE d."tripId" = t."id" AND d."visited"
    GROUP BY 1
  ) x
  WHERE x.label IS NOT NULL
    AND x.label IS DISTINCT FROM (SELECT "homeCity" FROM "AppSettings" WHERE "id" = 'singleton')
), '{}');

COMMIT;
