import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: params.id } })
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json((trip as any).proposedBudget ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    await prisma.trip.update({
      where: { id: params.id },
      data: { proposedBudget: body } as any,
    })
    return NextResponse.json(body)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
