// lib/domain/mapLinks.ts — "open in Google Maps / Apple Maps" links (pure).
import type { Coordinates, TransportMode } from '@/lib/types'

const ll = (c: Coordinates) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`
const GOOGLE_MODE: Partial<Record<TransportMode, string>> = { drive: 'driving', walk: 'walking', train: 'transit', bus: 'transit', ferry: 'transit' }
const APPLE_MODE: Partial<Record<TransportMode, string>> = { drive: 'd', walk: 'w', train: 'r', bus: 'r', ferry: 'r' }

/** Google allows about 9 waypoints in a URL (fewer on some phones); we use 8. */
export const GOOGLE_MAX_WAYPOINTS = 8

export interface Stop {
  name: string
  coords: Coordinates
}

/** Google Maps directions: one hop, or a whole day (first → last, the ones between as waypoints). */
export function googleDirections(stops: Stop[], mode: TransportMode = 'drive'): { url: string; included: number } {
  if (!stops.length) return { url: 'https://www.google.com/maps', included: 0 }
  if (stops.length === 1) return { url: googlePlace(stops[0]), included: 1 }
  // too many stops: the first GOOGLE_MAX_WAYPOINTS + 2 (start, waypoints, end there)
  const used = stops.slice(0, GOOGLE_MAX_WAYPOINTS + 2)
  const waypoints = used.slice(1, -1)
  const q = new URLSearchParams({ api: '1', origin: ll(used[0].coords), destination: ll(used[used.length - 1].coords), travelmode: GOOGLE_MODE[mode] || 'driving' })
  if (waypoints.length) q.set('waypoints', waypoints.map((w) => ll(w.coords)).join('|'))
  return { url: `https://www.google.com/maps/dir/?${q}`, included: used.length }
}

export function googlePlace(s: Stop): string {
  const q = new URLSearchParams({ api: '1', query: `${s.name} ${ll(s.coords)}`.trim() })
  return `https://www.google.com/maps/search/?${q}`
}

/** Apple Maps takes one start and one destination (no stops in between). */
export function appleDirections(from: Stop | null, to: Stop, mode: TransportMode = 'drive'): string {
  const q = new URLSearchParams({ daddr: ll(to.coords), dirflg: APPLE_MODE[mode] || 'd' })
  if (from) q.set('saddr', ll(from.coords))
  return `https://maps.apple.com/?${q}`
}

export function applePlace(s: Stop): string {
  const q = new URLSearchParams({ ll: ll(s.coords), q: s.name })
  return `https://maps.apple.com/?${q}`
}
