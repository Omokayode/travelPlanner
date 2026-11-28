// POST /api/places/refresh {lat, lng} — ask OpenStreetMap again for the area around a point
// (replaces what the cache had for it).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handler, HttpError, parseBody } from '@/lib/http'
import { areaFor, fillArea } from '@/lib/server/poiCache'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })

export const POST = handler(async (req: NextRequest) => {
  const at = await parseBody(req, body)
  try {
    await fillArea(at)
  } catch (err) {
    throw new HttpError(503, `OpenStreetMap is busy, try again later (${err instanceof Error ? err.message : 'error'})`)
  }
  const area = await prisma.poiArea.findUnique({ where: { key: areaFor(at).key } })
  return NextResponse.json({ key: area?.key, count: area?.count ?? 0 })
})
