import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Day } from '@/lib/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  try {
    const body: Day = await req.json()

    const day = await prisma.day.upsert({
      where: { id: params.dayId },
      create: {
        id: params.dayId,
        tripId: params.id,
        date: body.date,
        dayNumber: body.dayNumber,
        data: body as object,
      },
      update: {
        date: body.date,
        dayNumber: body.dayNumber,
        data: body as object,
      },
    })

    // Always recalculate visitedCities from ALL visited days
    // so unchecking a day removes its cities correctly
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: { days: { orderBy: { dayNumber: 'asc' } } },
    })
    if (trip) {
      const citiesToAdd = new Set<string>()

      for (const d of trip.days) {
        const dayData = d.id === params.dayId ? body : (d.data as any)
        if (!dayData?.visited) continue

        const addCity = (v: string | undefined) => { if (v?.trim()) citiesToAdd.add(v.trim()) }

        addCity(dayData.startCity)
        addCity(dayData.endCity)

        for (const seg of (dayData.segments || [])) {
          addCity(seg.from?.city || seg.from?.state || seg.from?.name)
          addCity(seg.to?.city || seg.to?.state || seg.to?.name)
          for (const stop of (seg.stops || [])) {
            addCity(stop.location?.city || stop.location?.state || stop.location?.name)
          }
        }
      }

      await prisma.trip.update({
        where: { id: params.id },
        data: { visitedCities: Array.from(citiesToAdd) },
      })
    }

    return NextResponse.json({ ...(day.data as object), id: day.id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update day' }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  try {
    await prisma.day.delete({ where: { id: params.dayId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete day' }, { status: 500 })
  }
}
