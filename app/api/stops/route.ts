import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { StopType } from '@/lib/types'

// Sample N evenly-spaced points along a GeoJSON linestring
function sampleRoutePoints(
  coords: [number, number][],
  numSamples: number
): [number, number][] {
  if (coords.length === 0) return []
  if (coords.length <= numSamples) return coords

  const step = Math.floor(coords.length / numSamples)
  const points: [number, number][] = []
  for (let i = 0; i < numSamples; i++) {
    points.push(coords[Math.min(i * step, coords.length - 1)])
  }
  return points
}

// Haversine distance in miles
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Find the minimum distance from a point to any point on the route
function minDistanceToRoute(
  lat: number,
  lng: number,
  routeCoords: [number, number][]
): number {
  let min = Infinity
  for (const [rlat, rlng] of routeCoords) {
    const d = distanceMiles(lat, lng, rlat, rlng)
    if (d < min) min = d
  }
  return min
}

export async function POST(req: NextRequest) {
  try {
    const { from, to, preferences, routeCoords } = await req.json()

    const tagMap: Partial<Record<StopType, string>> = {
      rest_area: 'amenity=rest_area',
      gas_station: 'amenity=fuel',
      food: 'amenity=restaurant',
      attraction: 'tourism=attraction',
      scenic: 'tourism=viewpoint',
      national_park: 'boundary=national_park',
      historical: 'historic=monument',
    }

    // Build bounding box with buffer
    const minLat = Math.min(from.lat, to.lat) - 1.0
    const maxLat = Math.max(from.lat, to.lat) + 1.0
    const minLng = Math.min(from.lng, to.lng) - 1.0
    const maxLng = Math.max(from.lng, to.lng) + 1.0
    const bbox = `${minLat},${minLng},${maxLat},${maxLng}`

    // Build Overpass query using bounding box + around for better results
    const prefs: StopType[] = preferences || ['rest_area', 'gas_station', 'food', 'attraction']

    // Sample route points for around queries
    let aroundClauses = ''
    if (routeCoords && routeCoords.length > 0) {
      const samples = sampleRoutePoints(routeCoords, 8)
      aroundClauses = prefs
        .filter(p => tagMap[p])
        .flatMap(p =>
          samples.map(([lat, lng]) => `node[${tagMap[p]}](around:30000,${lat},${lng});`)
        )
        .join('\n  ')
    } else {
      // Fallback: bounding box query
      aroundClauses = prefs
        .filter(p => tagMap[p])
        .map(p => `node[${tagMap[p]}](${bbox});`)
        .join('\n  ')
    }

    if (!aroundClauses) return NextResponse.json([])

    const query = `[out:json][timeout:30];
(
  ${aroundClauses}
);
out body 60;`

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'TripByJKBLabs/1.0 (travel planner app)',
        'Accept': 'application/json',
      },
    })

    if (!res.ok) throw new Error(`Overpass error: ${res.status}`)
    const data = await res.json()
    const elements = data.elements || []

    // Filter to stops within 15 miles of the route, and deduplicate
    const routePts: [number, number][] = routeCoords?.length
      ? routeCoords
      : [[from.lat, from.lng], [to.lat, to.lng]]

    const seen = new Set<number>()
    const stops = elements
      .filter((el: any) => {
        if (seen.has(el.id)) return false
        seen.add(el.id)
        if (!el.tags?.name) return false // skip unnamed
        const d = minDistanceToRoute(el.lat, el.lon, routePts)
        return d <= 15
      })
      .slice(0, 20)
      .map((el: any) => {
        const stopType =
          prefs.find(p => {
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
            name: el.tags.name || stopType.replace('_', ' '),
            coords: { lat: el.lat, lng: el.lon },
            address: el.tags['addr:full'] || el.tags['addr:street'],
            city: el.tags['addr:city'],
          },
          type: stopType,
          name: el.tags.name || stopType.replace('_', ' '),
          description: el.tags.description || el.tags['addr:city'],
          visited: false,
          isAutoSuggested: true,
        }
      })

    return NextResponse.json(stops)
  } catch (err) {
    console.error('Stops API error:', err)
    return NextResponse.json({ error: 'Failed to find stops' }, { status: 503 })
  }
}
