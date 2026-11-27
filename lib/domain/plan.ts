// lib/domain/plan.ts — turn a trip outline ("from Milwaukee: Phoenix 3 nights, Sedona 2 nights,
// back home; museums and hiking") into days of places. Pure functions: the server adds real
// places (OpenStreetMap) and an AI may write the outline from plain text, but the day layout and
// the choice of places are decided here.
import type { Coordinates, PlaceCategory, TransportMode } from '@/lib/types'
import { haversineMiles } from './geo'

export const INTERESTS = ['sights', 'museums', 'history', 'food', 'coffee', 'nature', 'shopping', 'nightlife'] as const
export type Interest = (typeof INTERESTS)[number]

export const INTEREST_LABELS: Record<Interest, string> = {
  sights: 'Sights',
  museums: 'Museums',
  history: 'History',
  food: 'Food',
  coffee: 'Coffee',
  nature: 'Nature & hiking',
  shopping: 'Shopping',
  nightlife: 'Nightlife',
}

/** Which kinds of places each interest favours. */
export const INTEREST_CATEGORIES: Record<Interest, PlaceCategory[]> = {
  sights: ['attraction', 'viewpoint', 'scenic'],
  museums: ['museum'],
  history: ['historical', 'museum'],
  food: ['food'],
  coffee: ['coffee'],
  nature: ['park', 'national_park', 'scenic', 'viewpoint'],
  shopping: ['shopping'],
  nightlife: ['nightlife'],
}

/** Wikipedia search words per interest (searched near each city). */
export const INTEREST_SEARCH: Partial<Record<Interest, string>> = {
  sights: 'landmark OR attraction OR zoo OR aquarium OR observatory OR viewpoint',
  museums: 'museum',
  history: 'historic site OR landmark OR monument OR mission OR fort OR historic house',
  nature: 'park OR trail OR garden OR mountain OR canyon OR lake OR wilderness',
  shopping: 'shopping OR market',
}

export type Pace = 'relaxed' | 'normal' | 'packed'
/** places to add on a full day in a city / on a day you arrive somewhere */
export const PACE_SLOTS: Record<Pace, { full: number; arrival: number }> = {
  relaxed: { full: 2, arrival: 0 },
  normal: { full: 4, arrival: 1 },
  packed: { full: 6, arrival: 2 },
}

export interface PlanCity {
  name: string
  state?: string
  country?: string
  coords?: Coordinates
}

export interface Stay {
  city: PlanCity
  nights: number
}

export interface TripOutline {
  name: string
  start: PlanCity
  stays: Stay[]
  /** last day: drive (or fly) back to the start */
  returnHome: boolean
  startDate?: string
  interests: Interest[]
  pace: Pace
  /** how you get between cities */
  mode: Extract<TransportMode, 'drive' | 'flight' | 'train'>
}

export interface DayLayout {
  dayNumber: number
  kind: 'travel' | 'explore' | 'return' | 'depart'
  /** where the day starts when it is a travel day */
  from?: PlanCity
  /** the city the day is about (where you sleep, or end up) */
  city: PlanCity
  /** sights/food to add */
  slots: number
  title: string
}

export const totalNights = (o: Pick<TripOutline, 'stays'>) => o.stays.reduce((n, s) => n + Math.max(1, Math.round(s.nights)), 0)
export const cityText = (c: PlanCity) => (c.state ? `${c.name}, ${c.state}` : c.name)

/**
 * Days for an outline: arrive in each city, explore it on the nights after, move on, and finish by
 * going home (or a last morning where you are). Always nights + 1 days.
 */
export function layoutDays(o: TripOutline): DayLayout[] {
  const slots = PACE_SLOTS[o.pace]
  const days: DayLayout[] = []
  let current = o.start
  for (const stay of o.stays) {
    const nights = Math.max(1, Math.round(stay.nights))
    days.push({
      dayNumber: days.length + 1,
      kind: 'travel',
      from: current,
      city: stay.city,
      slots: slots.arrival,
      title: `${current.name} → ${stay.city.name}`,
    })
    for (let n = 1; n < nights; n++) {
      days.push({ dayNumber: days.length + 1, kind: 'explore', city: stay.city, slots: slots.full, title: `Day in ${stay.city.name}` })
    }
    current = stay.city
  }
  if (o.returnHome) {
    days.push({ dayNumber: days.length + 1, kind: 'return', from: current, city: o.start, slots: 0, title: `${current.name} → ${o.start.name}` })
  } else {
    days.push({ dayNumber: days.length + 1, kind: 'depart', city: current, slots: Math.min(1, slots.full), title: `Last morning in ${current.name}` })
  }
  return days
}

export interface Candidate {
  name: string
  category: PlaceCategory
  coords: Coordinates
  /** well known (has a Wikidata entry) */
  known?: boolean
}

/**
 * Best first, taking turns between your interests (a museum, then a hike, then a historic site…),
 * well-known places before others within each; then everything else.
 */
export function rankCandidates<T extends Candidate>(list: T[], interests: Interest[]): T[] {
  const byKnown = list.map((c, i) => ({ c, i })).sort((a, b) => Number(!!b.c.known) - Number(!!a.c.known) || a.i - b.i)
  // each interest's own main kind first (history: historic sites before museums)
  const queues = interests.map((it) => {
    const kinds = INTEREST_CATEGORIES[it]
    return byKnown.filter((x) => kinds.includes(x.c.category)).sort((a, b) => kinds.indexOf(a.c.category) - kinds.indexOf(b.c.category))
  })
  const taken = new Set<number>()
  const out: T[] = []
  for (let more = true; more; ) {
    more = false
    for (const q of queues) {
      while (q.length && taken.has(q[0].i)) q.shift()
      const next = q.shift()
      if (next) {
        taken.add(next.i)
        out.push(next.c)
        more = true
      }
    }
  }
  for (const x of byKnown) if (!taken.has(x.i)) out.push(x.c)
  return out
}

/** Visit order within a day: start nearest `from`, then always the closest next one. */
export function orderByDistance<T extends { coords: Coordinates }>(items: T[], from?: Coordinates): T[] {
  const left = [...items]
  const out: T[] = []
  let at = from ?? left[0]?.coords
  while (left.length && at) {
    let best = 0
    for (let i = 1; i < left.length; i++) {
      if (haversineMiles(at, left[i].coords) < haversineMiles(at, left[best].coords)) best = i
    }
    const [next] = left.splice(best, 1)
    out.push(next)
    at = next.coords
  }
  return out
}

const isFood = (c: Candidate) => c.category === 'food' || c.category === 'coffee'

/**
 * Share a city's candidates over its days: each day gets `slots` places, no place twice, at most
 * one meal (food or coffee) per day unless food is all there is, best-ranked first.
 */
export function pickForDays<T extends Candidate>(ranked: T[], slotsPerDay: number[]): T[][] {
  const used = new Set<number>()
  return slotsPerDay.map((slots) => {
    const day: T[] = []
    let meals = 0
    for (let pass = 0; pass < 2 && day.length < slots; pass++) {
      ranked.forEach((c, i) => {
        if (day.length >= slots || used.has(i)) return
        if (pass === 0 && isFood(c) && meals >= 1) return // second pass allows more if nothing else
        used.add(i)
        if (isFood(c)) meals++
        day.push(c)
      })
    }
    return day
  })
}

const INTEREST_WORDS: [RegExp, Interest][] = [
  [/museum|galler(y|ies)|\bart\b/i, 'museums'],
  [/histor|heritage|civil war|monument/i, 'history'],
  [/hik(e|ing)|nature|outdoor|park|trail|canyon|mountain|beach|scenic|camp/i, 'nature'],
  [/food|eat|restaurant|bbq|barbecue|cuisine|foodie|diner/i, 'food'],
  [/coffee|caf[eé]/i, 'coffee'],
  [/shop|market|mall|outlet/i, 'shopping'],
  [/nightlife|\bbars?\b|clubs?|music|jazz|blues/i, 'nightlife'],
  [/sight|architecture|landmark|tour/i, 'sights'],
]

/**
 * Facts that can be read straight from the words, used to correct a small AI model:
 * "from Milwaukee" → start city; "one-way" → no return; interest keywords.
 */
export function hintsFromText(text: string): { start?: PlanCity; oneWay: boolean; interests: Interest[] } {
  const m = /\bfrom\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?:,\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?|[A-Z]{2}))?/.exec(text)
  return {
    start: m ? { name: m[1].trim(), state: m[2]?.trim() } : undefined,
    oneWay: /one[- ]?way|not coming back|no return|moving to/i.test(text),
    interests: INTEREST_WORDS.filter(([re]) => re.test(text)).map(([, i]) => i),
  }
}
