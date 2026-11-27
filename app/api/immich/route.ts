import { NextRequest, NextResponse } from 'next/server'
import { getImmichConfig, immichFetch, immichJson, ImmichError, UUID_RE } from '@/lib/immich'

// Immich proxy. Server URL and API key come only from the server (env or Settings);
// image URLs point at /api/immich/assets/... so the key is never sent to the browser.
//
//   ?action=ping                                  -> { ok, albums }   (Settings "Test connection")
//   ?action=albums                                -> album list
//   ?action=assets&from=YYYY-MM-DD&to=YYYY-MM-DD[&albumId=uuid]
//                                                 -> photos taken on those days (local time)
//
// Immich 2+/3 no longer returns an album's photos from GET /albums/{id}; photos are found with
// POST /search/metadata (by date, optionally limited to albums).

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PAGE_SIZE = 250
const MAX_PAGES = 8 // up to 2,000 photos per request

interface ImmichAlbum {
  id: string
  albumName: string
  assetCount: number
  albumThumbnailAssetId?: string | null
  description?: string
}
interface ImmichAsset {
  id: string
  type: string
  originalFileName: string
  fileCreatedAt?: string
  localDateTime?: string
  isTrashed?: boolean
  exifInfo?: { city?: string | null; latitude?: number | null; longitude?: number | null; description?: string | null }
}
interface SearchResponse {
  assets: { items: ImmichAsset[]; nextPage: string | null }
}

function shiftDate(d: string, days: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

function view(a: ImmichAsset) {
  return {
    id: a.id,
    type: a.type,
    originalFileName: a.originalFileName,
    thumbUrl: `/api/immich/assets/${a.id}/thumbnail`,
    fullUrl: `/api/immich/assets/${a.id}/original`,
    // localDateTime is the wall-clock time where the photo was taken (what a trip day means)
    takenAt: a.localDateTime || a.fileCreatedAt,
    city: a.exifInfo?.city ?? undefined,
    latitude: a.exifInfo?.latitude ?? undefined,
    longitude: a.exifInfo?.longitude ?? undefined,
    description: a.exifInfo?.description || a.originalFileName,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  const cfg = await getImmichConfig()
  if (!cfg) return NextResponse.json({ error: 'Immich is not configured' }, { status: 503 })

  try {
    if (action === 'ping' || action === 'albums') {
      const albums = await immichJson<ImmichAlbum[]>(cfg, '/albums')
      if (action === 'ping') return NextResponse.json({ ok: true, albums: albums.length })
      return NextResponse.json(
        albums
          .map((a) => ({
            id: a.id,
            albumName: a.albumName,
            assetCount: a.assetCount,
            thumbnailAssetId: a.albumThumbnailAssetId,
            description: a.description,
          }))
          .sort((x, y) => x.albumName.localeCompare(y.albumName)),
      )
    }

    if (action === 'assets') {
      const from = searchParams.get('from') || ''
      const to = searchParams.get('to') || from
      const albumId = searchParams.get('albumId') || ''
      if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
        return NextResponse.json({ error: 'from/to must be YYYY-MM-DD dates' }, { status: 400 })
      }
      if (albumId && !UUID_RE.test(albumId)) return NextResponse.json({ error: 'Invalid album id' }, { status: 400 })

      // Search a day wider on each side (UTC vs local time), then keep photos whose local date fits.
      const body: Record<string, unknown> = {
        takenAfter: `${shiftDate(from, -1)}T00:00:00.000Z`,
        takenBefore: `${shiftDate(to, 2)}T00:00:00.000Z`,
        type: 'IMAGE',
        withExif: true,
        order: 'asc',
        size: PAGE_SIZE,
      }
      if (albumId) body.albumIds = [albumId]

      const items: ImmichAsset[] = []
      let page: string | null = '1'
      for (let i = 0; i < MAX_PAGES && page; i++) {
        const res = await immichFetch(cfg, '/search/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, page: Number(page) }),
        })
        const data = (await res.json()) as SearchResponse
        items.push(...(data.assets?.items || []))
        page = data.assets?.nextPage ?? null
      }

      const photos = items
        .filter((a) => !a.isTrashed)
        .map(view)
        .filter((a) => {
          const d = (a.takenAt || '').slice(0, 10)
          return d >= from && d <= to
        })
      return NextResponse.json(photos)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const status = err instanceof ImmichError ? err.status : 0
    console.error('Immich request failed', status || err)
    const msg =
      status === 401
        ? 'Immich rejected the API key — save a new key on the Settings page'
        : status === 403
          ? 'The Immich API key is missing a permission (needs album.read, asset.read, asset.view, asset.download)'
          : 'Could not reach Immich'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
