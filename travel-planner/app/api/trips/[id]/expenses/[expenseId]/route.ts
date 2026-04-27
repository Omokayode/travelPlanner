import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  try {
    const body = await req.json()
    const expense = await prisma.expense.update({
      where: { id: params.expenseId },
      data: {
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
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  try {
    await prisma.expense.delete({ where: { id: params.expenseId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
