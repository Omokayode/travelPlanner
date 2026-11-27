// Old day page links (before 1.7.0): days now live on the trip page — 307 to the day there.
// A route handler rather than a page, so it is a real HTTP redirect (pages stream first).
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string; dayId: string } }) {
  const day = await prisma.day.findFirst({ where: { id: params.dayId, tripId: params.id }, select: { dayNumber: true } })
  const path = day ? `/trips/${encodeURIComponent(params.id)}#day-${day.dayNumber}` : `/trips/${encodeURIComponent(params.id)}`
  // same origin the browser used (behind the proxy), as in middleware.ts
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')).split(',')[0]
  return NextResponse.redirect(new URL(path, `${proto}://${host}`), 307)
}
