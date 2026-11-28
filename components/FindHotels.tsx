'use client'

// Lodging tab → "Find hotels": pick a city of the trip (or search a place), dates default to the
// nights spent there, then add one of the suggestions as lodging.
import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Loader2, Search, X } from 'lucide-react'
import type { GeoLocation, Lodging, Trip } from '@/lib/types'
import { addDays } from '@/lib/domain/dates'
import LocationSearch from './LocationSearch'
import HotelList, { type HotelOption } from './HotelList'
import { toast } from '@/lib/client'

interface CityStay {
  label: string
  location: GeoLocation
  checkIn: string
  checkOut: string
}

/** Cities the trip sleeps in: the last city-type place of each day, grouped by run of days. */
export function tripCityStays(trip: Trip): CityStay[] {
  const out: CityStay[] = []
  const days = [...(trip.days || [])].sort((a, b) => a.dayNumber - b.dayNumber)
  for (const d of days.slice(0, -1)) {
    const city = [...(d.places || [])].reverse().find((p) => p.category === 'city')
    if (!city) continue
    const label = [city.location.city || city.name, city.location.state].filter(Boolean).join(', ')
    const last = out[out.length - 1]
    if (last && last.label === label && last.checkOut === d.date) last.checkOut = addDays(d.date, 1)
    else out.push({ label, location: city.location, checkIn: d.date, checkOut: addDays(d.date, 1) })
  }
  return out
}

export default function FindHotels({ trip, onAdd, onClose }: { trip: Trip; onAdd: (l: Lodging) => Promise<boolean>; onClose: () => void }) {
  const stays = useMemo(() => tripCityStays(trip), [trip])
  const [where, setWhere] = useState<GeoLocation | null>(stays[0]?.location ?? null)
  const [checkIn, setCheckIn] = useState(stays[0]?.checkIn ?? trip.startDate)
  const [checkOut, setCheckOut] = useState(stays[0]?.checkOut ?? trip.endDate)
  const [hotels, setHotels] = useState<HotelOption[] | null>(null)
  const [busy, setBusy] = useState(false)

  const find = async () => {
    if (!where || checkOut < checkIn) return
    setBusy(true)
    setHotels(null)
    const q = new URLSearchParams({
      lat: String(where.coords.lat),
      lng: String(where.coords.lng),
      city: [where.city || where.name, where.state].filter(Boolean).join(', '),
      checkIn,
      checkOut,
    })
    const res = await fetch(`/api/places/hotels?${q}`).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      toast.error((await res?.json().catch(() => null))?.error || 'Could not look up hotels')
      return
    }
    setHotels(await res.json())
  }

  return (
    <div className="tp-card p-5 space-y-4 border border-emerald-500/20">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-accent">Find hotels</h4>
        <button type="button" onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-2">
          <X className="w-4 h-4" />
        </button>
      </div>
      {stays.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stays.map((s) => (
            <button key={`${s.label}-${s.checkIn}`} type="button"
              onClick={() => {
                setWhere(s.location)
                setCheckIn(s.checkIn)
                setCheckOut(s.checkOut)
                setHotels(null)
              }}
              className={`text-xs px-2.5 py-1 rounded-full border ${where === s.location ? 'border-emerald-500/50 text-accent' : 'border-line text-ink-3 hover:text-ink'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <LocationSearch label="Near" value={where} onChange={(loc) => setWhere(loc ?? null)} placeholder="City, neighbourhood or address…" />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-ink-3">
          Check-in
          <input type="date" className="tp-input w-full mt-1" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label className="text-xs text-ink-3">
          Check-out
          <input type="date" className="tp-input w-full mt-1" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
      </div>
      <button type="button" onClick={find} disabled={!where || busy || checkOut < checkIn} className="tp-btn-primary">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find hotels
      </button>
      {hotels && (
        <HotelList
          hotels={hotels}
          onAdd={async (h) => {
            const ok = await onAdd({
              id: uuidv4(),
              name: h.name,
              location: { id: '', name: h.name, address: h.address, city: where?.city || where?.name, state: where?.state, coords: h.coords },
              checkIn,
              checkOut,
            })
            if (ok) {
              toast.info(`${h.name} added`)
              onClose()
            }
          }}
        />
      )}
    </div>
  )
}
