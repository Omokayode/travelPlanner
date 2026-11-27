import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { dateSchema } from '@/lib/schemas'
import { resizeDays } from '@/lib/domain/trip'
import { dbDate, isoDate, recomputeVisitedCities } from '@/lib/server/store'
import type { Day } from '@/lib/types'

type Ctx = { params: { id: string } }

const body = z
  .object({ startDate: dateSchema, endDate: dateSchema })
  .refine((b) => b.endDate >= b.startDate, 'endDate must be on or after startDate')

/**
 * Change a trip's dates in one transaction: days keep their content and order and get the new
 * dates; empty days are added at the end, or the last days removed.
 */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { startDate, endDate } = await parseBody(req, body)

  const result = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: params.id },
      include: { days: { orderBy: { dayNumber: 'asc' }, select: { id: true, dayNumber: true, date: true } } },
    })
    if (!trip) throw notFound()
    // Only the id/number/date matter for resizing; content stays in its own tables.
    const current = trip.days.map((d) => ({ id: d.id, dayNumber: d.dayNumber, date: isoDate(d.date) }) as Day)
    const { days, added, removed } = resizeDays(current, startDate, endDate, randomUUID)
    const isNew = new Set(added.map((d) => d.id))

    if (removed.length) await tx.day.deleteMany({ where: { tripId: params.id, id: { in: removed.map((d) => d.id) } } })
    // In day order: numbers only ever move down, so no two days hold the same number at any point.
    for (const d of days) {
      const fields = { date: dbDate(d.date), dayNumber: d.dayNumber }
      if (isNew.has(d.id)) await tx.day.create({ data: { id: d.id, tripId: params.id, ...fields } })
      else await tx.day.update({ where: { id: d.id }, data: fields })
    }
    await tx.trip.update({ where: { id: params.id }, data: { startDate: dbDate(startDate), endDate: dbDate(endDate) } })
    if (removed.length) await recomputeVisitedCities(tx, params.id)
    return { days: days.length, removed: removed.length }
  })

  return NextResponse.json(result)
})
