import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { expenseSchema } from '@/lib/schemas'
import { dbDate, toExpense } from '@/lib/server/store'
import { deleteReceipt, isReceiptUpload, saveReceipt } from '@/lib/server/receipts'

type Ctx = { params: { id: string; expenseId: string } }

// Every query matches the trip in the URL as well as the expense id.
// Receipt in the body: a new upload replaces the stored one, the stored one's URL keeps it,
// null/missing removes it. The day an expense belongs to is set when it is created.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, expenseSchema)
  const existing = await prisma.expense.findFirst({ where: { id: params.expenseId, tripId: params.id } })
  if (!existing) throw notFound()

  const upload = isReceiptUpload(body.receipt)
  const keep = !upload && !!body.receipt
  const newFile = upload ? await saveReceipt(body.receipt as string) : null
  let expense
  try {
    expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        amount: body.amount,
        category: body.category,
        date: dbDate(body.date),
        notes: body.notes ?? null,
        paymentMethod: body.paymentMethod ?? null,
        ...(keep ? {} : { receiptFile: newFile, receipt: null }),
      },
    })
  } catch (err) {
    await deleteReceipt(newFile)
    throw err
  }
  if (!keep) await deleteReceipt(existing.receiptFile)
  return NextResponse.json(toExpense(expense))
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  const existing = await prisma.expense.findFirst({ where: { id: params.expenseId, tripId: params.id } })
  if (!existing) throw notFound()
  await prisma.expense.delete({ where: { id: existing.id } })
  await deleteReceipt(existing.receiptFile)
  return NextResponse.json({ success: true })
})
