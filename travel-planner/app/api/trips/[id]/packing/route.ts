import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const items = await prisma.packingItem.findMany({
      where: { tripId: params.id },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(items)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch packing list' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const item = await prisma.packingItem.create({
      data: {
        tripId: params.id,
        name: body.name,
        category: body.category,
        packed: false,
        quantity: body.quantity || 1,
        notes: body.notes ?? null,
        essential: body.essential ?? false,
      },
    })
    return NextResponse.json(item)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}

// Bulk replace (for template loading)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const items = await req.json()
    await prisma.packingItem.deleteMany({ where: { tripId: params.id } })
    await prisma.packingItem.createMany({
      data: items.map((item: any) => ({ ...item, tripId: params.id })),
    })
    const result = await prisma.packingItem.findMany({ where: { tripId: params.id } })
    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to replace packing list' }, { status: 500 })
  }
}
