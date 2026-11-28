'use client'

// Settings → Maps & Google: default map style, Google keys (real tolls, hotels with ratings,
// Google map tiles), toll pass, and how many OpenStreetMap places are cached.
import { useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { MAP_STYLES } from '@/lib/mapStyles'
import { TOLL_PASSES } from '@/lib/domain/google'

export interface MapsSettingsValue {
  mapStyle?: string | null
  tollPass?: string | null
  googleServerKeySet?: boolean
  googleMapsKeySet?: boolean
  poiCache?: { areas: number; pois: number } | null
}

export type MapsPatch = {
  mapStyle?: string | null
  tollPass?: string | null
  googleServerKey?: string
  clearGoogleServerKey?: boolean
  googleMapsKey?: string
  clearGoogleMapsKey?: boolean
}

function KeyField({ label, help, isSet, onSave, onClear, id }: { label: string; help: string; isSet?: boolean; onSave: (k: string) => void; onClear: () => void; id: string }) {
  const [v, setV] = useState('')
  return (
    <div className="space-y-1">
      <label className="tp-label" htmlFor={id}>{label}</label>
      <div className="flex gap-2">
        <input id={id} type="password" autoComplete="off" className="tp-input flex-1" value={v} onChange={(e) => setV(e.target.value)}
          placeholder={isSet ? '•••••••• saved — type to replace' : 'Paste the key'} />
        <button type="button" className="tp-btn text-xs" disabled={!v.trim()}
          onClick={() => {
            onSave(v.trim())
            setV('')
          }}>
          Save
        </button>
        {isSet && (
          <button type="button" className="tp-btn-ghost text-xs" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-ink-3">{help}</p>
    </div>
  )
}

export default function MapsSettings({ value, onSave }: { value: MapsSettingsValue; onSave: (patch: MapsPatch) => void }) {
  const googleOn = !!value.googleServerKeySet && !!value.googleMapsKeySet
  return (
    <section className="tp-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
        <MapIcon className="w-4 h-4 text-accent" /> Maps &amp; Google
      </h2>

      <div className="space-y-1">
        <label className="tp-label" htmlFor="map-style">Default map style</label>
        <select id="map-style" className="tp-input" value={value.mapStyle || 'auto'} onChange={(e) => onSave({ mapStyle: e.target.value })}>
          <option value="auto">Auto (light by day, dark at night)</option>
          {MAP_STYLES.filter((s) => googleOn || !s.google).map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <p className="text-xs text-ink-3">Each map also has a “Map style” button; that choice is remembered on each device.</p>
      </div>

      <KeyField id="g-server" label="Google server key" isSet={value.googleServerKeySet}
        help="Real toll prices (Routes API), hotels and ratings (Places API (New)), and Google map tiles (Map Tiles API). Stays on the server."
        onSave={(k) => onSave({ googleServerKey: k })} onClear={() => onSave({ clearGoogleServerKey: true })} />
      <KeyField id="g-maps" label="Google maps key (browser)" isSet={value.googleMapsKeySet}
        help="Only for Google map tiles. Restrict it in Google Cloud to this site's address and the Map Tiles API — browsers can see it."
        onSave={(k) => onSave({ googleMapsKey: k })} onClear={() => onSave({ clearGoogleMapsKey: true })} />

      <div className="space-y-1">
        <label className="tp-label" htmlFor="toll-pass">Toll pass</label>
        <select id="toll-pass" className="tp-input" value={value.tollPass || ''} onChange={(e) => onSave({ tollPass: e.target.value || null })}>
          <option value="">None (cash / pay-by-plate prices)</option>
          {TOLL_PASSES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <p className="text-xs text-ink-3">
          {value.googleServerKeySet
            ? 'Drives over 10 miles get their toll price from Google; use "Recalculate" on a drive to update an old one.'
            : 'Without a Google key, tolls are a rough estimate from the distance.'}
        </p>
      </div>

      {value.poiCache && (
        <p className="text-xs text-ink-3">
          Places cache: {value.poiCache.pois.toLocaleString()} OpenStreetMap places in {value.poiCache.areas} area{value.poiCache.areas === 1 ? '' : 's'}{' '}
          (each area is fetched once and kept 30 days).
        </p>
      )}
    </section>
  )
}
