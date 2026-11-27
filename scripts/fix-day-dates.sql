-- One-off repair (2026-11): days created before v1.4 were dated one day early in US time zones
-- (the app parsed 'YYYY-MM-DD' as UTC). Every day's date becomes trip start + (day number - 1),
-- in both the "date" column and the copy inside the day's JSON.
--
-- Dry run (shows what would change, changes nothing):
--   psql ... -v apply=0 -f scripts/fix-day-dates.sql
-- Apply:
--   psql ... -v apply=1 -f scripts/fix-day-dates.sql
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE day_fix ON COMMIT DROP AS
SELECT d.id,
       t.name AS trip,
       d."dayNumber",
       d.date AS old_date,
       to_char(t."startDate"::date + (d."dayNumber" - 1), 'YYYY-MM-DD') AS new_date
FROM "Day" d
JOIN "Trip" t ON t.id = d."tripId"
WHERE d.date IS DISTINCT FROM to_char(t."startDate"::date + (d."dayNumber" - 1), 'YYYY-MM-DD')
   OR d.data->>'date' IS DISTINCT FROM to_char(t."startDate"::date + (d."dayNumber" - 1), 'YYYY-MM-DD');

SELECT trip, count(*) AS days_to_fix, min(old_date) AS first_old, min(new_date) AS first_new
FROM day_fix GROUP BY trip ORDER BY trip;

UPDATE "Day" d
SET date = f.new_date,
    data = jsonb_set(d.data::jsonb, '{date}', to_jsonb(f.new_date))
FROM day_fix f
WHERE d.id = f.id AND :apply = 1;

SELECT CASE WHEN :apply = 1 THEN 'APPLIED' ELSE 'DRY RUN - nothing changed' END AS result,
       (SELECT count(*) FROM day_fix) AS days;

COMMIT;
