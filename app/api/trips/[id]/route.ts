import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Trip } from '@/lib/types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: { days: { orderBy: { dayNumber: 'asc' } } },
    })
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...trip,
      lodgings: (trip.lodgings as object[] | null) ?? [],
      days: trip.days.map(d => ({ ...(d.data as object), id: d.id })),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body: Partial<Trip> = await req.json()

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
        vehicle: body.vehicle ? (body.vehicle as object) : undefined,
        homeCoords: body.homeCoords ? (body.homeCoords as object) : undefined,
        lodgings: body.lodgings ? (body.lodgings as object) : undefined,
      },
      include: { days: { orderBy: { dayNumber: 'asc' } } },
    })

    return NextResponse.json({
      ...trip,
      lodgings: (trip.lodgings as object[] | null) ?? [],
      days: trip.days.map(d => ({ ...(d.data as object), id: d.id })),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.trip.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
}
