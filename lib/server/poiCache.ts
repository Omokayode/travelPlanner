// lib/server/poiCache.ts — OpenStreetMap places kept in our own database.
//
// The free Overpass servers are slow and often busy, so each area is asked for once (two
// queries: sights, then food/shops/hotels) and the answer is kept in Poi for 30 days. Areas can
// also be loaded offline from a Geofabrik extract (scripts/poi-import.py) — those never expire
// here. Only OpenStreetMap data is stored (never Google content).
import 'server-only'
import prisma from '@/lib/db'
import type { Coordinates, OverpassElement, PlaceCategory } from '@/lib/types'
import { haversineMiles } from '@/lib/domain/geo'
import { elementsToPois, overpassAreaQuery, type PoiGroup } from '@/lib/domain/osmCategory'
import { overpass } from '@/lib/osm'

const FRESH_MS = 30 * 24 * 3600_000
/** Areas are squares on a 0.05° grid, ±0.15° around the grid point (~33 km across). */
const GRID = 0.05
const HALF = 0.15

export interface CachedPoi {
  id: string
  name: string
  category: PlaceCategory
  coords: Coordinates
  tags: Record<string, string>
  miles: number
}

/** Counter for tests/logs: how many Overpass calls the cache made since start. */
export const poiStats = { overpassCalls: 0 }

export function areaFor(at: Coordinates) {
  const lat = Math.round(at.lat / GRID) * GRID
  const lng = Math.round(at.lng / GRID) * GRID
  const halfLng = HALF / Math.max(0.3, Math.cos((lat * Math.PI) / 180))
  return {
    key: `${lat.toFixed(2)},${lng.toFixed(2)}`,
    south: lat - HALF,
    north: lat + HALF,
    west: lng - halfLng,
    east: lng + halfLng,
  }
}

let filling = new Map<string, Promise<void>>()

/** Ask Overpass for an area and replace what we had for it (closed places drop out). */
export async function fillArea(at: Coordinates): Promise<void> {
  const a = areaFor(at)
  const running = filling.get(a.key)
  if (running) return running
  const job = (async () => {
    const bbox = `${a.south.toFixed(4)},${a.west.toFixed(4)},${a.north.toFixed(4)},${a.east.toFixed(4)}`
    const groups: PoiGroup[] = ['sights', 'food']
    const elements: OverpassElement[] = []
    for (const g of groups) {
      poiStats.overpassCalls++
      elements.push(...(await overpass(overpassAreaQuery(g, bbox), 60_000, 90_000)))
    }
    const rows = elementsToPois(elements).map((r) => ({ ...r, areaKey: a.key }))
    // one exact (millisecond) stamp for this fill: rows not carrying it afterwards are gone from OSM
    // (now() would not do: it has microseconds and the column keeps milliseconds)
    const stamp = new Date()
    const before = await prisma.poiArea.findUnique({ where: { key: a.key }, select: { count: true } })
    // far fewer places than last time looks like a cut-short answer: add, but don't remove anything
    const replace = !before || rows.length >= before.count * 0.5
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        // upsert in bulk: insert, and on conflict refresh the row
        await tx.$executeRaw`
          INSERT INTO "Poi" ("id","name","category","lat","lng","tags","areaKey","fetchedAt")
          SELECT x.id, x.name, x.category, x.lat, x.lng, x.tags, x."areaKey", ${stamp}
          FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
            AS x(id text, name text, category text, lat float8, lng float8, tags jsonb, "areaKey" text)
          ON CONFLICT ("id") DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, lat = EXCLUDED.lat,
            lng = EXCLUDED.lng, tags = EXCLUDED.tags, "areaKey" = EXCLUDED."areaKey", "fetchedAt" = EXCLUDED."fetchedAt"`
      }
      // rows of this area not in the new answer (closed/removed places)
      if (replace) await tx.$executeRaw`DELETE FROM "Poi" WHERE "areaKey" = ${a.key} AND "fetchedAt" <> ${stamp}`
      await tx.poiArea.upsert({
        where: { key: a.key },
        create: { key: a.key, south: a.south, north: a.north, west: a.west, east: a.east, source: 'overpass', count: rows.length },
        update: { fetchedAt: stamp, source: 'overpass', count: replace ? rows.length : Math.max(rows.length, before?.count ?? 0) },
      })
    }, { timeout: 60_000 })
  })()
  filling.set(a.key, job)
  try {
    await job
  } finally {
    filling.delete(a.key)
  }
}

/** Is there an area (fresh Overpass fill, or any Geofabrik import) holding this circle? */
async function covered(at: Coordinates, radiusM: number): Promise<{ fresh: boolean; any: boolean }> {
  const dLat = radiusM / 111_000
  const dLng = dLat / Math.max(0.3, Math.cos((at.lat * Math.PI) / 180))
  const areas = await prisma.poiArea.findMany({
    where: { south: { lte: at.lat - dLat * 0.5 }, north: { gte: at.lat + dLat * 0.5 }, west: { lte: at.lng - dLng * 0.5 }, east: { gte: at.lng + dLng * 0.5 } },
  })
  const fresh = areas.some((x) => x.source === 'geofabrik' || Date.now() - x.fetchedAt.getTime() < FRESH_MS)
  return { fresh, any: areas.length > 0 }
}

/**
 * Cached OpenStreetMap places around a point, nearest first. Fills the area from Overpass when
 * we have nothing fresh; if Overpass fails, whatever older rows we have are used.
 */
export async function poisNear(at: Coordinates, radiusM: number, categories?: PlaceCategory[]): Promise<CachedPoi[]> {
  const state = await covered(at, radiusM)
  if (!state.fresh) {
    try {
      await fillArea(at)
    } catch (err) {
      if (!state.any) throw err
      console.error('Overpass refresh failed, using older cached places', err instanceof Error ? err.message : err)
    }
  }
  const dLat = radiusM / 111_000
  const dLng = dLat / Math.max(0.3, Math.cos((at.lat * Math.PI) / 180))
  const rows = await prisma.poi.findMany({
    where: {
      lat: { gte: at.lat - dLat, lte: at.lat + dLat },
      lng: { gte: at.lng - dLng, lte: at.lng + dLng },
      ...(categories?.length ? { category: { in: categories } } : {}),
    },
    take: 5000,
  })
  const maxMiles = radiusM / 1609
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as PlaceCategory,
      coords: { lat: r.lat, lng: r.lng },
      tags: (r.tags as Record<string, string> | null) ?? {},
      miles: haversineMiles(at, { lat: r.lat, lng: r.lng }),
    }))
    .filter((p) => p.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles)
}

/** Settings line: how much is cached. */
export async function poiCacheSummary() {
  const [areas, pois] = await Promise.all([prisma.poiArea.count(), prisma.poi.count()])
  return { areas, pois }
}

/** For tests: forget in-flight fills. */
export function _resetPoiFills() {
  filling = new Map()
}
