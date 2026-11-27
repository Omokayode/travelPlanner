import { NextRequest, NextResponse } from 'next/server'
import { getImmichConfig, immichJson, ImmichError, UUID_RE } from '@/lib/immich'

// Immich proxy. Server URL and API key come only from the server (env or Settings);
// image URLs point at /api/immich/assets/... so the key is never sent to the browser.

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
  exifInfo?: { city?: string; latitude?: number; longitude?: number; description?: string }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const albumId = searchParams.get('albumId') || ''

  const cfg = await getImmichConfig()
  if (!cfg) return NextResponse.json({ error: 'Immich is not configured' }, { status: 503 })

  try {
    if (action === 'albums') {
      const albums = await immichJson<ImmichAlbum[]>(cfg, '/albums')
      return NextResponse.json(
        albums.map((a) => ({
          id: a.id,
          albumName: a.albumName,
          assetCount: a.assetCount,
          thumbnailAssetId: a.albumThumbnailAssetId,
          description: a.description,
        })),
      )
    }

    if (action === 'album-assets') {
      if (!UUID_RE.test(albumId)) return NextResponse.json({ error: 'Invalid album id' }, { status: 400 })
      const album = await immichJson<{ assets?: ImmichAsset[] }>(cfg, `/albums/${albumId}`)
      return NextResponse.json(
        (album.assets || []).map((a) => ({
          id: a.id,
          type: a.type,
          originalFileName: a.originalFileName,
          thumbUrl: `/api/immich/assets/${a.id}/thumbnail`,
          fullUrl: `/api/immich/assets/${a.id}/original`,
          takenAt: a.localDateTime || a.fileCreatedAt,
          city: a.exifInfo?.city,
          latitude: a.exifInfo?.latitude,
          longitude: a.exifInfo?.longitude,
          description: a.exifInfo?.description || a.originalFileName,
        })),
      )
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const status = err instanceof ImmichError ? err.status : 0
    console.error('Immich request failed', status || err)
    const msg = status === 401 || status === 403 ? 'Immich rejected the API key' : 'Could not reach Immich'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
