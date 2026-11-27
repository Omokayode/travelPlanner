import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, authDisabled, sessionSecret, verifySession } from '@/lib/session'

// Everything needs a session except the login page/API, the health check, read-only share
// pages (the secret in the URL is the key) and static files.
const PUBLIC = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/health$/, /^\/share\/[A-Za-z0-9_-]{43}$/]

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (authDisabled() || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next()

  const secret = sessionSecret()
  const ok = secret ? await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value) : false
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  // Build the redirect from the host the browser used (or the proxy forwarded).
  // Note: Next rewrites a 127.0.0.1 host to "localhost" in redirects — use http://localhost:PORT
  // when testing locally, or the cookie (set for 127.0.0.1) won't be sent after the redirect.
  const target = pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname + search)}`
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')).split(',')[0]
  return NextResponse.redirect(new URL(target, `${proto}://${host}`), 307)
}

export const config = {
  // skip Next internals and files with an extension (icons, manifest, images)
  matcher: ['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
