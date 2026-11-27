import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HttpError, handler, notFound, parseBody } from '@/lib/http'
import { daySchema, idSchema } from '@/lib/schemas'
import { dayFields, dayInclude, recomputeVisitedCities, replaceDayPlaces, toDay } from '@/lib/server/store'
import { planTravel } from '@/lib/server/travel'
import type { Vehicle } from '@/lib/types'

type Ctx = { params: { id: string; dayId: string } }

/**
 * Save a whole day: its fields and its places in order. Travel between places is worked out
 * first (routing calls, outside the transaction), then everything is written in one transaction.
 */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  if (!idSchema.safeParse(params.dayId).success) throw new HttpError(400, 'Invalid day id')
  const body = await parseBody(req, daySchema)

  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { id: true, vehicle: true } })
  if (!trip) throw notFound()
  const existing = await prisma.day.findUnique({ where: { id: params.dayId }, select: { tripId: true } })
  if (existing && existing.tripId !== params.id) throw notFound()

  const [settings, stored] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { gasPriceRegular: true, gasPricePremium: true, gasPriceDiesel: true } }),
    prisma.place.findMany({ where: { dayId: params.dayId }, select: { id: true, travelKey: true, travelMode: true } }),
  ])
  const places = await planTravel(body.places, {
    vehicle: trip.vehicle as Vehicle | null,
    gas: settings,
    stored: new Map(stored.map((s) => [s.id, { key: s.travelKey, mode: s.travelMode }])),
  })

  const day = await prisma.$transaction(async (tx) => {
    const fields = dayFields(body)
    await tx.day.upsert({
      where: { id: params.dayId },
      create: { id: params.dayId, tripId: params.id, ...fields },
      update: fields,
    })
    await replaceDayPlaces(tx, params.dayId, places)
    // cities are rebuilt from all visited days, so un-checking a day removes its cities
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
