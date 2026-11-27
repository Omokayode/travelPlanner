'use client'

// On the road: a floating "+" that adds an expense, a note or an "I'm here" stop to today.
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Receipt, StickyNote, MapPin, Loader2, LocateFixed } from 'lucide-react'
import clsx from 'clsx'
import Dialog from '@/components/ui/Dialog'
import { api, reportError, toast } from '@/lib/client'
import type { Day, ExpenseCategory, PlaceCategory } from '@/lib/types'
import { EXPENSE_CATEGORY_ICONS, PLACE_ICONS } from '@/lib/types'

type Mode = 'expense' | 'note' | 'stop'
const QUICK_CATEGORIES: ExpenseCategory[] = ['fuel', 'food', 'tolls', 'activities', 'shopping', 'misc']
const QUICK_STOPS: PlaceCategory[] = ['food', 'coffee', 'gas_station', 'attraction', 'scenic', 'rest_area']

export default function QuickAdd({ tripId, day, onSaved }: { tripId: string; day: Day; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('expense')
  const [busy, setBusy] = useState(false)
  // expense
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  // note
  const [note, setNote] = useState('')
  // stop
  const [stopName, setStopName] = useState('')
  const [stopType, setStopType] = useState<PlaceCategory>('attraction')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const reset = () => {
    setName('')
    setAmount('')
    setNote('')
    setStopName('')
    setCoords(null)
  }
  const close = () => {
    setOpen(false)
    reset()
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error('This browser cannot share its location')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
      },
      () => {
        toast.error('Location not available (permission denied?)')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const save = async () => {
    setBusy(true)
    try {
      if (mode === 'expense') {
        const value = parseFloat(amount)
        if (!name.trim() || !Number.isFinite(value)) return toast.error('Enter what it was and how much')
        await api(`/api/trips/${tripId}/expenses`, 'POST', { name: name.trim(), amount: value, category, date: day.date, dayId: day.id })
        toast.info(`Added $${value.toFixed(2)} for ${name.trim()}`)
      } else if (mode === 'note') {
        if (!note.trim()) return
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const notes = [day.notes?.trimEnd(), `• ${time} — ${note.trim()}`].filter(Boolean).join('\n')
        await api(`/api/trips/${tripId}/days/${day.id}`, 'PUT', { ...day, notes })
        toast.info('Note added to today')
      } else {
        if (!coords || !stopName.trim()) return toast.error('Name the place and share your location')
        const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        const place = {
          id: uuidv4(),
          name: stopName.trim(),
          category: stopType,
          visited: true,
          arriveTime: time,
          location: { id: '', name: stopName.trim(), coords },
          // the app works out the drive from the previous place
          travel: day.places.length ? { mode: 'drive' as const, auto: true } : undefined,
        }
        await api(`/api/trips/${tripId}/days/${day.id}`, 'PUT', { ...day, places: [...day.places, place] })
        toast.info(`“${place.name}” added to today`)
      }
      close()
      onSaved()
    } catch (err) {
      reportError(err, 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add to today"
        className="fixed z-30 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 w-14 h-14 rounded-full
          bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition flex items-center justify-center"
      >
        <Plus className="w-7 h-7" />
      </button>

      <Dialog open={open} onClose={close} title={`Add to today · Day ${day.dayNumber}`}>
        <div role="tablist" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-ink/5 mb-4">
          {(
            [
              ['expense', 'Expense', Receipt],
              ['note', 'Note', StickyNote],
              ['stop', "I'm here", MapPin],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx('flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm', mode === m ? 'bg-card text-ink shadow-sm' : 'text-ink-3')}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {mode === 'expense' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CATEGORIES.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
                  className={clsx('px-2.5 py-1 rounded-full text-sm border', category === c ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2')}>
                  {EXPENSE_CATEGORY_ICONS[c]} {c}
                </button>
              ))}
            </div>
            <input className="tp-input" placeholder="What was it? (e.g. Lunch)" value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm">$</span>
              <input className="tp-input pl-7" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()} />
            </div>
          </div>
        )}

        {mode === 'note' && (
          <textarea className="tp-input resize-none" rows={4} placeholder="What happened?" value={note} onChange={(e) => setNote(e.target.value)} data-autofocus />
        )}

        {mode === 'stop' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STOPS.map((c) => (
                <button key={c} type="button" aria-pressed={stopType === c} onClick={() => setStopType(c)}
                  className={clsx('px-2.5 py-1 rounded-full text-sm border', stopType === c ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2')}>
                  {PLACE_ICONS[c]} {c.replace('_', ' ')}
                </button>
              ))}
            </div>
            <input className="tp-input" placeholder="Name (e.g. Buc-ee's Florence)" value={stopName} onChange={(e) => setStopName(e.target.value)} data-autofocus />
            <button type="button" onClick={locate} disabled={locating} className="tp-btn-ghost w-full justify-center">
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {coords ? `Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Use my location'}
            </button>
            <p className="text-xs text-ink-3">Added to the end of today with the time, marked visited.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={close} className="tp-btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className="tp-btn-primary">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Add
          </button>
        </div>
      </Dialog>
    </>
  )
}
