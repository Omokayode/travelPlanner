import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await req.json()
    const item = await prisma.packingItem.update({
      where: { id: params.itemId },
      data: {
        name: body.name,
        category: body.category,
        packed: body.packed,
        quantity: body.quantity,
        notes: body.notes ?? null,
        essential: body.essential ?? false,
      },
    })
    return NextResponse.json(item)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    await prisma.packingItem.delete({ where: { id: params.itemId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
