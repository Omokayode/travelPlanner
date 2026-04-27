import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Trip } from '@/lib/types'

export async function GET() {
  try {
    const trips = await prisma.trip.findMany({
      include: { days: { orderBy: { dayNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    const result = trips.map(t => ({
      ...t,
      days: t.days.map(d => ({ ...(d.data as object), id: d.id })),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Trip = await req.json()

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
        vehicle: body.vehicle ? (body.vehicle as object) : undefined,
        homeCoords: body.homeCoords ? (body.homeCoords as object) : undefined,
        days: {
          create: (body.days || []).map(d => ({
            id: d.id,
            date: d.date,
            dayNumber: d.dayNumber,
            data: d as object,
          })),
        },
      },
      include: { days: true },
    })

    return NextResponse.json({
      ...trip,
      days: trip.days.map(d => ({ ...(d.data as object), id: d.id })),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
}
