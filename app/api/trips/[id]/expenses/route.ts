import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { expenseSchema } from '@/lib/schemas'

type Ctx = { params: { id: string } }

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const expenses = await prisma.expense.findMany({ where: { tripId: params.id }, orderBy: { date: 'asc' } })
  return NextResponse.json(expenses)
})

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, expenseSchema)
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!trip) throw notFound()
  const expense = await prisma.expense.create({
    data: {
      tripId: params.id,
      dayId: body.dayId ?? null,
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
})
