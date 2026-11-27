'use client'

// Under each day: search to add a place, and recommended places near the day's last stop.
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import LocationSearch from '@/components/LocationSearch'
import type { Coordinates, GeoLocation, Place, PlaceCategory } from '@/lib/types'
import { PLACE_ICONS } from '@/lib/types'
import { getNearbyPlaces, type Suggestion } from '@/lib/api'

/** A new place from a search result (a city if the result is the city itself). */
export function placeFrom(loc: GeoLocation, category?: PlaceCategory, extra: Partial<Place> = {}): Place {
  const isCity = !!loc.city && loc.city.toLowerCase() === loc.name.toLowerCase()
  return { id: uuidv4(), name: loc.name, category: category ?? (isCity ? 'city' : 'attraction'), location: loc, ...extra }
}

interface Props {
  /** where to look for suggestions (the day's last place) */
  near?: { coords: Coordinates; city?: string }
  existingNames: Set<string>
  onAdd: (place: Place) => void
}

export default function AddPlace({ near, existingNames, onAdd }: Props) {
  const [key, setKey] = useState(0) // remount the search box to clear it
  const [ideas, setIdeas] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(false)

  const loadIdeas = async () => {
    if (!near) return
    setLoading(true)
    setIdeas(await getNearbyPlaces(near.coords, near.city, 14))
    setLoading(false)
  }

  const fresh = (ideas || []).filter((s) => !existingNames.has(s.name.toLowerCase()))

  return (
    <div className="pl-10 space-y-3">
      <div className="flex gap-2">
        <LocationSearch
          key={key}
          className="flex-1"
          placeholder="Add a place…"
          onChange={(loc) => {
            if (!loc) return
            onAdd(placeFrom(loc))
            setKey((k) => k + 1)
          }}
        />
        {near && (
          <button type="button" onClick={loadIdeas} disabled={loading} className="tp-btn-ghost shrink-0" title="Recommended places nearby">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-accent" />}
            <span className="hidden sm:inline">Ideas</span>
          </button>
        )}
      </div>

      {ideas && (
        <div>
          <div className="text-xs font-medium text-ink-3 mb-1.5">
            {fresh.length ? `Recommended near ${near?.city || 'here'}` : 'Nothing new found nearby'}
          </div>
          {fresh.length > 0 && (
            <ul className="flex gap-2 overflow-x-auto pb-1 -mr-4 pr-4 snap-x">
              {fresh.map((s) => (
                <li key={s.osmId || s.name} className="snap-start shrink-0 w-56 tp-card p-2.5 flex items-start gap-2">
                  <span className="text-lg" aria-hidden>{PLACE_ICONS[s.category] || '📍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{s.name}</div>
                    {s.notes && <div className="text-xs text-ink-3 truncate">{s.notes}</div>}
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${s.name}`}
                    onClick={() => onAdd(placeFrom(s.location, s.category, { name: s.name, website: s.website, notes: s.notes, osmId: s.osmId }))}
                    className="w-7 h-7 rounded-full border border-line flex items-center justify-center text-ink-2 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
