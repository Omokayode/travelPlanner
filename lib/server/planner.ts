// lib/server/planner.ts — outline → draft trip with real places (not saved; the new-trip page
// shows it, then creates it through POST /api/trips, which routes the drives).
import 'server-only'
import { v4 as uuidv4 } from 'uuid'
import type { Coordinates, Place, PlaceCategory, TripType } from '@/lib/types'
import { addDays } from '@/lib/domain/dates'
import { haversineMiles } from '@/lib/domain/geo'
import { cityText, layoutDays, orderByDistance, pickForDays, rankCandidates, type PlanCity, type TripOutline } from '@/lib/domain/plan'
import { nearbyPlaces, searchPlaces, type Attraction } from '@/lib/osm'

export interface DraftDay {
  dayNumber: number
  date: string
  title: string
  places: Place[]
}
export interface Draft {
  name: string
  type: TripType
  startDate: string
  endDate: string
  days: DraftDay[]
  /** things the user should know (city not found, no places found…) */
  notes: string[]
}

const key = (c: PlanCity) => cityText(c).toLowerCase()

/** Look up a city's coordinates (and tidy its name/state) unless it already has them. */
export async function locateCity(c: PlanCity): Promise<PlanCity | null> {
  if (c.coords) return c
  const [hit] = await searchPlaces(cityText(c), 1)
  if (!hit) return null
  return { name: hit.city || c.name, state: hit.state || c.state, country: hit.country, coords: hit.coords }
}

const cityPlace = (c: PlanCity, travel?: Place['travel']): Place => ({
  id: uuidv4(),
  name: c.name,
  category: 'city',
  location: { id: '', name: c.name, city: c.name, state: c.state, country: c.country, coords: c.coords! },
  ...(travel ? { travel } : {}),
})

const attractionPlace = (a: Attraction, prev: { lat: number; lng: number }): Place => ({
  id: uuidv4(),
  name: a.name,
  category: a.category as PlaceCategory,
  location: a.location,
  website: a.website,
  notes: a.notes,
  osmId: a.osmId,
  // short hops inside a city are walked, the rest driven; the server works out the numbers
  travel: { mode: haversineMiles(prev, a.location.coords) < 0.8 ? 'walk' : 'drive', auto: true },
})

export async function buildDraft(outline: TripOutline, startDate: string, progress: (msg: string) => void): Promise<Draft> {
  const notes: string[] = []

  // 1. where are the cities?
  progress('Finding the cities…')
  const start = await locateCity(outline.start)
  if (!start) throw new Error(`Could not find ${cityText(outline.start)}`)
  const stays = []
  for (const s of outline.stays) {
    const c = await locateCity(s.city)
    if (c) stays.push({ city: c, nights: s.nights })
    else notes.push(`Left out ${cityText(s.city)}: not found on the map.`)
  }
  if (!stays.length) throw new Error('None of the cities could be found')
  const o: TripOutline = { ...outline, start, stays }

  // 2. which days go where
  const layout = layoutDays(o)

  // 3. real places around each city, shared over that city's days
  const picks = new Map<number, (Attraction & { coords: Coordinates })[]>()
  const byCity = new Map<string, { city: PlanCity; days: { dayNumber: number; slots: number }[] }>()
  for (const d of layout) {
    if (!d.slots) continue
    const k = key(d.city)
    const entry = byCity.get(k) ?? { city: d.city, days: [] }
    entry.days.push({ dayNumber: d.dayNumber, slots: d.slots })
    byCity.set(k, entry)
  }
  for (const { city, days } of Array.from(byCity.values())) {
    progress(`Finding places in ${city.name}…`)
    let found: Attraction[] = []
    try {
      found = await nearbyPlaces(city.coords!, 80, city.name, 15000, o.interests)
    } catch {
      notes.push(`Could not look up places in ${city.name} (map service busy) — add some yourself.`)
    }
    if (found.length) {
      const ranked = rankCandidates(found.map((a) => ({ ...a, coords: a.location.coords })), o.interests)
      pickForDays(ranked, days.map((d) => d.slots)).forEach((list, i) => picks.set(days[i].dayNumber, list))
    } else if (!notes.some((n) => n.includes(city.name))) {
      notes.push(`No sights found near ${city.name} — add your own.`)
    }
  }

  // 4. days of places
  progress('Putting the days together…')
  const between = o.mode
  const days: DraftDay[] = layout.map((d) => {
    const places: Place[] = []
    if (d.from) places.push(cityPlace(d.from))
    places.push(cityPlace(d.city, d.from ? { mode: between, auto: true } : undefined))
    let at = d.city.coords!
    for (const a of orderByDistance(picks.get(d.dayNumber) || [], d.city.coords)) {
      places.push(attractionPlace(a, at))
      at = a.location.coords
    }
    return { dayNumber: d.dayNumber, date: addDays(startDate, d.dayNumber - 1), title: d.title, places }
  })

  return {
    name: o.name,
    type: between === 'drive' ? 'road_trip' : between === 'flight' ? 'flight' : 'train',
    startDate,
    endDate: addDays(startDate, layout.length - 1),
    days,
    notes,
  }
}
