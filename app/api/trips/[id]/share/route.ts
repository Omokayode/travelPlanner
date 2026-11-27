// Read-only share link for a trip.
//   POST    create the link, or replace it with a new one (the old link stops working)
//   DELETE  turn sharing off
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/db'
import { handler } from '@/lib/http'

type Ctx = { params: { id: string } }

export const POST = handler(async (_: NextRequest, { params }: Ctx) => {
  const shareToken = randomBytes(32).toString('base64url') // 256 bits, 43 characters
  await prisma.trip.update({ where: { id: params.id }, data: { shareToken } })
  return NextResponse.json({ shareToken, path: `/share/${shareToken}` })
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  await prisma.trip.update({ where: { id: params.id }, data: { shareToken: null } })
  return NextResponse.json({ shareToken: null })
})
