import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { handler, parseBody } from '@/lib/http'
import { tripCreateSchema } from '@/lib/schemas'
import { dayFields, dbDate, replaceDayPlaces, toTrip, tripInclude } from '@/lib/server/store'
import { planTravel, type PlannedPlace } from '@/lib/server/travel'
import type { Vehicle } from '@/lib/types'

export const dynamic = 'force-dynamic' // never pre-render or cache at build time
export const maxDuration = 300

export const GET = handler(async () => {
  const trips = await prisma.trip.findMany({ include: tripInclude, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(trips.map(toTrip))
})

export const POST = handler(async (req: NextRequest) => {
  const body = await parseBody(req, tripCreateSchema)
  // travel between any places sent with the new days (the wizard sends empty days)
  // (one day at a time: a planned trip can have many hops, and the routing service is shared)
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { gasPriceRegular: true, gasPricePremium: true, gasPriceDiesel: true } })
  const planned: PlannedPlace[][] = []
  for (const d of body.days || []) {
    planned.push(await planTravel(d.places, { vehicle: (body.vehicle as Vehicle | null) ?? null, gas: settings, stored: new Map() }))
  }
  const trip = await prisma.$transaction(async (tx) => {
    await tx.trip.create({
      data: {
        id: body.id,
        name: body.name,
        description: body.description,
        startDate: dbDate(body.startDate),
        endDate: dbDate(body.endDate),
        type: body.type,
        visitedCities: body.visitedCities || [],
        coverPhotoUrl: body.coverPhotoUrl,
        totalBudget: body.totalBudget,
        tags: body.tags || [],
        isActive: body.isActive || false,
        vehicle: (body.vehicle as Prisma.InputJsonObject) ?? undefined,
        homeCoords: (body.homeCoords as Prisma.InputJsonObject) ?? undefined,
      },
    })
    const days = body.days || []
    for (let i = 0; i < days.length; i++) {
      await tx.day.create({ data: { id: days[i].id, tripId: body.id, ...dayFields(days[i]) } })
      await replaceDayPlaces(tx, days[i].id, planned[i])
    }
    return tx.trip.findUniqueOrThrow({ where: { id: body.id }, include: tripInclude })
  })
  return NextResponse.json(toTrip(trip))
})
