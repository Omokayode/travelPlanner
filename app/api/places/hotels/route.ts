// GET /api/places/hotels?lat=&lng=&city=&checkIn=&checkOut= — a few hotels near a point, each with
// a "check prices" link for those dates.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handler, HttpError } from '@/lib/http'
import { bookingUrl } from '@/lib/domain/google'
import { hotelsNear } from '@/lib/server/hotels'

export const dynamic = 'force-dynamic'

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  city: z.string().max(200).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const GET = handler(async (req: NextRequest) => {
  const parsed = q.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) throw new HttpError(400, 'lat, lng, checkIn and checkOut are required')
  const { lat, lng, city, checkIn, checkOut } = parsed.data
  let hotels
  try {
    hotels = await hotelsNear({ lat, lng }, 6)
  } catch {
    throw new HttpError(503, 'Hotel lookup is unavailable right now')
  }
  return NextResponse.json(hotels.map((h) => ({ ...h, bookingUrl: bookingUrl(h.name, city, checkIn, checkOut) })))
})
