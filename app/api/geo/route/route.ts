import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { drivingRoute } from '@/lib/osm'
import { handler, parseBody } from '@/lib/http'

// POST /api/geo/route { points: [{lat,lng}, ...] } — driving route through the points (OSRM, cached)
const body = z.object({
  points: z
    .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
    .min(2)
    .max(25),
})

export const POST = handler(async (req: NextRequest) => {
  const { points } = await parseBody(req, body)
  try {
    const route = await drivingRoute(points)
    if (!route) return NextResponse.json({ error: 'No driving route found' }, { status: 404 })
    return NextResponse.json(route)
  } catch (err) {
    console.error('Routing failed', err)
    return NextResponse.json({ error: 'Routing is unavailable right now' }, { status: 502 })
  }
})
