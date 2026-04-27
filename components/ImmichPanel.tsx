'use client'

import { useState, useEffect } from 'react'
import { Loader2, X, ExternalLink, Camera, Settings as SettingsIcon, ImageOff } from 'lucide-react'
import Link from 'next/link'

interface Album { id: string; albumName: string; assetCount: number }
interface ImmichAsset {
  id: string; type: string; originalFileName: string
  thumbUrl: string; fullUrl: string; takenAt?: string
  city?: string
}
interface AppSettings {
  immichUrl?: string; immichApiKey?: string; immichAlbumId?: string
}

interface Props {
  tripId: string
  dayDate?: string
  startDate?: string
  endDate?: string
}

const ALBUM_KEY = (tripId: string) => `immich_album_${tripId}`

export default function ImmichPanel({ tripId, dayDate, startDate, endDate }: Props) {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState('')
  const [assets, setAssets] = useState<ImmichAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAlbums, setLoadingAlbums] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<ImmichAsset | null>(null)
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: AppSettings) => {
        setAppSettings(s)
        if (s.immichUrl && s.immichApiKey) {
          setConfigured(true)
          fetchAlbums(s)
        }
      })
  }, [])

  const fetchAlbums = async (s: AppSettings) => {
    if (!s.immichUrl || !s.immichApiKey) return
    setLoadingAlbums(true)
    setError('')
    try {
      const res = await fetch(
        `/api/immich?action=albums&apiKey=${encodeURIComponent(s.immichApiKey!)}&baseUrl=${encodeURIComponent(s.immichUrl!)}`
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to fetch albums'); return }
      setAlbums(data)

      // Priority: trip-specific saved album → app default album → Recents → first album
      const saved = localStorage.getItem(ALBUM_KEY(tripId))
      const recents = data.find((a: Album) => a.albumName.toLowerCase().includes('recent'))
      const defaultId =
        (saved && data.find((a: Album) => a.id === saved) ? saved : null) ||
        (s.immichAlbumId && data.find((a: Album) => a.id === s.immichAlbumId) ? s.immichAlbumId : null) ||
        recents?.id ||
        data[0]?.id || ''

      if (defaultId) {
        setSelectedAlbum(defaultId)
        fetchAssets(defaultId, s)
      }
    } catch { setError('Could not connect to Immich') }
    finally { setLoadingAlbums(false) }
  }

  const fetchAssets = async (albumId: string, s?: AppSettings) => {
    const cfg = s || appSettings
    if (!cfg?.immichUrl || !cfg?.immichApiKey || !albumId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/immich?action=album-assets&albumId=${albumId}&apiKey=${encodeURIComponent(cfg.immichApiKey!)}&baseUrl=${encodeURIComponent(cfg.immichUrl!)}`
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setAssets(data)
    } catch { setError('Failed to load photos') }
    finally { setLoading(false) }
  }

  const handleAlbumChange = (id: string) => {
    setSelectedAlbum(id)
    localStorage.setItem(ALBUM_KEY(tripId), id)
    fetchAssets(id)
  }

  const filteredAssets = (() => {
    if (dayDate) return assets.filter(a => a.takenAt?.startsWith(dayDate))
    if (startDate && endDate) return assets.filter(a => {
      if (!a.takenAt) return false
      const d = a.takenAt.split('T')[0]
      return d >= startDate && d <= endDate
    })
    return assets
  })()

  const apiKey = appSettings?.immichApiKey || ''
  const baseUrl = appSettings?.immichUrl || ''

  // Not configured
  if (!configured && appSettings !== null) {
    return (
      <div className="tp-card p-6 text-center space-y-3">
        <Camera className="w-10 h-10 text-white/20 mx-auto" />
        <div className="text-white/60 text-sm">Immich not configured</div>
        <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-400 text-sm hover:text-emerald-300">
          <SettingsIcon className="w-4 h-4" /> Go to Settings to connect Immich
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with album picker */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold text-white">Photos</span>
        </div>
        <div className="flex items-center gap-2">
          {!loadingAlbums && albums.length > 0 && (
            <select className="tp-input text-xs py-1 max-w-40" value={selectedAlbum}
              onChange={e => handleAlbumChange(e.target.value)}>
              {albums.map(a => (
                <option key={a.id} value={a.id}>{a.albumName} ({a.assetCount})</option>
              ))}
            </select>
          )}
          <Link href="/settings" className="text-white/30 hover:text-white/60 p-1.5">
            <SettingsIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}

      {(loading || loadingAlbums) && (
        <div className="flex items-center justify-center py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {dayDate && !loading && assets.length > 0 && filteredAssets.length === 0 && (
        <div className="text-xs text-white/30 text-center py-4 bg-white/3 rounded-xl">
          No photos taken on {dayDate} in this album
        </div>
      )}

      {!loading && !loadingAlbums && filteredAssets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filteredAssets.map(asset => (
            <button key={asset.id} onClick={() => setLightbox(asset)}
              className="aspect-square rounded-xl overflow-hidden border border-white/8 hover:border-emerald-500/40 transition-all group">
              <img
                src={`${asset.thumbUrl}&apiKey=${apiKey}`}
                alt={asset.originalFileName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </button>
          ))}
        </div>
      )}

      {!loading && !loadingAlbums && filteredAssets.length === 0 && assets.length === 0 && !error && configured && (
        <div className="text-center py-8 text-white/30">
          <ImageOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="text-sm">No photos found</div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={`${lightbox.thumbUrl}&apiKey=${apiKey}`} alt={lightbox.originalFileName}
            className="max-w-full max-h-[80vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <div className="mt-4 text-center space-y-1">
            {lightbox.takenAt && <div className="text-white/50 text-sm">{new Date(lightbox.takenAt).toLocaleString()}</div>}
            {lightbox.city && <div className="text-white/40 text-xs">{lightbox.city}</div>}
            <a href={`${baseUrl}/api/assets/${lightbox.id}/original?apiKey=${apiKey}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300 mt-2"
              onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-3 h-3" /> Full resolution
            </a>
          </div>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  )
}
