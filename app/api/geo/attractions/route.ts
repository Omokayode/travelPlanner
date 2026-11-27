import { NextRequest, NextResponse } from 'next/server'
import { cityAttractions, nearbyPlaces } from '@/lib/osm'

export const dynamic = 'force-dynamic'

// GET /api/geo/attractions?lat=..&lng=..[&city=..]   or   ?city=Savannah
// Sights, museums, parks and places to eat (Overpass/Nominatim, cached).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const city = (sp.get('city') || '').trim().slice(0, 120)
  const lat = Number(sp.get('lat'))
  const lng = Number(sp.get('lng'))
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 10, 1), 30)
  const hasPoint = sp.has('lat') && sp.has('lng') && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  if (!hasPoint && !city) return NextResponse.json({ error: 'lat/lng or city is required' }, { status: 400 })
  try {
    return NextResponse.json(hasPoint ? await nearbyPlaces({ lat, lng }, limit, city || undefined) : await cityAttractions(city, limit))
  } catch (err) {
    console.error('Attraction lookup failed', err)
    return NextResponse.json({ error: 'Suggestions are unavailable right now' }, { status: 502 })
  }
}
