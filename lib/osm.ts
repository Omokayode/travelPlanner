// lib/osm.ts — server-side access to the free OpenStreetMap services, in one place.
// Nominatim (place search), OSRM (driving routes), Overpass (points of interest).
// All calls go out from the server with one identifying User-Agent, are cached, and Nominatim
// calls are spaced out to respect its usage policy (max 1 request/second).
import 'server-only'
import { USER_AGENT } from '@/lib/config'
import type { Coordinates, GeoLocation, NominatimResult, OSRMRoute, OverpassElement } from '@/lib/types'

export const OSM_ENDPOINTS = {
  nominatim: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  osrm: process.env.OSRM_URL || 'https://router.project-osrm.org',
  overpass: process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
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
export async function overpass(query: string, ttlMs = 3600_000): Promise<OverpassElement[]> {
  return cached(`overpass:${query}`, ttlMs, async () => {
    const res = await fetch(OSM_ENDPOINTS.overpass, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Overpass ${res.status}`)
    const data = (await res.json()) as { elements?: OverpassElement[] }
    return data.elements || []
  })
}

export interface Attraction {
  name: string
  type: 'attraction' | 'food'
  location: GeoLocation
  website?: string
  notes?: string
}

/** Sights, museums and restaurants around a city's centre. */
export async function cityAttractions(city: string, limit = 10): Promise<Attraction[]> {
  const [place] = await searchPlaces(city, 1)
  if (!place) return []
  const { lat, lng } = place.coords
  const q = `[out:json][timeout:25];
(
  node["tourism"="attraction"](around:5000,${lat},${lng});
  node["tourism"="museum"](around:5000,${lat},${lng});
  node["amenity"="restaurant"]["cuisine"](around:2000,${lat},${lng});
);
out body ${Math.min(Math.max(limit, 1), 50)};`
  const elements = await overpass(q)
  return elements.slice(0, limit).map((el) => ({
    name: el.tags.name || 'Unknown',
    type: el.tags.tourism ? 'attraction' : 'food',
    location: { id: `osm_${el.id}`, name: el.tags.name || 'Unknown', coords: { lat: el.lat, lng: el.lon }, city },
    website: el.tags.website,
    notes: el.tags.description || el.tags.cuisine,
  }))
}
