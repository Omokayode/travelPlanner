'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Camera, Settings as SettingsIcon, ImageOff } from 'lucide-react'
import Lightbox from '@/components/ui/Lightbox'
import Link from 'next/link'

interface Album {
  id: string
  albumName: string
  assetCount: number
}
interface ImmichAsset {
  id: string
  type: string
  originalFileName: string
  thumbUrl: string
  fullUrl: string
  takenAt?: string
  city?: string
}

interface Props {
  tripId: string
  /** a single day (day page) … */
  dayDate?: string
  /** … or the trip's date range (trip page) */
  startDate?: string
  endDate?: string
}

// Optional per-trip album filter, remembered in this browser. '' = all photos from those dates.
const ALBUM_KEY = (tripId: string) => `immich_album_${tripId}`

function readSavedAlbum(tripId: string): string {
  try {
    return localStorage.getItem(ALBUM_KEY(tripId)) || ''
  } catch {
    return ''
  }
}

export default function ImmichPanel({ tripId, dayDate, startDate, endDate }: Props) {
  const from = dayDate || startDate || ''
  const to = dayDate || endDate || from

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [albumId, setAlbumId] = useState('')
  const [assets, setAssets] = useState<ImmichAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setConfigured(Boolean(s?.immichConfigured)))
      .catch(() => setConfigured(false))
  }, [])

  // album list (only for the optional filter)
  useEffect(() => {
    if (!configured) return
    fetch('/api/immich?action=albums')
      .then(async (r) => (r.ok ? r.json() : []))
      .then((list: Album[]) => {
        setAlbums(list)
        const saved = readSavedAlbum(tripId)
        if (saved && list.some((a) => a.id === saved)) setAlbumId(saved)
      })
      .catch(() => setAlbums([]))
  }, [configured, tripId])

  const loadPhotos = useCallback(async () => {
    if (!from) return
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({ action: 'assets', from, to })
      if (albumId) q.set('albumId', albumId)
      const res = await fetch(`/api/immich?${q}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not load photos')
        setAssets([])
        return
      }
      setAssets(data)
    } catch {
      setError('Could not load photos')
    } finally {
      setLoading(false)
    }
  }, [from, to, albumId])

  useEffect(() => {
    if (configured) loadPhotos()
  }, [configured, loadPhotos])

  const changeAlbum = (id: string) => {
    setAlbumId(id)
    try {
      if (id) localStorage.setItem(ALBUM_KEY(tripId), id)
      else localStorage.removeItem(ALBUM_KEY(tripId))
    } catch {
      /* private mode: just don't remember it */
    }
  }

  if (configured === false) {
    return (
      <div className="tp-card p-6 text-center space-y-3">
        <Camera className="w-10 h-10 text-ink/20 mx-auto" />
        <div className="text-ink/60 text-sm">Immich not configured</div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-accent text-sm hover:text-accent"
        >
          <SettingsIcon className="w-4 h-4" /> Go to Settings to connect Immich
        </Link>
      </div>
    )
  }

  const range = from === to ? from : `${from} – ${to}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-semibold text-ink">Photos</span>
          {!loading && assets.length > 0 && <span className="text-xs text-ink/40">{assets.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          {albums.length > 0 && (
            <select
              className="tp-input text-xs py-1 max-w-44"
              value={albumId}
              onChange={(e) => changeAlbum(e.target.value)}
              aria-label="Limit to an album"
            >
              <option value="">All photos</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.albumName} ({a.assetCount})
                </option>
              ))}
            </select>
          )}
          <Link href="/settings" className="text-ink/30 hover:text-ink/60 p-1.5" aria-label="Immich settings">
            <SettingsIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && <div className="text-sm text-danger bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}

      {(loading || configured === null) && (
        <div className="flex items-center justify-center py-8 text-ink/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {!loading && configured && !error && assets.length === 0 && (
        <div className="text-center py-8 text-ink/30">
          <ImageOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="text-sm">
            No photos from {range}
            {albumId ? ' in this album' : ''}
          </div>
        </div>
      )}

      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {assets.map((asset, i) => (
            <button
              key={asset.id}
              aria-label={`Open photo ${asset.originalFileName}`}
              onClick={() => setLightbox(i)}
              className="aspect-square rounded-xl overflow-hidden border border-ink/8 hover:border-emerald-500/40 transition-all group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own Immich proxy */}
              <img
                src={asset.thumbUrl}
                alt={asset.originalFileName}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        items={assets.map((a) => ({
          src: a.thumbUrl,
          alt: a.originalFileName,
          href: a.fullUrl,
          caption: [a.takenAt?.replace('T', ' ').slice(0, 16), a.city].filter(Boolean).join(' · '),
        }))}
        index={lightbox}
        onIndex={setLightbox}
      />
    </div>
  )
}
