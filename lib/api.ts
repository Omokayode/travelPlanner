// lib/api.ts

import { GeoLocation, NominatimResult, OSRMRoute, OverpassElement, Coordinates } from './types'
import { USER_AGENT } from './config'

// ─── Nominatim Geocoding ───────────────────────────────────────────────────────

export async function searchPlaces(query: string, limit = 5): Promise<GeoLocation[]> {
  if (!query.trim()) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
    })
    const data: NominatimResult[] = await res.json()
    return data.map(item => ({
      id: `nominatim_${item.place_id}`,
      name: item.display_name.split(',')[0],
      address: item.display_name,
      coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
      city: item.address?.city || item.address?.town || item.address?.village,
      state: item.address?.state,
      country: item.address?.country,
    }))
  } catch (err) {
    console.error('Geocoding error:', err)
    return []
  }
}

// ─── OSRM Routing ─────────────────────────────────────────────────────────────

export async function getRoute(
  from: Coordinates,
  to: Coordinates,
  waypoints: Coordinates[] = []
): Promise<{ distanceMiles: number; durationMinutes: number; coords: [number, number][] } | null> {
  try {
    const points = [from, ...waypoints, to]
    const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
    const res = await fetch(url)
    const data = await res.json()
    if (!data.routes?.length) return null
    const route: OSRMRoute = data.routes[0]
    return {
      distanceMiles: route.distance / 1609.34,
      durationMinutes: route.duration / 60,
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    }
  } catch (err) {
    console.error('Routing error:', err)
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

export async function getCityAttractions(city: string, limit = 10): Promise<Omit<import('./types').Activity, 'id' | 'visited'>[]> {
  try {
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    const cityRes = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const cityData = await cityRes.json()
    if (!cityData.length) return []

    const lat = parseFloat(cityData[0].lat)
    const lng = parseFloat(cityData[0].lon)
    const radius = 5000 // 5km

    const query = `[out:json][timeout:25];
(
  node["tourism"="attraction"](around:${radius},${lat},${lng});
  node["tourism"="museum"](around:${radius},${lat},${lng});
  node["amenity"="restaurant"]["cuisine"](around:2000,${lat},${lng});
);
out body ${limit};`

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    })
    const data = await res.json()

    return (data.elements || []).slice(0, limit).map((el: OverpassElement) => ({
      name: el.tags.name || 'Unknown',
      type: el.tags.tourism ? 'attraction' : 'food',
      location: {
        id: `osm_${el.id}`,
        name: el.tags.name || 'Unknown',
        coords: { lat: el.lat, lng: el.lon },
        city,
      },
      website: el.tags.website,
      notes: el.tags.description || el.tags.cuisine,
    }))
  } catch {
    return []
  }
}
