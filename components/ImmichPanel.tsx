'use client'

import { useState, useEffect } from 'react'
import { Loader2, X, ExternalLink, Camera, Settings, ImageOff } from 'lucide-react'

interface ImmichSettings { baseUrl: string; apiKey: string }
interface Album { id: string; albumName: string; assetCount: number }
interface ImmichAsset {
  id: string; type: string; originalFileName: string
  thumbUrl: string; fullUrl: string; takenAt?: string
  city?: string; latitude?: number; longitude?: number
}

interface Props {
  tripId: string
  dayDate?: string
  startDate?: string  // for trip-level gallery
  endDate?: string
}

const SETTINGS_KEY = 'immich_settings'
const ALBUM_KEY = (tripId: string) => `immich_album_${tripId}`

function loadSettings(): ImmichSettings | null {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') } catch { return null }
}
function saveSettingsLocal(s: ImmichSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
function loadAlbum(tripId: string): string {
  return localStorage.getItem(ALBUM_KEY(tripId)) || ''
}
function saveAlbum(tripId: string, albumId: string) {
  localStorage.setItem(ALBUM_KEY(tripId), albumId)
}

export default function ImmichPanel({ tripId, dayDate, startDate, endDate }: Props) {
  const [settings, setSettings] = useState<ImmichSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ baseUrl: '', apiKey: '' })
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState('')
  const [assets, setAssets] = useState<ImmichAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAlbums, setLoadingAlbums] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<ImmichAsset | null>(null)

  useEffect(() => {
    const s = loadSettings()
    if (s) {
      setSettings(s)
      setSettingsForm(s)
      fetchAlbums(s, loadAlbum(tripId))
    } else {
      setShowSettings(true)
    }
  }, [tripId])

  const fetchAlbums = async (s: ImmichSettings, preferredAlbumId = '') => {
    setLoadingAlbums(true)
    setError('')
    try {
      const res = await fetch(`/api/immich?action=albums&apiKey=${encodeURIComponent(s.apiKey)}&baseUrl=${encodeURIComponent(s.baseUrl)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to fetch albums'); return }
      setAlbums(data)

      // Auto-select: use persisted album, or fall back to "Recents"
      const savedId = preferredAlbumId || loadAlbum(tripId)
      const recents = data.find((a: Album) => a.albumName.toLowerCase().includes('Recents'))
      const defaultId = savedId && data.find((a: Album) => a.id === savedId)
        ? savedId
        : (recents?.id || data[0]?.id || '')

      if (defaultId) {
        setSelectedAlbum(defaultId)
        fetchAssets(defaultId, s)
      }
    } catch { setError('Could not connect to Immich') }
    finally { setLoadingAlbums(false) }
  }

  const fetchAssets = async (albumId: string, s?: ImmichSettings) => {
    const cfg = s || settings
    if (!cfg || !albumId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/immich?action=album-assets&albumId=${albumId}&apiKey=${encodeURIComponent(cfg.apiKey)}&baseUrl=${encodeURIComponent(cfg.baseUrl)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to fetch photos'); return }
      setAssets(data)
    } catch { setError('Failed to load photos') }
    finally { setLoading(false) }
  }

  const handleAlbumChange = (id: string) => {
    setSelectedAlbum(id)
    saveAlbum(tripId, id)
    fetchAssets(id)
  }

  const saveSettings = () => {
    const s = { baseUrl: settingsForm.baseUrl.trim(), apiKey: settingsForm.apiKey.trim() }
    setSettings(s)
    saveSettingsLocal(s)
    setShowSettings(false)
    fetchAlbums(s)
  }

  // Filter by date range
  const filteredAssets = (() => {
    if (dayDate) return assets.filter(a => a.takenAt?.startsWith(dayDate))
    if (startDate && endDate) return assets.filter(a => {
      if (!a.takenAt) return false
      const d = a.takenAt.split('T')[0]
      return d >= startDate && d <= endDate
    })
    return assets
  })()

  const apiKey = settings?.apiKey || ''

  if (showSettings) {
    return (
      <div className="tp-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-500" /> Immich Settings
          </h3>
          {settings && <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>}
        </div>
        <input className="tp-input w-full" placeholder="https://photos.yourdomain.com"
          value={settingsForm.baseUrl} onChange={e => setSettingsForm(f => ({ ...f, baseUrl: e.target.value }))} />
        <input className="tp-input w-full font-mono text-sm" type="password" placeholder="Immich API key"
          value={settingsForm.apiKey} onChange={e => setSettingsForm(f => ({ ...f, apiKey: e.target.value }))} />
        <div className="text-white/30 text-xs">Immich → Account Settings → API Keys → New API Key</div>
        <button onClick={saveSettings} disabled={!settingsForm.baseUrl || !settingsForm.apiKey}
          className="tp-btn w-full justify-center disabled:opacity-40">Connect to Immich</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-white">Immich Photos</span>
        </div>
        <div className="flex items-center gap-2">
          {!loadingAlbums && albums.length > 0 && (
            <select className="tp-input text-xs py-1" value={selectedAlbum} onChange={e => handleAlbumChange(e.target.value)}>
              {albums.map(a => <option key={a.id} value={a.id}>{a.albumName} ({a.assetCount})</option>)}
            </select>
          )}
          <button onClick={() => setShowSettings(true)} className="text-white/30 hover:text-white/60 p-1.5">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
      {(loading || loadingAlbums) && (
        <div className="flex items-center justify-center py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {dayDate && selectedAlbum && !loading && assets.length > 0 && filteredAssets.length === 0 && (
        <div className="text-xs text-white/30 text-center py-4">No photos taken on {dayDate} in this album</div>
      )}

      {!loading && !loadingAlbums && filteredAssets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filteredAssets.map(asset => (
            <button key={asset.id} onClick={() => setLightbox(asset)}
              className="aspect-square rounded-xl overflow-hidden border border-white/8 hover:border-emerald-500/40 transition-all group">
              <img src={`${asset.thumbUrl}&apiKey=${apiKey}`} alt={asset.originalFileName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </button>
          ))}
        </div>
      )}

      {!loading && !loadingAlbums && selectedAlbum && filteredAssets.length === 0 && assets.length === 0 && !error && (
        <div className="text-center py-8 text-white/30">
          <ImageOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="text-sm">No photos in this album</div>
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
            <a href={`${lightbox.fullUrl}?apiKey=${apiKey}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300 mt-2"
              onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-3 h-3" /> Open full resolution
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
