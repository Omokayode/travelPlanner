'use client'

// Edit a place: name, kind, time, how long, cost, notes, links, visited — or move it to another day.
import { useEffect, useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import type { Place, PlaceCategory } from '@/lib/types'
import { PLACE_ICONS, PLACE_LABELS } from '@/lib/types'

const CATEGORIES = Object.keys(PLACE_LABELS) as PlaceCategory[]

interface Props {
  place: Place | null
  dayNumber: number
  days: { dayNumber: number; label: string }[]
  onClose: () => void
  onSave: (place: Place, toDayNumber: number) => void
}

export default function PlaceEditor({ place, dayNumber, days, onClose, onSave }: Props) {
  const [p, setP] = useState<Place | null>(place)
  const [toDay, setToDay] = useState(dayNumber)
  useEffect(() => {
    setP(place)
    setToDay(dayNumber)
  }, [place, dayNumber])
  if (!p) return null

  const set = <K extends keyof Place>(k: K, v: Place[K]) => setP((x) => (x ? { ...x, [k]: v } : x))
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

  return (
    <Dialog open={!!place} onClose={onClose} title="Edit place" size="lg" icon={<span aria-hidden>{PLACE_ICONS[p.category]}</span>}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!p.name.trim()) return
          onSave({ ...p, name: p.name.trim() }, toDay)
        }}
      >
        <div>
          <label className="tp-label" htmlFor="pe-name">Name</label>
          <input id="pe-name" className="tp-input" value={p.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
          <p className="text-xs text-ink-3 mt-1">
            {[p.location.address || p.location.name, p.location.city, p.location.state].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div>
          <span className="tp-label">Kind of place</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={p.category === c} onClick={() => set('category', c)}
                className={`px-2.5 py-1 rounded-full text-xs border ${p.category === c ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2 hover:text-ink'}`}>
                {PLACE_ICONS[c]} {PLACE_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="tp-label" htmlFor="pe-time">Arrive at</label>
            <input id="pe-time" type="time" className="tp-input" value={p.arriveTime || ''} onChange={(e) => set('arriveTime', e.target.value || undefined)} />
          </div>
          <div>
            <label className="tp-label" htmlFor="pe-stay">Stay (minutes)</label>
            <input id="pe-stay" type="number" min={0} className="tp-input" value={p.stayMinutes ?? ''} onChange={(e) => set('stayMinutes', num(e.target.value))} />
          </div>
          <div>
            <label className="tp-label" htmlFor="pe-cost">Cost ($)</label>
            <input id="pe-cost" type="number" min={0} step="0.01" className="tp-input" value={p.cost ?? ''} onChange={(e) => set('cost', num(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="tp-label" htmlFor="pe-notes">Notes</label>
          <textarea id="pe-notes" rows={3} className="tp-input resize-none" value={p.notes || ''} onChange={(e) => set('notes', e.target.value || undefined)}
            placeholder="Tickets, opening hours, what to order…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="tp-label" htmlFor="pe-web">Website</label>
            <input id="pe-web" type="url" className="tp-input" value={p.website || ''} onChange={(e) => set('website', e.target.value || undefined)} />
          </div>
          <div>
            <label className="tp-label" htmlFor="pe-phone">Phone</label>
            <input id="pe-phone" className="tp-input" value={p.phone || ''} onChange={(e) => set('phone', e.target.value || undefined)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={!!p.visited} onChange={(e) => set('visited', e.target.checked)} className="accent-emerald-500 w-4 h-4" />
            Been there
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Day
            <select className="tp-input w-auto py-1" value={toDay} onChange={(e) => setToDay(Number(e.target.value))}>
              {days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="tp-btn-ghost">Cancel</button>
          <button type="submit" className="tp-btn-primary">{toDay !== dayNumber ? `Save and move to day ${toDay}` : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  )
}
