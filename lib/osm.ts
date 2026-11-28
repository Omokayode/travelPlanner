// lib/osm.ts — server-side access to the free OpenStreetMap services, in one place.
// Nominatim (place search), OSRM (driving routes), Overpass (points of interest).
// All calls go out from the server with one identifying User-Agent, are cached, and Nominatim
// calls are spaced out to respect its usage policy (max 1 request/second).
import 'server-only'
import { USER_AGENT } from '@/lib/config'
import type { Coordinates, GeoLocation, NominatimResult, OSRMRoute, OverpassElement, PlaceCategory } from '@/lib/types'
import { wikiNearby } from '@/lib/wiki'
import { INTEREST_SEARCH, type Interest } from '@/lib/domain/plan'

export const OSM_ENDPOINTS = {
  nominatim: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  osrm: process.env.OSRM_URL || 'https://router.project-osrm.org',
  // comma-separated; tried in order (the free public servers are often busy)
  overpass: (process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}

// ── tiny TTL cache (one container, so in-memory is enough) ──────────────────────
const cache = new Map<string, { until: number; value: unknown }>()
const MAX_ENTRIES = 500

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value as T
  const value = await load()
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { until: Date.now() + ttlMs, value })
  return value
}

// ── Nominatim: one request at a time, at least 1.1 s apart ──────────────────────
let nominatimQueue: Promise<unknown> = Promise.resolve()
let lastNominatim = 0

function nominatimFetch(path: string): Promise<unknown> {
  const run = async () => {
    const wait = lastNominatim + 1100 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastNominatim = Date.now()
    const res = await fetch(`${OSM_ENDPOINTS.nominatim}${path}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    return res.json()
  }
  const p = nominatimQueue.then(run, run)
  nominatimQueue = p.catch(() => undefined)
  return p
}

export function toGeoLocation(item: NominatimResult): GeoLocation {
  return {
    id: `nominatim_${item.place_id}`,
    name: item.display_name.split(',')[0],
    address: item.display_name,
    coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
    city: item.address?.city || item.address?.town || item.address?.village,
    state: item.address?.state,
    country: item.address?.country,
  }
}

export async function searchPlaces(query: string, limit = 5): Promise<GeoLocation[]> {
  const q = query.trim()
  if (!q) return []
  const key = `search:${limit}:${q.toLowerCase()}`
  return cached(key, 24 * 3600_000, async () => {
    const data = (await nominatimFetch(
      `/search?${new URLSearchParams({ q, format: 'json', limit: String(limit), addressdetails: '1' })}`,
    )) as NominatimResult[]
    return data.map(toGeoLocation)
  })
}

// ── OSRM driving route ───────────────────────────────────────────────────────────
export interface RouteResult {
  distanceMiles: number
  durationMinutes: number
  coords: [number, number][] // [lat, lng]
}

export async function drivingRoute(points: Coordinates[]): Promise<RouteResult | null> {
  if (points.length < 2) return null
  const path = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  return cached(`route:${path}`, 6 * 3600_000, async () => {
    const res = await fetch(`${OSM_ENDPOINTS.osrm}/route/v1/driving/${path}?overview=full&geometries=geojson`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000), // a save waits for this; fall back rather than hang
    })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = (await res.json()) as { routes?: OSRMRoute[] }
    const route = data.routes?.[0]
    if (!route) return null
    return {
      distanceMiles: route.distance / 1609.34,
      durationMinutes: route.duration / 60,
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    }
  })
}

// ── Overpass ───────────────────────────────────────────────────────────────────
export async function overpass(query: string, ttlMs = 3600_000, timeoutMs = 12_000): Promise<OverpassElement[]> {
  return cached(`overpass:${query}`, ttlMs, async () => {
    let last: unknown
    for (const url of OSM_ENDPOINTS.overpass) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: query,
          headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT, Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) throw new Error(`Overpass ${res.status}`)
        const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string }
        // a "remark" means the server stopped part-way (timeout, out of memory): the answer is incomplete
        if (data.remark && /error|timed out|out of memory/i.test(data.remark)) throw new Error(`Overpass: ${data.remark.slice(0, 120)}`)
        return data.elements || []
      } catch (err) {
        last = err // try the next server
      }
    }
    throw last instanceof Error ? last : new Error('Overpass is not answering')
  })
}

export interface Attraction {
  name: string
  category: PlaceCategory
  location: GeoLocation
  website?: string
  notes?: string
  osmId: string
  /** has a Wikidata entry (a well-known place) */
  known: boolean
}

/** Cached OpenStreetMap places (lib/server/poiCache.ts), balanced over kinds, best first. */
async function osmNearby(at: Coordinates, radiusM: number, city?: string): Promise<Attraction[]> {
  const { poisNear } = await import('@/lib/server/poiCache')
  const pois = await poisNear(at, radiusM)
  const foodMiles = 3 // eat near where you are, not across the metro
  const meal = (c: string) => c === 'food' || c === 'coffee' || c === 'nightlife'
  // well known first; for meals, local places before chains (a brand tag marks a chain)
  const score = (p: (typeof pois)[number]) =>
    (p.tags.wikidata ? 2 : 0) + (p.tags.website ? 1 : 0) + (p.tags.cuisine ? 0.5 : 0) - (meal(p.category) && p.tags.brand ? 3 : 0)
  const byKind = new Map<string, typeof pois>()
  for (const p of pois) {
    if (p.category === 'lodging') continue
    if (meal(p.category) && p.miles > foodMiles) continue
    const list = byKind.get(p.category) ?? []
    list.push(p)
    byKind.set(p.category, list)
  }
  const out: Attraction[] = []
  for (const list of Array.from(byKind.values())) {
    list.sort((a, b) => score(b) - score(a) || a.miles - b.miles)
    for (const p of list.slice(0, 25)) {
      out.push({
        name: p.name,
        category: p.category,
        osmId: p.id,
        location: {
          id: `osm_${p.id}`,
          name: p.name,
          coords: p.coords,
          city: p.tags['addr:city'] || city,
          address: [p.tags['addr:housenumber'], p.tags['addr:street']].filter(Boolean).join(' ') || undefined,
        },
        website: p.tags.website,
        notes: p.tags.description || (p.tags.cuisine ? p.tags.cuisine.replace(/;/g, ', ').replace(/_/g, ' ') : undefined),
        known: !!p.tags.wikidata,
      })
    }
  }
  return out
}

/**
 * Things to see and places to eat around a point: notable places from Wikipedia (best known
 * first), then OpenStreetMap places from our cache (restaurants, cafés, parks… anything Wikipedia missed). Either source may
 * be down; only when both are does this fail.
 */
export async function nearbyPlaces(at: Coordinates, limit = 12, city?: string, radiusM = 15000, interests: Interest[] = ['sights', 'museums', 'nature', 'history']): Promise<Attraction[]> {
  const searches = interests.map((i) => INTEREST_SEARCH[i]).filter((s): s is string => !!s)
  const [wiki, osm] = await Promise.allSettled([wikiNearby(at, radiusM, searches), osmNearby(at, radiusM, city)])
  if (wiki.status === 'rejected' && osm.status === 'rejected') throw new Error('Place lookup is unavailable right now')
  const out: Attraction[] = []
  const seen = new Set<string>()
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (wiki.status === 'fulfilled') {
    for (const w of wiki.value) {
      seen.add(norm(w.name))
      out.push({
        name: w.name,
        category: w.category as Attraction['category'],
        osmId: `wiki_${w.pageId}`,
        location: { id: `wiki_${w.pageId}`, name: w.name, coords: w.coords, city },
        website: w.url,
        notes: w.description || undefined,
        known: true,
      })
    }
  }
  if (osm.status === 'fulfilled') {
    for (const o of osm.value) {
      if (seen.has(norm(o.name))) continue
      seen.add(norm(o.name))
      out.push(o)
    }
  }
  return out.slice(0, limit)
}

/** Same, around a city looked up by name. */
export async function cityAttractions(city: string, limit = 10): Promise<Attraction[]> {
  const [place] = await searchPlaces(city, 1)
  return place ? nearbyPlaces(place.coords, limit, place.city || city) : []
}
