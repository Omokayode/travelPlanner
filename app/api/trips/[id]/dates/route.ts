import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HttpError, handler, notFound, parseBody } from '@/lib/http'
import { dateSchema } from '@/lib/schemas'
import { resizeDays } from '@/lib/domain/trip'
import type { Day } from '@/lib/types'

type Ctx = { params: { id: string } }

const body = z
  .object({ startDate: dateSchema, endDate: dateSchema })
  .refine((b) => b.endDate >= b.startDate, 'endDate must be on or after startDate')

/**
 * Change a trip's dates in one transaction: days keep their content and order, get the new
 * dates, empty days are added at the end or the last days removed.
 */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { startDate, endDate } = await parseBody(req, body)
  if (startDate > endDate) throw new HttpError(400, 'endDate must be on or after startDate')

  const result = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id: params.id }, include: { days: true } })
    if (!trip) throw notFound()
    const current = trip.days.map((d) => ({ ...(d.data as object), id: d.id, dayNumber: d.dayNumber }) as Day)
    const { days, removed } = resizeDays(current, startDate, endDate, randomUUID)

    if (removed.length) await tx.day.deleteMany({ where: { tripId: params.id, id: { in: removed.map((d) => d.id) } } })
    for (const d of days) {
      const data = d as unknown as Prisma.InputJsonObject
      await tx.day.upsert({
        where: { id: d.id },
        create: { id: d.id, tripId: params.id, date: d.date, dayNumber: d.dayNumber, data },
        update: { date: d.date, dayNumber: d.dayNumber, data },
      })
    }
    await tx.trip.update({ where: { id: params.id }, data: { startDate, endDate } })
    return { days: days.length, removed: removed.length }
  })

  return NextResponse.json(result)
})
