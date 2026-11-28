'use client'

// New trip from an outline: (AI reads your words →) check the route → build days with real places
// → look it over, drop what you don't want → create. Without AI it starts at the route.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, ArrowRight, Info, Loader2, Sparkles, X } from 'lucide-react'
import RouteEditor from './RouteEditor'
import HotelList, { type HotelOption } from '@/components/HotelList'
import type { Place, Vehicle } from '@/lib/types'
import { PLACE_ICONS } from '@/lib/types'
import type { TripOutline } from '@/lib/domain/plan'
import { addDays, todayLocal } from '@/lib/domain/dates'
import { api, reportError, toast } from '@/lib/client'

interface DraftDay {
  dayNumber: number
  date: string
  title: string
  places: Place[]
}
interface Draft {
  name: string
  type: 'road_trip' | 'flight' | 'train'
  startDate: string
  endDate: string
  days: DraftDay[]
  stays?: { city: string; state?: string; checkIn: string; checkOut: string; hotels: HotelOption[] }[]
  notes: string[]
}

const EXAMPLES = [
  '5 days in Arizona in mid December from Milwaukee: Phoenix then Sedona, museums and hiking, driving',
  'Long weekend in Chicago, food and architecture, back home Sunday',
  'One week road trip down the Gulf coast to New Orleans, relaxed, history and food',
]

export function blankOutline(homeCity?: string | null): TripOutline {
  const [name, state] = (homeCity || '').split(',').map((s) => s.trim())
  return {
    name: '',
    start: { name: name || '', state: state || undefined },
    stays: [{ city: { name: '' }, nights: 2 }],
    returnHome: true,
    interests: ['sights', 'food'],
    pace: 'normal',
    mode: 'drive',
  }
}

interface Props {
  ai: boolean
  aiModel?: string
  homeCity?: string | null
  vehicles: Vehicle[]
  /** start with the AI box, or straight at the route */
  withAi: boolean
  onCancel: () => void
}

export default function Planner({ ai, aiModel, homeCity, vehicles, withAi, onCancel }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'describe' | 'route' | 'building' | 'preview'>(withAi && ai ? 'describe' : 'route')
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [outline, setOutline] = useState<TripOutline>(() => blankOutline(homeCity))
  const [startDate, setStartDate] = useState(() => addDays(todayLocal(), 14))
  const [vehicleIndex, setVehicleIndex] = useState(vehicles.length ? 0 : -1)
  const [progress, setProgress] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  /** chosen hotel per stay (index into its list), -1 = decide later */
  const [hotelPick, setHotelPick] = useState<number[]>([])
  const [creating, setCreating] = useState(false)

  const understand = async () => {
    setThinking(true)
    try {
      const o = await api<TripOutline>('/api/plan/understand', 'POST', { text })
      setOutline({ ...o, stays: o.stays.length ? o.stays : blankOutline().stays })
      if (o.startDate) setStartDate(o.startDate)
      setStep('route')
    } catch (err) {
      reportError(err, 'The AI could not read that — try again, or fill in the route yourself')
    } finally {
      setThinking(false)
    }
  }

  const ready = !!outline.name.trim() && !!outline.start.coords && outline.stays.length > 0 && outline.stays.every((s) => s.city.coords)

  const build = async () => {
    setStep('building')
    setProgress('Starting…')
    try {
      const res = await fetch('/api/plan/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline, startDate }),
      })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error || 'Could not build the trip')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          const msg = JSON.parse(line) as { progress?: string; draft?: Draft; error?: string }
          if (msg.progress) setProgress(msg.progress)
          if (msg.error) throw new Error(msg.error)
          if (msg.draft) {
            setDraft(msg.draft)
            setHotelPick((msg.draft.stays || []).map(() => -1))
            setStep('preview')
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the trip')
      setStep('route')
    }
  }

  const removePlace = (dayNumber: number, id: string) =>
    setDraft((d) =>
      d && {
        ...d,
        days: d.days.map((x) =>
          x.dayNumber === dayNumber ? { ...x, places: x.places.filter((p) => p.id !== id).map((p, i) => (i === 0 ? { ...p, travel: undefined } : p)) } : x,
        ),
      },
    )

  const create = async () => {
    if (!draft) return
    setCreating(true)
    try {
      const id = uuidv4()
      const vehicle = outline.mode === 'drive' && vehicleIndex >= 0 ? vehicles[vehicleIndex] : undefined
      await api('/api/trips', 'POST', {
        id,
        name: draft.name,
        startDate: draft.startDate,
        endDate: draft.endDate,
        type: draft.type,
        vehicle,
        days: draft.days.map((d) => ({ id: uuidv4(), date: d.date, dayNumber: d.dayNumber, title: d.title, visited: false, places: d.places })),
        lodgings: (draft.stays || []).flatMap((st, i) => {
          const h = st.hotels[hotelPick[i] ?? -1]
          return h
            ? [{
                id: uuidv4(),
                name: h.name,
                location: { id: '', name: h.name, address: h.address, city: st.city, state: st.state, coords: h.coords },
                checkIn: st.checkIn,
                checkOut: st.checkOut,
              }]
            : []
        }),
      })
      router.push(`/trips/${id}`)
    } catch (err) {
      reportError(err, 'Could not create the trip')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button type="button" onClick={step === 'route' && withAi && ai ? () => setStep('describe') : step === 'preview' ? () => setStep('route') : onCancel}
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {step === 'describe' && (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" /> Describe your trip
          </h1>
          <p className="text-ink-2 text-sm">
            Where, how long, when, what you like. The AI ({aiModel}) turns it into a route you can check; the places come
            from OpenStreetMap, so they are real.
          </p>
          <textarea className="tp-input resize-y min-h-[8rem]" value={text} onChange={(e) => setText(e.target.value)} data-autofocus
            placeholder="e.g. 5 days in Arizona in mid December: Phoenix then Sedona, museums and hiking, driving from home" />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => setText(e)} className="text-xs px-2.5 py-1 rounded-full border border-line text-ink-3 hover:text-ink text-left">
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep('route')} className="text-sm text-ink-3 hover:text-ink underline">
              Fill in the route myself
            </button>
            <button type="button" onClick={understand} disabled={thinking || text.trim().length < 3} className="tp-btn-primary">
              {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {thinking ? 'Reading… (can take a minute)' : 'Plan it'}
            </button>
          </div>
        </section>
      )}

      {step === 'route' && (
        <section className="space-y-6">
          <h1 className="text-2xl font-bold text-ink">Your route</h1>
          <RouteEditor outline={outline} onChange={setOutline} startDate={startDate} onStartDate={setStartDate}
            vehicles={vehicles} vehicleIndex={vehicleIndex} onVehicle={setVehicleIndex} />
          <div className="flex justify-end">
            <button type="button" onClick={build} disabled={!ready} className="tp-btn-primary">
              Build the days <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {!ready && <p className="text-xs text-ink-3 text-right">Give the trip a name and pick every city from the list.</p>}
        </section>
      )}

      {step === 'building' && (
        <section className="py-20 text-center space-y-3" aria-live="polite">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
          <p className="text-ink">{progress}</p>
          <p className="text-xs text-ink-3">Looking up real places near each city.</p>
        </section>
      )}

      {step === 'preview' && draft && (
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-ink">{draft.name}</h1>
            <p className="text-sm text-ink-3">
              {format(parseISO(draft.startDate), 'MMM d')} – {format(parseISO(draft.endDate), 'MMM d, yyyy')} · {draft.days.length} days. Remove
              what you don&apos;t want; you can add, move and edit everything on the trip page.
            </p>
          </div>
          {draft.notes.length > 0 && (
            <ul className="tp-card bg-amber-500/5 border-amber-500/20 text-sm text-ink-2 space-y-1">
              {draft.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" /> {n}
                </li>
              ))}
            </ul>
          )}
          <ol className="space-y-4">
            {draft.days.map((d) => (
              <li key={d.dayNumber} className="tp-card">
                <div className="text-xs text-ink-3">Day {d.dayNumber} · {format(parseISO(d.date), 'EEE, MMM d')}</div>
                <div className="font-semibold text-ink mb-2">{d.title}</div>
                <ol className="space-y-1">
                  {d.places.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-right text-xs text-ink-4 tabular-nums">{i + 1}</span>
                      <span aria-hidden>{PLACE_ICONS[p.category]}</span>
                      <span className="flex-1 min-w-0 truncate text-ink-2">{p.name}</span>
                      {p.category !== 'city' && (
                        <button type="button" aria-label={`Remove ${p.name}`} onClick={() => removePlace(d.dayNumber, p.id)}
                          className="p-1 text-ink-4 hover:text-danger">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          {(draft.stays || []).some((st) => st.hotels.length) && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Where to stay</h2>
              {(draft.stays || []).map((st, i) =>
                st.hotels.length ? (
                  <div key={`${st.city}-${st.checkIn}`} className="tp-card space-y-2">
                    <div className="text-sm font-medium text-ink">
                      {st.city} · {format(parseISO(st.checkIn), 'MMM d')} – {format(parseISO(st.checkOut), 'MMM d')}
                    </div>
                    <HotelList hotels={st.hotels} name={`stay-${i}`} selected={hotelPick[i] ?? -1}
                      onSelect={(n) => setHotelPick((p) => p.map((x, j) => (j === i ? n : x)))} />
                  </div>
                ) : null,
              )}
            </section>
          )}
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setStep('route')} className="tp-btn-ghost">
              <ArrowLeft className="w-4 h-4" /> Change the route
            </button>
            <button type="button" onClick={create} disabled={creating} className="tp-btn-primary">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {creating ? 'Creating and working out the drives…' : 'Create trip'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
