import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import type { PlaceCategory } from '@/lib/types'
import { minDistanceToRoute } from '@/lib/domain/geo'
import { overpass } from '@/lib/osm'

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


const coord = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
const stopsRequest = z.object({
  from: coord,
  to: coord,
  preferences: z
    .array(z.enum(['rest_area', 'gas_station', 'food', 'attraction', 'scenic', 'bucees', 'state_line', 'historical', 'national_park', 'viewpoint', 'love_lock']))
    .max(20)
    .optional(),
  routeCoords: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).max(50_000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = stopsRequest.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { from, to, preferences, routeCoords } = parsed.data

    const tagMap: Partial<Record<PlaceCategory, string>> = {
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
    const prefs: PlaceCategory[] = preferences || ['rest_area', 'gas_station', 'food', 'attraction']

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

    const elements = await overpass(query)

    // Filter to stops within 15 miles of the route, and deduplicate
    const routePts: [number, number][] = routeCoords?.length
      ? routeCoords
      : [[from.lat, from.lng], [to.lat, to.lng]]

    const seen = new Set<number>()
    const stops = elements
      .filter((el) => {
        if (seen.has(el.id)) return false
        seen.add(el.id)
        if (!el.tags?.name) return false // skip unnamed
        const d = minDistanceToRoute({ lat: el.lat, lng: el.lon }, routePts)
        return d <= 15
      })
      .slice(0, 20)
      .map((el) => {
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
          category: stopType,
          name: el.tags.name || stopType.replace('_', ' '),
          notes: el.tags.description,
        }
      })

    return NextResponse.json(stops)
  } catch (err) {
    console.error('Stops API error:', err)
    return NextResponse.json({ error: 'Failed to find stops' }, { status: 503 })
  }
}
