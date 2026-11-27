import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { handler, notFound } from '@/lib/http'
import { decodeReceipt, readReceipt } from '@/lib/server/receipts'

type Ctx = { params: { id: string; expenseId: string } }

export const dynamic = 'force-dynamic'

/** The receipt image/PDF of an expense (a stored file, or the inline copy from before Phase 2). */
export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const e = await prisma.expense.findFirst({
    where: { id: params.expenseId, tripId: params.id },
    select: { receiptFile: true, receipt: true },
  })
  const file = e?.receiptFile ? await readReceipt(e.receiptFile) : e?.receipt ? decodeReceipt(e.receipt) : null
  if (!file) throw notFound()
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  })
})
