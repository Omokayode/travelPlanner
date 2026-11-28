// lib/server/hotels.ts — where to stay near a point: Google (rating, price level) when a server
// key is set, else hotels from our OpenStreetMap cache (names only). Prices are never stored —
// each suggestion links to a booking search with the dates filled in.
import 'server-only'
import type { Coordinates } from '@/lib/types'
import { pickHotels, type Hotel } from '@/lib/domain/google'
import { googleHotels } from '@/lib/server/google'
import { poisNear } from '@/lib/server/poiCache'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** One entry per hotel (OpenStreetMap often has a hotel as both a point and a building). */
function dedupe(list: Hotel[]): Hotel[] {
  const seen = new Set<string>()
  return list.filter((h) => {
    const k = norm(h.name)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Hotels near `at` (the middle of the day's places). If that finds too few — e.g. the places are
 * out in a state park — look again around `fallback` (the city centre), a little wider.
 */
export async function hotelsNear(at: Coordinates, max = 4, fallback?: Coordinates): Promise<Hotel[]> {
  try {
    const g = await googleHotels(at, 5000)
    if (g && g.length >= 2) return pickHotels(dedupe(g), max)
    if (g && fallback) {
      const more = (await googleHotels(fallback, 10000)) || []
      if (g.length + more.length) return pickHotels(dedupe([...g, ...more]), max)
    }
  } catch (err) {
    console.error('Google hotels failed, using OpenStreetMap', err instanceof Error ? err.message : err)
  }
  let found = await osmHotels(at, 6000)
  if (found.length < 2 && fallback) found = dedupe([...found, ...(await osmHotels(fallback, 12000))])
  return found.slice(0, max)
}

async function osmHotels(at: Coordinates, radiusM: number): Promise<Hotel[]> {
  const pois = await poisNear(at, radiusM, ['lodging'])
  // brands and places with a website first (more likely a real, bookable hotel), then nearest
  const score = (t: Record<string, string>) => (t.brand ? 1 : 0) + (t.website ? 1 : 0) + (t.stars ? 0.5 : 0)
  const list = pois
    .map((p) => ({
      s: score(p.tags),
      h: {
        name: p.name,
        coords: p.coords,
        address: [p.tags['addr:housenumber'], p.tags['addr:street']].filter(Boolean).join(' ') || undefined,
        source: 'osm' as const,
        miles: Math.round(p.miles * 10) / 10,
      },
    }))
    .sort((a, b) => b.s - a.s || a.h.miles - b.h.miles)
    .map((x) => x.h)
  return dedupe(list)
}
