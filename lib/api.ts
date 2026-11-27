// lib/api.ts — browser helpers for places, routes and map links.
// Place search, routing and suggestions go through our own /api/geo/* routes (server-side,
// cached, one User-Agent — see lib/osm.ts), never straight from the browser to OpenStreetMap.

import type { Coordinates, GeoLocation, PlaceCategory } from './types'

// ─── Place search ─────────────────────────────────────────────────────────────

export async function searchPlaces(query: string, limit = 5): Promise<GeoLocation[]> {
  if (query.trim().length < 2) return []
  try {
    const res = await fetch(`/api/geo/search?${new URLSearchParams({ q: query, limit: String(limit) })}`)
    return res.ok ? ((await res.json()) as GeoLocation[]) : []
  } catch {
    return []
  }
}

// ─── Driving route ───────────────────────────────────────────────────────────

export async function getRoute(
  from: Coordinates,
  to: Coordinates,
  waypoints: Coordinates[] = []
): Promise<{ distanceMiles: number; durationMinutes: number; coords: [number, number][] } | null> {
  try {
    const res = await fetch('/api/geo/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [from, ...waypoints, to].map(({ lat, lng }) => ({ lat, lng })) }),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

// ─── Map URL Generators ───────────────────────────────────────────────────────

export function getGoogleMapsUrl(
  from: GeoLocation,
  to: GeoLocation,
  stops: GeoLocation[] = [],
  segments: { from: GeoLocation; to: GeoLocation; stops?: { location: GeoLocation }[] }[] = []
): string {
  const waypoints: string[] = []

  if (segments.length > 1) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      for (const stop of (seg.stops || [])) {
        if (stop.location?.coords?.lat) {
          waypoints.push(`${stop.location.coords.lat},${stop.location.coords.lng}`)
        }
      }
      if (i < segments.length - 1 && seg.to?.coords?.lat) {
        waypoints.push(`${seg.to.coords.lat},${seg.to.coords.lng}`)
      }
    }
  } else {
    for (const s of stops) {
      if (s?.coords?.lat) waypoints.push(`${s.coords.lat},${s.coords.lng}`)
    }
  }

  const waypointsParam = waypoints.length
    ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}`
    : ''

  // Always use coordinates — never place names — to avoid Google Maps misinterpreting them
  const origin = from?.coords?.lat ? `${from.coords.lat},${from.coords.lng}` : encodeURIComponent(from?.name || '')
  const destination = to?.coords?.lat ? `${to.coords.lat},${to.coords.lng}` : encodeURIComponent(to?.name || '')

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=driving`
}

export function getWazeUrl(to: GeoLocation): string {
  if (to?.coords?.lat) {
    return `https://waze.com/ul?ll=${to.coords.lat},${to.coords.lng}&navigate=yes`
  }
  return `https://waze.com/ul?q=${encodeURIComponent(to?.name || '')}&navigate=yes`
}

// ─── City Suggestions for Activities ─────────────────────────────────────────

export interface Suggestion {
  name: string
  category: PlaceCategory
  location: GeoLocation
  website?: string
  notes?: string
  osmId?: string
}

/** Things to see and places to eat near a point (server-side Overpass, cached). */
export async function getNearbyPlaces(at: Coordinates, city?: string, limit = 12): Promise<Suggestion[]> {
  try {
    const q = new URLSearchParams({ lat: String(at.lat), lng: String(at.lng), limit: String(limit), ...(city ? { city } : {}) })
    const res = await fetch(`/api/geo/attractions?${q}`)
    return res.ok ? await res.json() : []
  } catch {
    return []
  }
}
