import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { HttpError, handler, parseBody } from '@/lib/http'
import { tripCreateSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic' // never pre-render or cache at build time

export const GET = handler(async () => {
  const trips = await prisma.trip.findMany({
    include: { days: { orderBy: { dayNumber: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(
    trips.map((t) => ({
      ...t,
      days: t.days.map((d) => ({ ...(d.data as object), id: d.id })),
    })),
  )
})

export const POST = handler(async (req: NextRequest) => {
  const body = await parseBody(req, tripCreateSchema)
  try {
    const trip = await prisma.trip.create({
      data: {
        id: body.id,
        name: body.name,
        description: body.description,
        startDate: body.startDate,
        endDate: body.endDate,
        type: body.type,
        visitedCities: body.visitedCities || [],
        coverPhotoUrl: body.coverPhotoUrl,
        totalBudget: body.totalBudget,
        tags: body.tags || [],
        isActive: body.isActive || false,
        vehicle: (body.vehicle as Prisma.InputJsonObject) ?? undefined,
        homeCoords: (body.homeCoords as Prisma.InputJsonObject) ?? undefined,
        days: {
          create: (body.days || []).map((d) => ({
            id: d.id,
            date: d.date,
            dayNumber: d.dayNumber,
            data: d as Prisma.InputJsonObject,
          })),
        },
      },
      include: { days: true },
    })
    return NextResponse.json({
      ...trip,
      days: trip.days.map((d) => ({ ...(d.data as object), id: d.id })),
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A trip or day with that id already exists')
    }
    throw err
  }
})
