'use client'

// The trip outline, editable: start city, where you sleep and for how many nights, back home or
// not, how you travel between cities, interests and pace. Filled by the AI or by hand.
import { ArrowDown, Car, CheckCircle2, Minus, Plane, Plus, Train, Trash2, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import LocationSearch from '@/components/LocationSearch'
import type { GeoLocation, Vehicle } from '@/lib/types'
import { INTERESTS, INTEREST_LABELS, cityText, totalNights, type Interest, type PlanCity, type TripOutline } from '@/lib/domain/plan'

const fromLocation = (l: GeoLocation): PlanCity => ({ name: l.city || l.name, state: l.state, country: l.country, coords: l.coords })

function CityField({ city, onChange, label }: { city: PlanCity; onChange: (c: PlanCity) => void; label: string }) {
  const found = !!city.coords
  return (
    <div className="flex-1 min-w-0">
      <LocationSearch
        key={cityText(city)}
        value={city.name ? { id: '', name: cityText(city), coords: city.coords ?? { lat: 0, lng: 0 } } : null}
        placeholder={label}
        onChange={(l) => l && onChange(fromLocation(l))}
      />
      {city.name && (
        <div className={clsx('flex items-center gap-1 text-xs mt-1', found ? 'text-ok' : 'text-warn')}>
          {found ? <CheckCircle2 className="w-3 h-3" /> : <TriangleAlert className="w-3 h-3" />}
          {found ? cityText(city) : `“${cityText(city)}” not found — pick it from the list`}
        </div>
      )}
    </div>
  )
}

interface Props {
  outline: TripOutline
  onChange: (o: TripOutline) => void
  startDate: string
  onStartDate: (d: string) => void
  vehicles: Vehicle[]
  vehicleIndex: number
  onVehicle: (i: number) => void
}

export default function RouteEditor({ outline: o, onChange, startDate, onStartDate, vehicles, vehicleIndex, onVehicle }: Props) {
  const set = (patch: Partial<TripOutline>) => onChange({ ...o, ...patch })
  const setStay = (i: number, patch: Partial<TripOutline['stays'][number]>) =>
    set({ stays: o.stays.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const toggle = (i: Interest) => set({ interests: o.interests.includes(i) ? o.interests.filter((x) => x !== i) : [...o.interests, i] })
  const nights = totalNights(o)

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-[1fr_12rem] gap-3">
        <div>
          <label className="tp-label" htmlFor="pl-name">Trip name</label>
          <input id="pl-name" className="tp-input" value={o.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="tp-label" htmlFor="pl-date">Start date</label>
          <input id="pl-date" type="date" className="tp-input" value={startDate} onChange={(e) => onStartDate(e.target.value)} />
        </div>
      </div>

      <div>
        <span className="tp-label">Route</span>
        <ol className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="mt-2.5 w-16 shrink-0 text-xs text-ink-3">Start</span>
            <CityField city={o.start} label="Where do you start? (city)" onChange={(c) => set({ start: c })} />
          </li>
          {o.stays.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-16 shrink-0 text-xs text-ink-3 flex items-center gap-1">
                <ArrowDown className="w-3 h-3" /> Stay {i + 1}
              </span>
              <CityField city={s.city} label="City you sleep in" onChange={(c) => setStay(i, { city: c })} />
              <div className="flex items-center gap-1 shrink-0" aria-label={`Nights in stay ${i + 1}`}>
                <button type="button" aria-label="One night less" onClick={() => setStay(i, { nights: Math.max(1, s.nights - 1) })}
                  className="w-8 h-9 rounded-lg border border-line flex items-center justify-center text-ink-2 hover:text-ink">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-14 text-center text-sm text-ink tabular-nums">{s.nights} night{s.nights === 1 ? '' : 's'}</span>
                <button type="button" aria-label="One night more" onClick={() => setStay(i, { nights: Math.min(30, s.nights + 1) })}
                  className="w-8 h-9 rounded-lg border border-line flex items-center justify-center text-ink-2 hover:text-ink">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={`Remove stay ${i + 1}`} disabled={o.stays.length === 1}
                  onClick={() => set({ stays: o.stays.filter((_, j) => j !== i) })}
                  className="w-8 h-9 flex items-center justify-center text-ink-4 hover:text-danger disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pl-[4.5rem]">
          <button type="button" className="tp-btn-ghost text-xs" onClick={() => set({ stays: [...o.stays, { city: { name: '' }, nights: 2 }] })}>
            <Plus className="w-3.5 h-3.5" /> Add a stop
          </button>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={o.returnHome} onChange={(e) => set({ returnHome: e.target.checked })} />
            Back to {o.start.name || 'the start'} at the end
          </label>
        </div>
        <p className="text-xs text-ink-3 mt-2 pl-[4.5rem]">
          {nights} night{nights === 1 ? '' : 's'} → {nights + 1} days
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <span className="tp-label">Between cities</span>
          <div role="radiogroup" className="flex gap-1.5">
            {([['drive', 'Drive', Car], ['flight', 'Fly', Plane], ['train', 'Train', Train]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={o.mode === m} onClick={() => set({ mode: m })}
                className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm',
                  o.mode === m ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2')}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          {o.mode === 'drive' && vehicles.length > 0 && (
            <select className="tp-input mt-2" value={vehicleIndex} onChange={(e) => onVehicle(Number(e.target.value))} aria-label="Car">
              {vehicles.map((v, i) => (
                <option key={i} value={i}>{[v.year, v.make, v.model].filter(Boolean).join(' ')} · {v.fuelEfficiency} mpg</option>
              ))}
              <option value={-1}>No car / don&apos;t estimate fuel</option>
            </select>
          )}
        </div>
        <div>
          <span className="tp-label">Pace</span>
          <div role="radiogroup" className="flex gap-1.5">
            {(['relaxed', 'normal', 'packed'] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={o.pace === p} onClick={() => set({ pace: p })}
                className={clsx('flex-1 py-2 rounded-lg border text-sm capitalize',
                  o.pace === p ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2')}>
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-1.5">{o.pace === 'relaxed' ? '2' : o.pace === 'normal' ? '4' : '6'} places on a full day in a city</p>
        </div>
      </div>

      <div>
        <span className="tp-label">What do you like?</span>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => (
            <button key={i} type="button" aria-pressed={o.interests.includes(i)} onClick={() => toggle(i)}
              className={clsx('px-3 py-1.5 rounded-full text-sm border',
                o.interests.includes(i) ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2 hover:text-ink')}>
              {INTEREST_LABELS[i]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
