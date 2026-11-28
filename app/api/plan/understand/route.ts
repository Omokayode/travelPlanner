// POST /api/plan/understand {"text": "5 days in Arizona from Milwaukee, museums and hiking"}
// → an outline the new-trip page shows for checking (AI reads the words; cities are then looked up).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HttpError, handler, parseBody } from '@/lib/http'
import { AiError, ollamaUrl, readTripRequest } from '@/lib/server/ai'
import { locateCity } from '@/lib/server/planner'
import { todayLocal } from '@/lib/domain/dates'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const POST = handler(async (req: NextRequest) => {
  if (!ollamaUrl()) throw new HttpError(503, 'AI is not set up on this server')
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(3).max(2000) }))
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { homeCity: true } })
  try {
    const outline = await readTripRequest(text, todayLocal(), settings?.homeCity)
    // look the cities up now, so the page can show which ones were recognised
    const start = outline.start.name ? (await locateCity(outline.start)) ?? outline.start : outline.start
    const stays = []
    for (const s of outline.stays) stays.push({ ...s, city: (await locateCity(s.city)) ?? s.city })
    return NextResponse.json({ ...outline, start, stays })
  } catch (err) {
    if (err instanceof AiError) throw new HttpError(502, err.message)
    throw err
  }
})
