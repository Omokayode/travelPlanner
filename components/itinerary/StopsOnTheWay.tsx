'use client'

// For a drive between two places: gas, food, rest areas… near the route, to add in between.
import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import clsx from 'clsx'
import Dialog from '@/components/ui/Dialog'
import type { Place, PlaceCategory } from '@/lib/types'
import { PLACE_ICONS, PLACE_LABELS } from '@/lib/types'
import { placeFrom } from './AddPlace'

const KINDS: PlaceCategory[] = ['gas_station', 'food', 'rest_area', 'bucees', 'attraction', 'scenic', 'national_park', 'historical']

interface Found {
  name: string
  category: PlaceCategory
  location: Place['location']
  notes?: string
  osmId?: string
}

export default function StopsOnTheWay({ from, to, onClose, onAdd }: { from: Place | null; to: Place | null; onClose: () => void; onAdd: (p: Place) => void }) {
  const [kinds, setKinds] = useState<PlaceCategory[]>(['gas_station', 'food', 'rest_area'])
  const [found, setFound] = useState<Found[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const open = !!from && !!to

  useEffect(() => {
    setFound(null)
    setAdded(new Set())
  }, [from, to])

  const search = async () => {
    if (!from || !to) return
    setBusy(true)
    try {
      const res = await fetch('/api/stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from.location.coords, to: to.location.coords, routeCoords: to.travel?.routeCoords, preferences: kinds }),
      })
      setFound(res.ok ? await res.json() : [])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={open ? `Stops between ${from!.name} and ${to!.name}` : ''} size="lg">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kinds.includes(k)}
            onClick={() => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))}
            className={clsx('px-2.5 py-1 rounded-full text-xs border', kinds.includes(k) ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2')}>
            {PLACE_ICONS[k]} {PLACE_LABELS[k]}
          </button>
        ))}
      </div>
      <button type="button" onClick={search} disabled={busy || !kinds.length} className="tp-btn-primary mb-4">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Find stops near the route
      </button>
      {found && !found.length && <p className="text-sm text-ink-3">Nothing found (the free map service can be busy — try again).</p>}
      {found && found.length > 0 && (
        <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto">
          {found.map((s) => {
            const k = s.osmId || s.name
            return (
              <li key={k} className="flex items-center gap-3 py-2">
                <span aria-hidden>{PLACE_ICONS[s.category] || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.name}</div>
                  <div className="text-xs text-ink-3 truncate">{[PLACE_LABELS[s.category], s.location.city].filter(Boolean).join(' · ')}</div>
                </div>
                <button type="button" disabled={added.has(k)}
                  onClick={() => {
                    onAdd(placeFrom(s.location, s.category, { name: s.name, osmId: s.osmId, notes: s.notes }))
                    setAdded((a) => new Set(a).add(k))
                  }}
                  className="tp-btn-ghost text-xs py-1">
                  <Plus className="w-3.5 h-3.5" /> {added.has(k) ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
