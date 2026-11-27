import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyPassword } from '@/lib/password'
import { SESSION_COOKIE, createSession, sessionSecret } from '@/lib/session'
import { handler, parseBody } from '@/lib/http'

export const runtime = 'nodejs'

// Simple in-memory limiter: 10 failed attempts per IP per 15 minutes (one container, so this is enough).
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 10
const fails = new Map<string, { count: number; first: number }>()

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local'
  )
}

export const POST = handler(async (req: NextRequest) => {
  const ip = clientIp(req)
  const now = Date.now()
  const f = fails.get(ip)
  if (f && now - f.first > WINDOW_MS) fails.delete(ip)
  if ((fails.get(ip)?.count || 0) >= MAX_FAILS) {
    return NextResponse.json({ error: 'Too many attempts — try again in 15 minutes' }, { status: 429 })
  }

  const hash = process.env.APP_PASSWORD_HASH || ''
  const secret = sessionSecret()
  if (!hash || !secret) {
    return NextResponse.json({ error: 'Login is not set up on the server yet' }, { status: 503 })
  }

  const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(200) }))
  if (!(await verifyPassword(password, hash))) {
    const cur = fails.get(ip) || { count: 0, first: now }
    fails.set(ip, { count: cur.count + 1, first: cur.first })
    await new Promise((r) => setTimeout(r, 500))
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  fails.delete(ip)

  const { value, maxAge } = await createSession(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge,
  })
  return res
})
