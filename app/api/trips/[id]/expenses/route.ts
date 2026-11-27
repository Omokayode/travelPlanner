import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { expenseSchema } from '@/lib/schemas'
import { dbDate, toExpense } from '@/lib/server/store'
import { deleteReceipt, isReceiptUpload, saveReceipt } from '@/lib/server/receipts'

type Ctx = { params: { id: string } }

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  // same-day expenses in the order they were added (cuid ids sort by creation time)
  const expenses = await prisma.expense.findMany({ where: { tripId: params.id }, orderBy: [{ date: 'asc' }, { id: 'asc' }] })
  return NextResponse.json(expenses.map(toExpense))
})

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, expenseSchema)
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!trip) throw notFound()
  if (body.dayId && !(await prisma.day.count({ where: { id: body.dayId, tripId: params.id } }))) throw notFound()

  const receiptFile = isReceiptUpload(body.receipt) ? await saveReceipt(body.receipt) : null
  try {
    const expense = await prisma.expense.create({
      data: {
        tripId: params.id,
        dayId: body.dayId ?? null,
        name: body.name,
        amount: body.amount,
        category: body.category,
        date: dbDate(body.date),
        notes: body.notes ?? null,
        receiptFile,
        paymentMethod: body.paymentMethod ?? null,
      },
    })
    return NextResponse.json(toExpense(expense))
  } catch (err) {
    await deleteReceipt(receiptFile) // don't leave a file nobody points at
    throw err
  }
})
