import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { HttpError, handler, notFound, parseBody } from '@/lib/http'
import { daySchema, idSchema } from '@/lib/schemas'

type Ctx = { params: { id: string; dayId: string } }

interface DayBlob {
  visited?: boolean
  startCity?: string
  endCity?: string
  segments?: {
    from?: { city?: string; state?: string; name?: string }
    to?: { city?: string; state?: string; name?: string }
    stops?: { location?: { city?: string; state?: string; name?: string } }[]
  }[]
}

function visitedCities(days: DayBlob[]): string[] {
  const cities = new Set<string>()
  const add = (v: string | undefined) => {
    if (v?.trim()) cities.add(v.trim())
  }
  for (const d of days) {
    if (!d?.visited) continue
    add(d.startCity)
    add(d.endCity)
    for (const seg of d.segments || []) {
      add(seg.from?.city || seg.from?.state || seg.from?.name)
      add(seg.to?.city || seg.to?.state || seg.to?.name)
      for (const stop of seg.stops || []) add(stop.location?.city || stop.location?.state || stop.location?.name)
    }
  }
  return Array.from(cities)
}

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  if (!idSchema.safeParse(params.dayId).success) throw new HttpError(400, 'Invalid day id')
  const body = await parseBody(req, daySchema)
  const data = { ...body, id: params.dayId } as Prisma.InputJsonObject

  const day = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!trip) throw notFound()
    const existing = await tx.day.findUnique({ where: { id: params.dayId }, select: { tripId: true } })
    if (existing && existing.tripId !== params.id) throw notFound()

    const saved = await tx.day.upsert({
      where: { id: params.dayId },
      create: { id: params.dayId, tripId: params.id, date: body.date, dayNumber: body.dayNumber, data },
      update: { date: body.date, dayNumber: body.dayNumber, data },
    })

    // Recalculate visitedCities from all visited days, so un-checking a day removes its cities.
    const days = await tx.day.findMany({
      where: { tripId: params.id },
      orderBy: { dayNumber: 'asc' },
      select: { data: true },
    })
    await tx.trip.update({
      where: { id: params.id },
      data: { visitedCities: visitedCities(days.map((d) => d.data as DayBlob)) },
    })
    return saved
  })

  return NextResponse.json({ ...(day.data as object), id: day.id })
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  const { count } = await prisma.day.deleteMany({ where: { id: params.dayId, tripId: params.id } })
  if (!count) throw notFound()
  return NextResponse.json({ success: true })
})
