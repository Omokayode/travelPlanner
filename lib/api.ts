// lib/api.ts

import { GeoLocation, NominatimResult, OSRMRoute, OverpassElement, Stop, StopType, Coordinates } from './types'
import { v4 as uuidv4 } from 'uuid'

// ─── Nominatim Geocoding ───────────────────────────────────────────────────────

export async function searchPlaces(query: string, limit = 5): Promise<GeoLocation[]> {
  if (!query.trim()) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Trip by JKBLabs-TravelPlanner/1.0' },
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

export async function reverseGeocode(lat: number, lng: number): Promise<GeoLocation | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Trip by JKBLabs-TravelPlanner/1.0' },
    })
    const data: NominatimResult & { display_name: string } = await res.json()
    return {
      id: `rev_${lat}_${lng}`,
      name: data.display_name.split(',')[0],
      address: data.display_name,
      coords: { lat, lng },
      city: (data as any).address?.city || (data as any).address?.town,
      state: (data as any).address?.state,
      country: (data as any).address?.country,
    }
  } catch {
    return null
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

// ─── Overpass API (OSM) - Find stops along route ──────────────────────────────

export async function findStopsAlongRoute(
  from: Coordinates,
  to: Coordinates,
  preferences: StopType[] = ['rest_area', 'gas_station', 'food', 'attraction', 'scenic']
): Promise<Stop[]> {
  // Build bounding box with buffer around the route
  const minLat = Math.min(from.lat, to.lat) - 0.5
  const maxLat = Math.max(from.lat, to.lat) + 0.5
  const minLng = Math.min(from.lng, to.lng) - 0.5
  const maxLng = Math.max(from.lng, to.lng) + 0.5
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`

  const tagMap: Partial<Record<StopType, string>> = {
    rest_area: 'amenity=rest_area',
    gas_station: 'amenity=fuel',
    food: 'amenity=restaurant',
    attraction: 'tourism=attraction',
    scenic: 'tourism=viewpoint',
    national_park: 'boundary=national_park',
    historical: 'historic=monument',
  }

  const queryTags = preferences
    .filter(p => tagMap[p])
    .map(p => `node[${tagMap[p]}](${bbox});`)
    .join('\n')

  if (!queryTags) return []

  const query = `[out:json][timeout:25];
(
  ${queryTags}
);
out body 20;`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    })
    const data = await res.json()
    const elements: OverpassElement[] = data.elements || []

    return elements.slice(0, 15).map(el => {
      const stopType = preferences.find(p => {
        const tag = tagMap[p]
        if (!tag) return false
        const [key, val] = tag.split('=')
        return el.tags[key] === val
      }) || 'attraction'

      return {
        id: uuidv4(),
        osmId: String(el.id),
        location: {
          id: `osm_${el.id}`,
          name: el.tags.name || `${stopType.replace('_', ' ')}`,
          coords: { lat: el.lat, lng: el.lon },
          address: el.tags['addr:full'] || el.tags['addr:street'],
        },
        type: stopType,
        name: el.tags.name || `${stopType.replace('_', ' ')}`,
        description: el.tags.description || el.tags['addr:city'],
        rating: el.tags.stars ? parseFloat(el.tags.stars) : undefined,
        visited: false,
        isAutoSuggested: true,
      }
    })
  } catch (err) {
    console.error('Overpass error:', err)
    return []
  }
}

// ─── Fuel Calculations ────────────────────────────────────────────────────────

export function calculateFuelCost(
  distanceMiles: number,
  mpg: number,
  pricePerGallon: number
): { gallons: number; cost: number } {
  const gallons = distanceMiles / mpg
  return {
    gallons: Math.round(gallons * 100) / 100,
    cost: Math.round(gallons * pricePerGallon * 100) / 100,
  }
}

export function estimateTolls(distanceMiles: number): number {
  // Very rough estimate: ~$0.05/mile average in high-toll areas
  // This is a placeholder — real toll calculation requires TollGuru or similar
  return Math.round(distanceMiles * 0.04 * 100) / 100
}

// ─── Map URL Generators ───────────────────────────────────────────────────────

export function getGoogleMapsUrl(
  from: GeoLocation,
  to: GeoLocation,
  stops: GeoLocation[] = [],
  segments: { from: GeoLocation; to: GeoLocation; stops?: { location: GeoLocation }[] }[] = []
): string {
  // Build ordered waypoints from all segments
  const waypoints: string[] = []

  if (segments.length > 1) {
    // Multi-segment day: add each segment's destination (except the last) as waypoints
    // plus any stops along the way
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      // Add stops within this segment
      for (const stop of (seg.stops || [])) {
        waypoints.push(`${stop.location.coords.lat},${stop.location.coords.lng}`)
      }
      // Add segment destination as waypoint (except the final destination)
      if (i < segments.length - 1) {
        waypoints.push(`${seg.to.coords.lat},${seg.to.coords.lng}`)
      }
    }
  } else {
    // Single segment: just use the stops passed in
    for (const s of stops) {
      waypoints.push(`${s.coords.lat},${s.coords.lng}`)
    }
  }

  const waypointsParam = waypoints.length
    ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}`
    : ''

  // Use coordinates for origin/destination for accuracy
  const origin = `${from.coords.lat},${from.coords.lng}`
  const destination = `${to.coords.lat},${to.coords.lng}`

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`
}

export function getAppleMapsUrl(from: GeoLocation, to: GeoLocation): string {
  return `https://maps.apple.com/?saddr=${encodeURIComponent(from.name)}&daddr=${encodeURIComponent(to.name)}&dirflg=d`
}

export function getWazeUrl(to: GeoLocation): string {
  return `https://waze.com/ul?ll=${to.coords.lat},${to.coords.lng}&navigate=yes`
}

// ─── City Suggestions for Activities ─────────────────────────────────────────

export async function getCityAttractions(city: string, limit = 10): Promise<Omit<import('./types').Activity, 'id' | 'visited'>[]> {
  try {
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    const cityRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Trip by JKBLabs-TravelPlanner/1.0' },
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
