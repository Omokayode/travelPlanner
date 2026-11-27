import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { packingItemSchema, packingListSchema } from '@/lib/schemas'

type Ctx = { params: { id: string } }

async function requireTrip(id: string) {
  const trip = await prisma.trip.findUnique({ where: { id }, select: { id: true } })
  if (!trip) throw notFound()
}

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const items = await prisma.packingItem.findMany({
    where: { tripId: params.id },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(items)
})

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, packingItemSchema)
  await requireTrip(params.id)
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
})

// Bulk replace (template loading) — all or nothing.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const items = await parseBody(req, packingListSchema)
  await requireTrip(params.id)
  const result = await prisma.$transaction(async (tx) => {
    await tx.packingItem.deleteMany({ where: { tripId: params.id } })
    await tx.packingItem.createMany({
      data: items.map((i) => ({
        tripId: params.id,
        name: i.name,
        category: i.category,
        packed: i.packed ?? false,
        quantity: i.quantity || 1,
        notes: i.notes ?? null,
        essential: i.essential ?? false,
      })),
    })
    return tx.packingItem.findMany({ where: { tripId: params.id } })
  })
  return NextResponse.json(result)
})
