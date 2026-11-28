#!/usr/bin/env bash
# Download a Geofabrik extract and load its places into the travelPlanner place cache.
#
#   scripts/poi-import.sh north-america/us/wisconsin
#   scripts/poi-import.sh north-america/us/arizona
#
# Region paths are as on https://download.geofabrik.de (without -latest.osm.pbf).
# Env: DB_CONTAINER (default travelplanner-db), OSM_DIR (default ./osm, where downloads are kept).
# Run it again to refresh a region (monthly is plenty); rows that disappeared from OSM are removed.
set -euo pipefail
region="${1:?usage: $0 <geofabrik region path, e.g. north-america/us/wisconsin>}"
db="${DB_CONTAINER:-travelplanner-db}"
dir="${OSM_DIR:-$(pwd)/osm}"
here="$(cd "$(dirname "$0")" && pwd)"
name="$(basename "$region")"
mkdir -p "$dir"
file="$dir/$name-latest.osm.pbf"

echo "Downloading $region …"
curl -fL --retry 3 -z "$file" -o "$file" "https://download.geofabrik.de/$region-latest.osm.pbf"

echo "Reading places and loading them into $db …"
python3 -I "$here/poi-import.py" "$file" --key "geofabrik:$name" \
  | docker exec -i "$db" sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'
echo "Done: geofabrik:$name"
