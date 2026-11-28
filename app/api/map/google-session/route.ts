// GET /api/map/google-session?type=roadmap|satellite|terrain — a Google Map Tiles session (made
// with the server key) plus the browser key the tiles are fetched with. 404 when Google maps is
// not set up, so the map falls back to the free styles.
import { NextRequest, NextResponse } from 'next/server'
import { handler, HttpError } from '@/lib/http'
import { googleKeys, tileSession, type GoogleMapType } from '@/lib/server/google'

export const dynamic = 'force-dynamic'

const TYPES: GoogleMapType[] = ['roadmap', 'satellite', 'terrain']

export const GET = handler(async (req: NextRequest) => {
  const type = req.nextUrl.searchParams.get('type') as GoogleMapType
  if (!TYPES.includes(type)) throw new HttpError(400, 'type must be roadmap, satellite or terrain')
  const keys = await googleKeys()
  if (!keys.serverKey || !keys.mapsKey) throw new HttpError(404, 'Google maps is not set up')
  let s: Awaited<ReturnType<typeof tileSession>>
  try {
    s = await tileSession(type)
  } catch (err) {
    throw new HttpError(502, err instanceof Error ? err.message : 'Google tiles failed')
  }
  if (!s) throw new HttpError(404, 'Google maps is not set up')
  return NextResponse.json({ session: s.session, key: keys.mapsKey, expiry: s.expiry }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
})
