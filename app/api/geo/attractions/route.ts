import { NextRequest, NextResponse } from 'next/server'
import { cityAttractions } from '@/lib/osm'

export const dynamic = 'force-dynamic'

// GET /api/geo/attractions?city=Savannah&limit=10 — sights and restaurants (Nominatim + Overpass, cached)
export async function GET(req: NextRequest) {
  const city = (req.nextUrl.searchParams.get('city') || '').trim().slice(0, 120)
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 10, 1), 30)
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 })
  try {
    return NextResponse.json(await cityAttractions(city, limit))
  } catch (err) {
    console.error('Attraction lookup failed', err)
    return NextResponse.json({ error: 'Suggestions are unavailable right now' }, { status: 502 })
  }
}
