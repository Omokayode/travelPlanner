// PUT /api/trips/:id/days  {"days": [day, …]} — save several days at once, in one transaction.
// Used when a place moves from one day to another (it must leave one day and join the other
// together, or not at all).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HttpError, handler, notFound, parseBody } from '@/lib/http'
import { daySchema, idSchema } from '@/lib/schemas'
import { dayFields, dayInclude, recomputeVisitedCities, replaceDayPlaces, toDay } from '@/lib/server/store'
import { planTravel, type PlannedPlace } from '@/lib/server/travel'
import type { Vehicle } from '@/lib/types'

type Ctx = { params: { id: string } }

const body = z.object({ days: z.array(daySchema.extend({ id: idSchema })).min(1).max(10) })

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { days } = await parseBody(req, body)
  if (new Set(days.map((d) => d.id)).size !== days.length) throw new HttpError(400, 'Each day only once')

  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { vehicle: true } })
  if (!trip) throw notFound()
  const owned = await prisma.day.count({ where: { tripId: params.id, id: { in: days.map((d) => d.id) } } })
  if (owned !== days.length) throw notFound() // every day must exist and belong to this trip

  const [settings, stored] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { gasPriceRegular: true, gasPricePremium: true, gasPriceDiesel: true } }),
    prisma.place.findMany({ where: { dayId: { in: days.map((d) => d.id) } }, select: { id: true, travelKey: true, travelMode: true } }),
  ])
  const ctx = {
    vehicle: trip.vehicle as Vehicle | null,
    gas: settings,
    stored: new Map(stored.map((s) => [s.id, { key: s.travelKey, mode: s.travelMode }])),
  }
  const planned: PlannedPlace[][] = []
  for (const d of days) planned.push(await planTravel(d.places, ctx))

  const saved = await prisma.$transaction(async (tx) => {
    // clear all first, so a place can move between the days without clashing with itself
    await tx.place.deleteMany({ where: { dayId: { in: days.map((d) => d.id) } } })
    for (let i = 0; i < days.length; i++) {
      await tx.day.update({ where: { id: days[i].id }, data: dayFields(days[i]) })
      await replaceDayPlaces(tx, days[i].id, planned[i])
    }
    await recomputeVisitedCities(tx, params.id)
    return tx.day.findMany({ where: { id: { in: days.map((d) => d.id) } }, include: dayInclude, orderBy: { dayNumber: 'asc' } })
  })
  return NextResponse.json(saved.map(toDay))
})
