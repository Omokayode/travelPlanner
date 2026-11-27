import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HttpError, handler, notFound, parseBody } from '@/lib/http'
import { daySchema, idSchema } from '@/lib/schemas'
import { dayFields, dayInclude, recomputeVisitedCities, replaceDayContent, toDay } from '@/lib/server/store'

type Ctx = { params: { id: string; dayId: string } }

/** Save a whole day (its fields, legs, stops and activities) in one transaction. */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  if (!idSchema.safeParse(params.dayId).success) throw new HttpError(400, 'Invalid day id')
  const body = await parseBody(req, daySchema)

  const day = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!trip) throw notFound()
    const existing = await tx.day.findUnique({ where: { id: params.dayId }, select: { tripId: true } })
    if (existing && existing.tripId !== params.id) throw notFound()

    const fields = dayFields(body)
    await tx.day.upsert({
      where: { id: params.dayId },
      create: { id: params.dayId, tripId: params.id, ...fields },
      update: fields,
    })
    await replaceDayContent(tx, params.dayId, body)
    // visitedCities is rebuilt from all visited days, so un-checking a day removes its cities.
    await recomputeVisitedCities(tx, params.id)
    return tx.day.findUniqueOrThrow({ where: { id: params.dayId }, include: dayInclude })
  })

  return NextResponse.json(toDay(day))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.day.deleteMany({ where: { id: params.dayId, tripId: params.id } })
    if (!count) throw notFound()
    await recomputeVisitedCities(tx, params.id)
  })
  return NextResponse.json({ success: true })
})
