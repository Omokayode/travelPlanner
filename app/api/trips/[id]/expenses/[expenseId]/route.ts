import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { expenseSchema } from '@/lib/schemas'

type Ctx = { params: { id: string; expenseId: string } }

// Every query matches the trip in the URL as well as the expense id.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, expenseSchema)
  const { count } = await prisma.expense.updateMany({
    where: { id: params.expenseId, tripId: params.id },
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
  if (!count) throw notFound()
  return NextResponse.json(await prisma.expense.findUnique({ where: { id: params.expenseId } }))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  const { count } = await prisma.expense.deleteMany({ where: { id: params.expenseId, tripId: params.id } })
  if (!count) throw notFound()
  return NextResponse.json({ success: true })
})
