import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const expenses = await prisma.expense.findMany({
      where: { tripId: params.id },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(expenses)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const expense = await prisma.expense.create({
      data: {
        tripId: params.id,
        dayId: body.dayId,
        name: body.name,
        amount: body.amount,
        category: body.category,
        date: body.date,
        notes: body.notes ?? null,
        receipt: body.receipt ?? null,
        paymentMethod: body.paymentMethod ?? null,
      },
    })
    return NextResponse.json(expense)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 })
  }
}
