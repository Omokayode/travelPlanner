import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { tripUpdateSchema } from '@/lib/schemas'
import { dbDate, replaceLodgings, toTrip, tripInclude } from '@/lib/server/store'

type Ctx = { params: { id: string } }

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, include: tripInclude })
  if (!trip) throw notFound()
  return NextResponse.json(toTrip(trip))
})

/** Update trip fields; `lodgings`, when sent, replaces the whole list. Days have their own routes. */
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, tripUpdateSchema)
  const trip = await prisma.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
        startDate: body.startDate ? dbDate(body.startDate) : undefined,
        endDate: body.endDate ? dbDate(body.endDate) : undefined,
        type: body.type,
        visitedCities: body.visitedCities,
        coverPhotoUrl: body.coverPhotoUrl,
        totalBudget: body.totalBudget,
        tags: body.tags,
        isActive: body.isActive,
        vehicle: body.vehicle ? (body.vehicle as Prisma.InputJsonObject) : undefined,
        homeCoords: body.homeCoords ? (body.homeCoords as Prisma.InputJsonObject) : undefined,
      },
    })
    if (body.lodgings) await replaceLodgings(tx, params.id, body.lodgings)
    return tx.trip.findUniqueOrThrow({ where: { id: params.id }, include: tripInclude })
  })
  return NextResponse.json(toTrip(trip))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  await prisma.trip.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
})
