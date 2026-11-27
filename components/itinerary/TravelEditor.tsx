'use client'

// How you get to a place from the one before: drive / walk (worked out by the app), or a
// flight, train, bus or ferry with its details (flight numbers can be looked up).
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import clsx from 'clsx'
import Dialog from '@/components/ui/Dialog'
import type { FlightLookupResult, Place, TransportMode, Travel } from '@/lib/types'
import { haversineMiles } from '@/lib/domain/geo'
import { formatMiles, formatMinutes } from '@/lib/format'
import { MODE_ICON, MODE_LABEL } from './TravelRow'

const MODES: TransportMode[] = ['drive', 'walk', 'flight', 'train', 'bus', 'ferry']
const routed = (m: TransportMode) => m === 'drive' || m === 'walk'

/** "2025-11-22T13:08:00Z" or similar → "2025-11-22T13:08" for a datetime-local input. */
const localInput = (v?: string) => (v ? v.replace(' ', 'T').slice(0, 16) : '')

function minutesBetween(a?: string, b?: string) {
  if (!a || !b) return undefined
  const m = (new Date(b).getTime() - new Date(a).getTime()) / 60000
  return Number.isFinite(m) && m > 0 ? Math.round(m) : undefined
}

interface Props {
  open: boolean
  from: Place | null
  to: Place | null
  date: string
  onClose: () => void
  /** new travel, and optionally the place itself changed (flight lookup → arrival airport) */
  onSave: (travel: Travel, place?: Partial<Place>) => void
}

export default function TravelEditor({ open, from, to, date, onClose, onSave }: Props) {
  const [t, setT] = useState<Travel>({ mode: 'drive', auto: true })
  const [placePatch, setPlacePatch] = useState<Partial<Place> | null>(null)
  const [lookup, setLookup] = useState({ busy: false, error: '', found: '' })

  useEffect(() => {
    if (open && to) {
      setT(to.travel ?? { mode: 'drive', auto: true })
      setPlacePatch(null)
      setLookup({ busy: false, error: '', found: '' })
    }
  }, [open, to])
  if (!from || !to) return null

  const set = <K extends keyof Travel>(k: K, v: Travel[K]) => setT((x) => ({ ...x, [k]: v }))
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
  const chooseMode = (m: TransportMode) =>
    // routed modes are worked out again; others are typed in
    setT((x) => (routed(m) ? { mode: m, auto: true } : { ...x, mode: m, auto: false, routeCoords: undefined, fuelCost: undefined, fuelGallons: undefined, tollCost: undefined }))

  const lookupFlight = async () => {
    const flight = (t.flightNumber || '').replace(/\s/g, '').toUpperCase()
    if (!flight) return setLookup({ busy: false, error: 'Type the flight number first', found: '' })
    setLookup({ busy: true, error: '', found: '' })
    try {
      const res = await fetch(`/api/flights?flight=${encodeURIComponent(flight)}&date=${date}`)
      const d = (await res.json()) as FlightLookupResult & { error?: string }
      if (!res.ok) return setLookup({ busy: false, error: d.error || 'Flight not found', found: '' })
      setT((x) => ({
        ...x,
        mode: 'flight',
        auto: false,
        flightNumber: d.flightNumber || flight,
        carrier: d.airline || x.carrier,
        departureTime: localInput(d.departureScheduled) || x.departureTime,
        arrivalTime: localInput(d.arrivalScheduled) || x.arrivalTime,
        duration: d.durationMinutes ?? minutesBetween(d.departureScheduled, d.arrivalScheduled) ?? x.duration,
        distance: d.from && d.to ? Math.round(haversineMiles(d.from.coords, d.to.coords)) : x.distance,
        routeCoords: d.trackPoints?.length > 1 ? d.trackPoints : undefined,
      }))
      if (d.to) {
        setPlacePatch({
          name: d.to.name,
          category: 'airport',
          location: { id: '', name: d.to.name, city: d.to.city, coords: d.to.coords },
        })
      }
      setLookup({ busy: false, error: '', found: d.to ? `Found: ${d.from?.iata ?? '?'} → ${d.to.iata}` : 'Found' })
    } catch {
      setLookup({ busy: false, error: 'Lookup failed', found: '' })
    }
  }

  const crow = haversineMiles(from.location.coords, to.location.coords)
  const save = () => {
    const out: Travel = { ...t }
    if (!routed(out.mode) && out.duration == null) out.duration = minutesBetween(out.departureTime, out.arrivalTime)
    onSave(out, placePatch ?? undefined)
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Getting to ${to.name}`} size="lg">
      <p className="text-sm text-ink-3 -mt-2 mb-4">From {from.name} · {formatMiles(crow)} as the crow flies</p>

      <div role="radiogroup" aria-label="How" className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-4">
        {MODES.map((m) => {
          const Icon = MODE_ICON[m]
          return (
            <button key={m} type="button" role="radio" aria-checked={t.mode === m} onClick={() => chooseMode(m)}
              className={clsx('flex flex-col items-center gap-1 py-2 rounded-lg border text-xs',
                t.mode === m ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2 hover:text-ink')}>
              <Icon className="w-4 h-4" />
              {MODE_LABEL[m]}
            </button>
          )
        })}
      </div>

      {routed(t.mode) ? (
        <div className="space-y-3">
          {t.auto !== false ? (
            <div className="tp-card bg-ink/[0.03] text-sm text-ink-2 flex items-center justify-between gap-3">
              <span>
                {t.distance != null
                  ? `${formatMinutes(t.duration)} · ${formatMiles(t.distance)}${t.cost ? ` · $${t.cost.toFixed(2)} fuel and tolls` : ''}`
                  : 'Worked out from the map when you save.'}
              </span>
              <button type="button" className="tp-btn-ghost text-xs" onClick={() => setT({ mode: t.mode, auto: true })}>
                <RefreshCw className="w-3.5 h-3.5" /> Recalculate
              </button>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={t.auto === false}
              onChange={(e) => setT((x) => (e.target.checked ? { ...x, auto: false } : { mode: x.mode, auto: true }))} />
            Enter time and distance myself
          </label>
          {t.auto === false && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="tp-label" htmlFor="te-mi">Miles</label>
                <input id="te-mi" type="number" min={0} step="0.1" className="tp-input" value={t.distance ?? ''} onChange={(e) => set('distance', num(e.target.value))} />
              </div>
              <div>
                <label className="tp-label" htmlFor="te-min">Minutes</label>
                <input id="te-min" type="number" min={0} className="tp-input" value={t.duration ?? ''} onChange={(e) => set('duration', num(e.target.value))} />
              </div>
              <div>
                <label className="tp-label" htmlFor="te-cost">Cost ($)</label>
                <input id="te-cost" type="number" min={0} step="0.01" className="tp-input" value={t.cost ?? ''} onChange={(e) => set('cost', num(e.target.value))} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label" htmlFor="te-carrier">{t.mode === 'flight' ? 'Airline' : 'Company'}</label>
              <input id="te-carrier" className="tp-input" value={t.carrier || ''} onChange={(e) => set('carrier', e.target.value || undefined)} />
            </div>
            <div>
              <label className="tp-label" htmlFor="te-number">{t.mode === 'flight' ? 'Flight number' : 'Number'}</label>
              <div className="flex gap-1.5">
                <input id="te-number" className="tp-input uppercase" value={t.flightNumber || ''} onChange={(e) => set('flightNumber', e.target.value || undefined)} />
                {t.mode === 'flight' && (
                  <button type="button" onClick={lookupFlight} disabled={lookup.busy} className="tp-btn-ghost px-2.5 shrink-0" aria-label="Look up flight" title="Look up (OpenSky)">
                    {lookup.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          {(lookup.error || lookup.found) && (
            <p className={clsx('text-xs', lookup.error ? 'text-danger' : 'text-ok')}>
              {lookup.error || lookup.found}
              {placePatch && !lookup.error && (
                <label className="ml-2 inline-flex items-center gap-1 text-ink-2">
                  <input type="checkbox" checked onChange={(e) => !e.target.checked && setPlacePatch(null)} className="accent-emerald-500" />
                  set this place to {placePatch.name}
                </label>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label" htmlFor="te-dep">Departs</label>
              <input id="te-dep" type="datetime-local" className="tp-input" value={localInput(t.departureTime)} onChange={(e) => set('departureTime', e.target.value || undefined)} />
            </div>
            <div>
              <label className="tp-label" htmlFor="te-arr">Arrives</label>
              <input id="te-arr" type="datetime-local" className="tp-input" value={localInput(t.arrivalTime)} onChange={(e) => set('arrivalTime', e.target.value || undefined)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label" htmlFor="te-ref">Booking reference</label>
              <input id="te-ref" className="tp-input" value={t.bookingRef || ''} onChange={(e) => set('bookingRef', e.target.value || undefined)} />
            </div>
            <div>
              <label className="tp-label" htmlFor="te-tcost">Ticket cost ($)</label>
              <input id="te-tcost" type="number" min={0} step="0.01" className="tp-input" value={t.cost ?? ''} onChange={(e) => set('cost', num(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="tp-label" htmlFor="te-conf">Confirmation email (paste)</label>
            <textarea id="te-conf" rows={3} className="tp-input resize-none font-mono text-xs" value={t.confirmationText || ''}
              onChange={(e) => set('confirmationText', e.target.value || undefined)} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={onClose} className="tp-btn-ghost">Cancel</button>
        <button type="button" onClick={save} className="tp-btn-primary">Save</button>
      </div>
    </Dialog>
  )
}
