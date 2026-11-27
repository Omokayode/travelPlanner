import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { budgetSchema } from '@/lib/schemas'

type Ctx = { params: { id: string } }

export const GET = handler(async (_: NextRequest, { params }: Ctx) => {
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { proposedBudget: true } })
  if (!trip) throw notFound()
  return NextResponse.json(trip.proposedBudget ?? [])
})

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const body = await parseBody(req, budgetSchema)
  await prisma.trip.update({
    where: { id: params.id },
    data: { proposedBudget: body as Prisma.InputJsonArray },
  })
  return NextResponse.json(body)
})
