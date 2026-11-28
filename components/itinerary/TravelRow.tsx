'use client'

// Between two places: how you get there (mode, time, distance, cost), directions, edit.
import { Bus, Car, Footprints, Loader2, Navigation, Pencil, Plane, Ship, Train, Signpost } from 'lucide-react'
import type { Place, TransportMode } from '@/lib/types'
import { formatMiles, formatMinutes } from '@/lib/format'
import { googleDirections } from '@/lib/domain/mapLinks'

export const MODE_ICON: Record<TransportMode, typeof Car> = { drive: Car, walk: Footprints, flight: Plane, train: Train, bus: Bus, ferry: Ship }
export const MODE_LABEL: Record<TransportMode, string> = { drive: 'Drive', walk: 'Walk', flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry' }
export function directionsUrl(from: Place, to: Place) {
  return googleDirections([from, to].map((p) => ({ name: p.name, coords: p.location.coords })), to.travel?.mode || 'drive').url
}

interface Props {
  from: Place
  to: Place
  pending?: boolean
  readOnly?: boolean
  onEdit?: () => void
  /** drives only: find gas, food… along this stretch */
  onFindStops?: () => void
}

export default function TravelRow({ from, to, pending, readOnly, onEdit, onFindStops }: Props) {
  const t = to.travel
  const mode = t?.mode || 'drive'
  const Icon = MODE_ICON[mode]
  const parts = [formatMinutes(t?.duration), formatMiles(t?.distance)].filter(Boolean)
  return (
    <div className="flex items-center gap-2 pl-10 py-1.5 text-xs text-ink-3">
      <span className="flex items-center gap-1.5 min-w-0">
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5 shrink-0" aria-label={MODE_LABEL[mode]} />}
        <span className="truncate">
          {pending ? 'Working out the route…' : parts.join(' · ') || MODE_LABEL[mode]}
          {t?.mode === 'flight' && (t.carrier || t.flightNumber) && ` · ${[t.carrier, t.flightNumber].filter(Boolean).join(' ')}`}
          {t?.cost ? <span className="text-ok"> · ${t.cost.toFixed(2)}</span> : null}
          {t?.mode === 'drive' && (t.tollCost ?? 0) > 0 && (t.tollSource === 'google' || (t.tollCost ?? 0) >= 1) && (
            <span title={t.tollSource === 'google' ? 'Toll price from Google' : 'Estimated from distance (add a Google key in Settings for real tolls)'}>
              {' '}(tolls ${t.tollCost!.toFixed(2)}{t.tollSource === 'google' ? '' : ' est.'})
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-3 sm:gap-2 ml-auto shrink-0">
        {t?.mode !== 'flight' && (
          <a href={directionsUrl(from, to)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${to.name}`} className="inline-flex items-center gap-1 p-1 -m-1 hover:text-accent">
            <Navigation className="w-3 h-3" /> <span className="hidden sm:inline">Directions</span>
          </a>
        )}
        {!readOnly && onFindStops && mode === 'drive' && (t?.distance ?? 0) > 25 && (
          <button type="button" onClick={onFindStops} aria-label={`Stops on the way to ${to.name}`} className="inline-flex items-center gap-1 p-1 -m-1 hover:text-accent">
            <Signpost className="w-3 h-3" /> <span className="hidden sm:inline">Stops on the way</span>
          </button>
        )}
        {!readOnly && onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Change how you get to ${to.name}`} className="inline-flex items-center gap-1 hover:text-accent">
            <Pencil className="w-3 h-3" /> <span className="hidden sm:inline">{MODE_LABEL[mode]}</span>
          </button>
        )}
      </span>
    </div>
  )
}
