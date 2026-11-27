import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, authDisabled, sessionSecret, verifySession } from '@/lib/session'

// Everything needs a session except the login page/API, the health check and static files.
const PUBLIC = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/health$/]

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (authDisabled() || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next()

  const secret = sessionSecret()
  const ok = secret ? await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value) : false
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(url)
}

export const config = {
  // skip Next internals and files with an extension (icons, manifest, images)
  matcher: ['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
