import { NextRequest, NextResponse } from 'next/server'

// Proxy for Immich API — avoids CORS issues when Immich is on same network
// Config: IMMICH_URL and IMMICH_API_KEY env vars
// Or passed as query params for per-user config stored client-side

async function immichFetch(path: string, apiKey: string, baseUrl: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/api${path}`
  const res = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Immich ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') // 'albums' | 'album-assets'
  const albumId = searchParams.get('albumId')

  // Use env vars if set, otherwise use per-request params (from user's settings)
  const apiKey = process.env.IMMICH_API_KEY || searchParams.get('apiKey') || ''
  const baseUrl = process.env.IMMICH_URL || searchParams.get('baseUrl') || ''

  if (!apiKey || !baseUrl) {
    return NextResponse.json({ error: 'Immich not configured. Set IMMICH_URL and IMMICH_API_KEY.' }, { status: 503 })
  }

  try {
    if (action === 'albums') {
      const albums = await immichFetch('/albums', apiKey, baseUrl)
      return NextResponse.json(albums.map((a: any) => ({
        id: a.id,
        albumName: a.albumName,
        assetCount: a.assetCount,
        thumbnailAssetId: a.albumThumbnailAssetId,
        description: a.description,
      })))
    }

    if (action === 'album-assets' && albumId) {
      const album = await immichFetch(`/albums/${albumId}`, apiKey, baseUrl)
      return NextResponse.json((album.assets || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        originalFileName: a.originalFileName,
        thumbUrl: `${baseUrl.replace(/\/$/, '')}/api/assets/${a.id}/thumbnail?size=preview`,
        fullUrl: `${baseUrl.replace(/\/$/, '')}/api/assets/${a.id}/original`,
        takenAt: a.fileCreatedAt,
        city: a.exifInfo?.city,
        latitude: a.exifInfo?.latitude,
        longitude: a.exifInfo?.longitude,
        description: a.exifInfo?.description || a.originalFileName,
      })))
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('Immich error:', err)
    return NextResponse.json({ error: err.message || 'Immich request failed' }, { status: 500 })
  }
}
