import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { handler, parseBody } from '@/lib/http'
import { tripCreateSchema } from '@/lib/schemas'
import { dayFields, dbDate, replaceDayContent, toTrip, tripInclude } from '@/lib/server/store'

export const dynamic = 'force-dynamic' // never pre-render or cache at build time

export const GET = handler(async () => {
  const trips = await prisma.trip.findMany({ include: tripInclude, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(trips.map(toTrip))
})

export const POST = handler(async (req: NextRequest) => {
  const body = await parseBody(req, tripCreateSchema)
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
    for (const d of body.days || []) {
      await tx.day.create({ data: { id: d.id, tripId: body.id, ...dayFields(d) } })
      await replaceDayContent(tx, d.id, d)
    }
    return tx.trip.findUniqueOrThrow({ where: { id: body.id }, include: tripInclude })
  })
  return NextResponse.json(toTrip(trip))
})
