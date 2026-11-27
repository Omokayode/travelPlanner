import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { packingItemSchema } from '@/lib/schemas'

type Ctx = { params: { id: string; itemId: string } }

// Every query matches the trip in the URL as well as the item id.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, packingItemSchema)
  const { count } = await prisma.packingItem.updateMany({
    where: { id: params.itemId, tripId: params.id },
    data: {
      name: body.name,
      category: body.category,
      packed: body.packed,
      quantity: body.quantity,
      notes: body.notes ?? null,
      essential: body.essential ?? false,
    },
  })
  if (!count) throw notFound()
  return NextResponse.json(await prisma.packingItem.findUnique({ where: { id: params.itemId } }))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  const { count } = await prisma.packingItem.deleteMany({ where: { id: params.itemId, tripId: params.id } })
  if (!count) throw notFound()
  return NextResponse.json({ success: true })
})
