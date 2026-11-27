// lib/domain/cities.ts — what counts as a city visited. Same rules as the 1.7.0 migration:
// a place's city (or, for a "city" place without one, its name — unless that name is just the
// state), labelled "City, State"; each label once; the home city never counts.
import type { Day, Place } from '@/lib/types'

export function cityLabel(p: Pick<Place, 'category' | 'location'>): string | null {
  const { city, name, state } = p.location
  const c = city?.trim() || (p.category === 'city' && name?.trim() && name.trim().toLowerCase() !== state?.trim().toLowerCase() ? name.trim() : '')
  if (!c) return null
  return state?.trim() ? `${c}, ${state.trim()}` : c
}

/** Unique city labels of visited days, in the order first reached, without the home city. */
export function visitedCities(days: Pick<Day, 'dayNumber' | 'visited' | 'places'>[], homeCity?: string | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const home = homeCity?.trim().toLowerCase()
  for (const d of [...days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    if (!d.visited) continue
    for (const p of d.places) {
      const label = cityLabel(p)
      if (!label || seen.has(label.toLowerCase()) || label.toLowerCase() === home) continue
      seen.add(label.toLowerCase())
      out.push(label)
    }
  }
  return out
}

/** "City, State" → "City" for compact chips. */
export const cityName = (label: string) => label.split(',')[0]
