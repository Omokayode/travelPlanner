import { NextRequest, NextResponse } from 'next/server'
import { getImmichConfig, immichFetch, ImmichError, UUID_RE } from '@/lib/immich'

// Streams an Immich thumbnail or original through the app, so the browser never needs the API key.
export async function GET(_req: NextRequest, { params }: { params: { assetId: string; kind: string } }) {
  const { assetId, kind } = params
  if (!UUID_RE.test(assetId) || (kind !== 'thumbnail' && kind !== 'original')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const cfg = await getImmichConfig()
  if (!cfg) return NextResponse.json({ error: 'Immich is not configured' }, { status: 503 })

  try {
    const path = kind === 'thumbnail' ? `/assets/${assetId}/thumbnail?size=preview` : `/assets/${assetId}/original`
    const upstream = await immichFetch(cfg, path, { headers: { Accept: '*/*' } })
    const headers = new Headers()
    for (const h of ['content-type', 'content-length', 'last-modified', 'etag']) {
      const v = upstream.headers.get(h)
      if (v) headers.set(h, v)
    }
    headers.set('cache-control', 'private, max-age=86400')
    if (kind === 'original') headers.set('content-disposition', 'inline')
    return new NextResponse(upstream.body, { status: 200, headers })
  } catch (err) {
    const status = err instanceof ImmichError ? err.status : 502
    return NextResponse.json({ error: 'Image unavailable' }, { status: status === 404 ? 404 : 502 })
  }
}
