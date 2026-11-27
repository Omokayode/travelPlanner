import { NextRequest, NextResponse } from 'next/server'
import { searchPlaces } from '@/lib/osm'

export const dynamic = 'force-dynamic'

// GET /api/geo/search?q=Nashville&limit=6 — place search (Nominatim, cached)
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 200)
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 5, 1), 10)
  if (q.length < 2) return NextResponse.json([])
  try {
    return NextResponse.json(await searchPlaces(q, limit))
  } catch (err) {
    console.error('Place search failed', err)
    return NextResponse.json({ error: 'Place search is unavailable right now' }, { status: 502 })
  }
}
