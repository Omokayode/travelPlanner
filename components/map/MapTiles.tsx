'use client'

// components/map/MapTiles.tsx — the tile layer for every map, plus a small "map style" switch.
// The choice is remembered per browser; the default comes from Settings → Maps & Google.
import { useEffect, useRef, useState } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Layers } from 'lucide-react'
import clsx from 'clsx'
import { availableStyles, resolveStyle, type MapStyle } from '@/lib/mapStyles'
import { useAppSettings } from '@/lib/useAppSettings'

const STORE = 'tp.mapStyle'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORE)
  } catch {
    return null
  }
}
function writeStored(v: string) {
  try {
    window.localStorage.setItem(STORE, v)
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

/** true while the page shows the dark theme (follows the theme toggle and the system). */
function useDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const read = () => setDark(getComputedStyle(document.documentElement).colorScheme.includes('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', read)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', read)
    }
  }, [])
  return dark
}

const sessions = new Map<string, Promise<{ session: string; key: string } | null>>()
function googleSession(type: string) {
  if (!sessions.has(type)) {
    sessions.set(
      type,
      fetch(`/api/map/google-session?type=${type}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  }
  return sessions.get(type)!
}

/** Tag the map container so the dark-mode dimming only applies to light street/terrain tiles. */
function DimClass({ dim }: { dim: boolean }) {
  const map = useMap()
  useEffect(() => {
    map.getContainer().classList.toggle('tp-tiles-nodim', !dim)
  }, [map, dim])
  return null
}

export default function MapTiles({ switcher = true }: { switcher?: boolean }) {
  const settings = useAppSettings()
  const dark = useDark()
  const google = Boolean(settings?.googleMapsReady)
  const [choice, setChoice] = useState<string | null>(null)
  useEffect(() => setChoice(readStored()), [])
  const style: MapStyle = resolveStyle(choice ?? settings?.mapStyle ?? 'auto', { dark, google })

  const [g, setG] = useState<{ session: string; key: string } | null>(null)
  useEffect(() => {
    setG(null)
    if (style.google) googleSession(style.google).then(setG)
  }, [style.google])

  const url = style.google ? (g ? `${style.url}?session=${encodeURIComponent(g.session)}&key=${encodeURIComponent(g.key)}` : null) : style.url
  // Google not answering (bad key/session): show Streets rather than an empty map
  const fallback = resolveStyle('auto', { dark, google: false })

  return (
    <>
      <DimClass dim={style.dimInDark && !!url} />
      {url ? (
        <TileLayer key={style.id + (g?.session || '')} url={url} attribution={style.attribution} maxZoom={20} maxNativeZoom={style.maxNativeZoom}
          {...(style.subdomains ? { subdomains: style.subdomains } : {})} />
      ) : (
        <TileLayer key="fallback" url={fallback.url} attribution={fallback.attribution} maxZoom={20} maxNativeZoom={fallback.maxNativeZoom} />
      )}
      {url && style.overlay && <TileLayer key={`${style.id}-labels`} url={style.overlay} maxZoom={20} maxNativeZoom={style.maxNativeZoom} zIndex={2} />}
      {switcher && (
        <StyleSwitch
          styles={availableStyles(google)}
          current={choice ?? 'auto'}
          onPick={(id) => {
            setChoice(id)
            writeStored(id)
          }}
        />
      )}
    </>
  )
}

function StyleSwitch({ styles, current, onPick }: { styles: MapStyle[]; current: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current)
      L.DomEvent.disableScrollPropagation(ref.current)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const options = [{ id: 'auto', label: 'Auto (light/dark)' }, ...styles.map((s) => ({ id: s.id, label: s.label }))]
  return (
    <div ref={ref} className="absolute top-2 right-2 z-[1000]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" aria-label="Map style"
        className="flex items-center gap-1.5 rounded-lg bg-card/95 border border-line shadow px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:text-ink">
        <Layers className="w-4 h-4" /> <span className="hidden sm:inline">Map style</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Map style" className="absolute right-0 mt-1 w-48 rounded-lg bg-card border border-line shadow-lg py-1 text-sm">
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" role="option" aria-selected={current === o.id}
                onClick={() => {
                  onPick(o.id)
                  setOpen(false)
                }}
                className={clsx('w-full text-left px-3 py-1.5 hover:bg-ink/5', current === o.id ? 'text-accent font-medium' : 'text-ink-2')}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
