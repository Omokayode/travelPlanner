// lib/domain/geo.ts — distance helpers.
import type { Coordinates } from '@/lib/types'

const EARTH_RADIUS_MILES = 3958.8
const rad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in miles. */
export function haversineMiles(a: Coordinates, b: Coordinates): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Shortest distance (miles) from a point to any vertex of a route given as [lat, lng] pairs. */
export function minDistanceToRoute(point: Coordinates, route: [number, number][]): number {
  let min = Infinity
  for (const [lat, lng] of route) {
    const d = haversineMiles(point, { lat, lng })
    if (d < min) min = d
  }
  return min
}
