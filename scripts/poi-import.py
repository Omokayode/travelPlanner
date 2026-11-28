#!/usr/bin/env python3
"""Load places from a Geofabrik .osm.pbf extract into travelPlanner's place cache (Poi table).

Reads the extract with pyosmium (nodes, closed ways and multipolygon relations — parks,
museums and nature reserves are often areas, so their centre is used), keeps the places the
app lists (lib/osmCategories.json — the same table the app uses), and prints SQL that replaces
that region's rows. Pipe it into psql:

    python3 -I scripts/poi-import.py wisconsin-latest.osm.pbf --key geofabrik:wisconsin \
      | docker exec -i travelplanner-db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'

scripts/poi-import.sh does the download and the pipe for you. Needs: pip install osmium
"""
import argparse
import csv
import datetime
import io
import json
import os
import sys

try:
    import osmium
except ImportError:
    sys.exit("pyosmium is missing: pip install osmium (or apt install python3-pyosmium)")

HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = json.load(open(os.path.join(HERE, "..", "lib", "osmCategories.json")))
RULES = TABLE["rules"]
KEEP = TABLE["keepTags"]


def category(tags):
    for r in RULES:
        v = tags.get(r["key"])
        if v and v in r["values"]:
            return r["category"]
    return None


class Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = {}
        self.bbox = [90.0, 180.0, -90.0, -180.0]  # s, w, n, e

    def add(self, oid, tags, lat, lng):
        name = tags.get("name")
        cat = category(tags)
        if not name or not cat:
            return
        kept = {k: tags[k] for k in KEEP if k in tags}
        self.rows[oid] = (oid, name.strip()[:300], cat, lat, lng, json.dumps(kept, ensure_ascii=False))
        b = self.bbox
        b[0], b[1], b[2], b[3] = min(b[0], lat), min(b[1], lng), max(b[2], lat), max(b[3], lng)

    def node(self, n):
        if "name" not in n.tags or not n.location.valid():
            return
        self.add(f"node/{n.id}", dict(n.tags), n.location.lat, n.location.lon)

    def area(self, a):
        if "name" not in a.tags:
            return
        tags = dict(a.tags)
        if not category(tags):
            return
        lat = lng = 0.0
        count = 0
        for ring in a.outer_rings():
            for nd in ring:
                if nd.location.valid():
                    lat += nd.location.lat
                    lng += nd.location.lon
                    count += 1
        if not count:
            return
        oid = f"way/{a.orig_id()}" if a.from_way() else f"relation/{a.orig_id()}"
        self.add(oid, tags, lat / count, lng / count)


def sql_literal(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pbf")
    ap.add_argument("--key", required=True, help="area key, e.g. geofabrik:wisconsin")
    args = ap.parse_args()

    h = Handler()
    h.apply_file(args.pbf, locations=True, idx="flex_mem")
    if not h.rows:
        sys.exit("no places found in that file")

    counts = {}
    for r in h.rows.values():
        counts[r[2]] = counts.get(r[2], 0) + 1
    print(f"{len(h.rows)} places: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())), file=sys.stderr)

    key = sql_literal(args.key)
    # one exact (millisecond) stamp for this import: rows of the region without it are gone from OSM
    stamp = sql_literal(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
    s, w, n, e = h.bbox
    out = sys.stdout
    out.write("BEGIN;\n")
    out.write('CREATE TEMP TABLE poi_in (id text, name text, category text, lat float8, lng float8, tags jsonb) ON COMMIT DROP;\n')
    out.write("COPY poi_in FROM STDIN WITH (FORMAT csv);\n")
    buf = io.StringIO()
    wr = csv.writer(buf, lineterminator="\n")
    for r in h.rows.values():
        wr.writerow(r)
    out.write(buf.getvalue())
    out.write("\\.\n")
    out.write(
        'INSERT INTO "Poi" (id, name, category, lat, lng, tags, "areaKey", "fetchedAt") '
        f"SELECT id, name, category, lat, lng, tags, {key}, {stamp}::timestamp FROM poi_in "
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, lat = EXCLUDED.lat, '
        'lng = EXCLUDED.lng, tags = EXCLUDED.tags, "areaKey" = EXCLUDED."areaKey", "fetchedAt" = EXCLUDED."fetchedAt";\n'
    )
    out.write(f'DELETE FROM "Poi" WHERE "areaKey" = {key} AND "fetchedAt" <> {stamp}::timestamp;\n')
    out.write(
        'INSERT INTO "PoiArea" (key, south, west, north, east, source, count, "fetchedAt") '
        f"VALUES ({key}, {s}, {w}, {n}, {e}, 'geofabrik', {len(h.rows)}, now()) "
        'ON CONFLICT (key) DO UPDATE SET south = EXCLUDED.south, west = EXCLUDED.west, north = EXCLUDED.north, '
        'east = EXCLUDED.east, source = EXCLUDED.source, count = EXCLUDED.count, "fetchedAt" = now();\n'
    )
    out.write("COMMIT;\n")


if __name__ == "__main__":
    main()
