import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { tripUpdateSchema } from '@/lib/schemas'

type Ctx = { params: { id: string } }

function view(trip: Prisma.TripGetPayload<{ include: { days: true } }>) {
  return {
    ...trip,
    lodgings: (trip.lodgings as object[] | null) ?? [],
    days: trip.days.map((d) => ({ ...(d.data as object), id: d.id })),
  }
}

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: { days: { orderBy: { dayNumber: 'asc' } } },
  })
  if (!trip) throw notFound()
  return NextResponse.json(view(trip))
})

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, tripUpdateSchema)
  const trip = await prisma.trip.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      type: body.type,
      visitedCities: body.visitedCities,
      coverPhotoUrl: body.coverPhotoUrl,
      totalBudget: body.totalBudget,
      tags: body.tags,
      isActive: body.isActive,
      vehicle: body.vehicle ? (body.vehicle as Prisma.InputJsonObject) : undefined,
      homeCoords: body.homeCoords ? (body.homeCoords as Prisma.InputJsonObject) : undefined,
      lodgings: body.lodgings ? (body.lodgings as Prisma.InputJsonArray) : undefined,
    },
    include: { days: { orderBy: { dayNumber: 'asc' } } },
  })
  return NextResponse.json(view(trip))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  await prisma.trip.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
})
