// lib/server/google.ts — Google Maps Platform, optional (Settings → Maps & Google).
//
//   server key  Routes API (toll prices), Places API (New) (hotels, ratings), tile sessions.
//               Never sent to the browser.
//   maps key    browser key for map tiles (referrer-restricted in Google Cloud).
//
// Google content (ratings, hotel details) is only kept in memory for a short time — it is
// never written to the database (Google Maps Platform terms).
import 'server-only'
import prisma from '@/lib/db'
import type { Coordinates } from '@/lib/types'
import { hotelFromGoogle, tollFromRoute, type GooglePlace, type Hotel } from '@/lib/domain/google'

export interface GoogleKeys {
  serverKey: string | null
  mapsKey: string | null
  tollPass: string | null
}

export async function googleKeys(): Promise<GoogleKeys> {
  const s = await prisma.appSettings.findUnique({
    where: { id: 'singleton' },
    select: { googleServerKey: true, googleMapsKey: true, tollPass: true },
  })
  return {
    serverKey: s?.googleServerKey || process.env.GOOGLE_SERVER_KEY || null,
    mapsKey: s?.googleMapsKey || process.env.GOOGLE_MAPS_KEY || null,
    tollPass: s?.tollPass || null,
  }
}

const mem = new Map<string, { until: number; value: unknown }>()
async function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = mem.get(key)
  if (hit && hit.until > Date.now()) return hit.value as T
  const value = await load()
  if (mem.size > 400) mem.delete(mem.keys().next().value as string)
  mem.set(key, { until: Date.now() + ttlMs, value })
  return value
}

export class GoogleError extends Error {}

async function post<T>(url: string, key: string, fieldMask: string, body: unknown, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    // Google's message says what is wrong with the key/API (never includes the key itself)
    const msg = await res.text().catch(() => '')
    const reason = /"message":\s*"([^"]{0,200})/.exec(msg)?.[1]
    throw new GoogleError(`Google ${res.status}${reason ? `: ${reason}` : ''}`)
  }
  return (await res.json()) as T
}

const latLng = (c: Coordinates) => ({ location: { latLng: { latitude: c.lat, longitude: c.lng } } })

/**
 * Toll price for driving a → b, from Google's Routes API. null = there are tolls but Google has
 * no price (or the call failed) — the caller falls back to the per-mile estimate.
 */
export async function routeTolls(a: Coordinates, b: Coordinates, keys?: GoogleKeys): Promise<number | null> {
  const k = keys ?? (await googleKeys())
  if (!k.serverKey) return null
  const id = `toll:${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}:${k.tollPass || ''}`
  try {
    return await remember(id, 12 * 3600_000, async () => {
      const data = await post<{ routes?: { travelAdvisory?: { tollInfo?: { estimatedPrice?: { currencyCode?: string; units?: string; nanos?: number }[] } } }[] }>(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        k.serverKey!,
        'routes.travelAdvisory.tollInfo,routes.distanceMeters',
        {
          origin: latLng(a),
          destination: latLng(b),
          travelMode: 'DRIVE',
          extraComputations: ['TOLLS'],
          ...(k.tollPass ? { routeModifiers: { tollPasses: [k.tollPass] } } : {}),
        },
      )
      if (!data.routes?.length) return null
      return tollFromRoute(data.routes[0])
    })
  } catch (err) {
    console.error('Toll lookup failed, using the estimate', err instanceof Error ? err.message : err)
    return null
  }
}

async function searchNearby(key: string, at: Coordinates, radiusM: number, types: string[], max = 20): Promise<GooglePlace[]> {
  const data = await post<{ places?: GooglePlace[] }>(
    'https://places.googleapis.com/v1/places:searchNearby',
    key,
    'places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri',
    {
      includedTypes: types,
      maxResultCount: Math.min(20, max),
      rankPreference: 'POPULARITY',
      locationRestriction: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: Math.min(50_000, radiusM) } },
    },
  )
  return data.places || []
}

/** Hotels near a point (Google), or null when there is no server key. */
export async function googleHotels(at: Coordinates, radiusM = 5000): Promise<Hotel[] | null> {
  const k = await googleKeys()
  if (!k.serverKey) return null
  const id = `hotels:${at.lat.toFixed(3)},${at.lng.toFixed(3)}:${radiusM}`
  return remember(id, 6 * 3600_000, async () =>
    (await searchNearby(k.serverKey!, at, radiusM, ['lodging'])).map((p) => hotelFromGoogle(p, at)).filter((h): h is Hotel => !!h),
  )
}

/** Popular sights near a point with their Google rating (for ranking only; kept in memory). */
export async function googleRatings(at: Coordinates, radiusM = 15000): Promise<{ name: string; coords: Coordinates; rating?: number; reviews?: number }[]> {
  const k = await googleKeys()
  if (!k.serverKey) return []
  const id = `ratings:${at.lat.toFixed(3)},${at.lng.toFixed(3)}:${radiusM}`
  try {
    return await remember(id, 6 * 3600_000, async () => {
      const lists = await Promise.all([
        searchNearby(k.serverKey!, at, radiusM, ['tourist_attraction']),
        searchNearby(k.serverKey!, at, radiusM, ['museum', 'park', 'historical_landmark']),
      ])
      return lists.flat().flatMap((p) =>
        p.displayName?.text && p.location
          ? [{ name: p.displayName.text, coords: { lat: p.location.latitude, lng: p.location.longitude }, rating: p.rating, reviews: p.userRatingCount }]
          : [],
      )
    })
  } catch (err) {
    console.error('Google ratings failed', err instanceof Error ? err.message : err)
    return []
  }
}

export type GoogleMapType = 'roadmap' | 'satellite' | 'terrain'

/**
 * A Map Tiles API session (made with the server key; the browser then fetches tiles with the
 * session + its own key). Sessions last about two weeks; we renew a day early.
 */
export async function tileSession(type: GoogleMapType): Promise<{ session: string; expiry: number } | null> {
  const k = await googleKeys()
  if (!k.serverKey || !k.mapsKey) return null
  const id = `tiles:${type}:${k.serverKey.slice(-6)}`
  const hit = mem.get(id) as { until: number; value: { session: string; expiry: number } } | undefined
  if (hit && hit.until > Date.now()) return hit.value
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(k.serverKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mapType: type,
      language: 'en-US',
      region: 'US',
      ...(type !== 'roadmap' ? { layerTypes: ['layerRoadmap'] } : {}), // terrain needs it; on satellite it adds labels
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    const reason = /"message":\s*"([^"]{0,200})/.exec(msg)?.[1]
    throw new GoogleError(`Google tiles ${res.status}${reason ? `: ${reason}` : ''}`)
  }
  const data = (await res.json()) as { session: string; expiry: string }
  const expiry = Number(data.expiry) * 1000
  const value = { session: data.session, expiry }
  mem.set(id, { until: Math.min(expiry - 24 * 3600_000, Date.now() + 7 * 24 * 3600_000), value })
  return value
}
