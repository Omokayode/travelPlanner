'use client'

// A few hotels to choose from: rating, price level, distance, "check prices" for your dates.
// Used in the planner preview (pick one per city) and on a trip's Lodging tab (add one).
import { ExternalLink, MapPin, Star } from 'lucide-react'
import clsx from 'clsx'
import type { Hotel } from '@/lib/domain/google'

export type HotelOption = Hotel & { bookingUrl: string }

interface Props {
  hotels: HotelOption[]
  /** radio-style choice (planner): index or -1 for "decide later" */
  selected?: number
  onSelect?: (i: number) => void
  /** button per hotel (Lodging tab) */
  onAdd?: (h: HotelOption) => void
  name?: string
}

export default function HotelList({ hotels, selected, onSelect, onAdd, name = 'hotel' }: Props) {
  if (!hotels.length) return <p className="text-sm text-ink-3">No hotels found nearby.</p>
  const google = hotels.some((h) => h.source === 'google')
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {hotels.map((h, i) => (
          <li key={`${h.name}-${i}`}
            className={clsx('flex items-start gap-3 rounded-lg border p-2.5', selected === i ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-line')}>
            {onSelect && (
              <input type="radio" name={name} className="mt-1 accent-emerald-500" checked={selected === i} onChange={() => onSelect(i)}
                aria-label={`Stay at ${h.name}`} />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink text-sm">{h.name}</div>
              <div className="text-xs text-ink-3 flex flex-wrap gap-x-2 mt-0.5">
                {h.rating != null && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-warn fill-current" aria-hidden /> {h.rating.toFixed(1)}
                    {h.reviews ? ` (${h.reviews.toLocaleString()})` : ''}
                  </span>
                )}
                {h.priceLevel ? <span aria-label={`price level ${h.priceLevel} of 4`}>{'$'.repeat(h.priceLevel)}</span> : null}
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" aria-hidden /> {h.miles} mi from the day&apos;s places
                </span>
              </div>
              <div className="flex gap-3 mt-1 text-xs">
                <a href={h.bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Check prices <ExternalLink className="w-3 h-3" />
                </a>
                {h.mapsUrl && /^https:\/\//.test(h.mapsUrl) && (
                  <a href={h.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:text-accent">
                    Google Maps
                  </a>
                )}
              </div>
            </div>
            {onAdd && (
              <button type="button" onClick={() => onAdd(h)} className="tp-btn-ghost text-xs shrink-0">
                Add
              </button>
            )}
          </li>
        ))}
        {onSelect && (
          <li className={clsx('flex items-center gap-3 rounded-lg border p-2.5 text-sm', selected === -1 ? 'border-emerald-500/50' : 'border-line')}>
            <input type="radio" name={name} className="accent-emerald-500" checked={selected === -1} onChange={() => onSelect(-1)} aria-label="Decide later" />
            <span className="text-ink-2">Decide later</span>
          </li>
        )}
      </ul>
      <p className="text-[11px] text-ink-4">
        {google ? 'Ratings from Google.' : 'From OpenStreetMap (add a Google key in Settings for ratings).'} Prices change — check them for your dates.
      </p>
    </div>
  )
}
