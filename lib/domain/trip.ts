// lib/domain/trip.ts — totals, days and lodging lookups shared by the pages, panels and API.
import type { Day, Lodging, Place, Trip, TripStats } from '@/lib/types'
import { addDays, daysInclusive } from './dates'

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places
const sum = <T>(list: T[] | undefined | null, pick: (x: T) => number | undefined | null) =>
  (list || []).reduce((s, x) => s + (Number(pick(x)) || 0), 0)

export interface DayTotals {
  miles: number
  driveMinutes: number
  fuelCost: number
  tollCost: number
  /** travel costs (fuel + tolls, or tickets) + money spent at the places */
  cost: number
  places: number
}

/** Totals of a day, from how you get to each place. */
export function dayTotals(day: Partial<Day>): DayTotals {
  const places: Place[] = day.places || []
  return {
    miles: sum(places, (p) => p.travel?.distance),
    driveMinutes: sum(places, (p) => p.travel?.duration),
    fuelCost: sum(places, (p) => p.travel?.fuelCost),
    tollCost: sum(places, (p) => p.travel?.tollCost),
    cost: sum(places, (p) => p.travel?.cost) + sum(places, (p) => p.cost),
    places: places.length,
  }
}

export function tripStats(trip: Pick<Trip, 'days' | 'visitedCities'>): TripStats {
  const days = trip.days || []
  const t = days.map(dayTotals)
  return {
    totalMiles: Math.round(sum(t, (x) => x.miles)),
    totalDrivingHours: round(sum(t, (x) => x.driveMinutes) / 60, 1),
    totalCost: round(sum(t, (x) => x.cost), 2),
    totalFuelCost: round(sum(t, (x) => x.fuelCost), 2),
    totalTollCost: round(sum(t, (x) => x.tollCost), 2),
    citiesCount: (trip.visitedCities || []).length,
    daysCompleted: days.filter((d) => d.visited).length,
    totalDays: days.length,
    stopsCount: sum(t, (x) => x.places),
  }
}

/** Dashboard header numbers across all trips; a city visited on several trips counts once. */
export function overallStats(trips: Trip[]): { miles: number; cities: number; cost: number } {
  const stats = trips.map(tripStats)
  const cities = new Set(trips.flatMap((t) => (t.visitedCities || []).map((c) => c.toLowerCase())))
  return {
    miles: sum(stats, (s) => s.totalMiles),
    cities: cities.size,
    cost: round(sum(stats, (s) => s.totalCost), 2),
  }
}

/** The lodging you sleep at on that night (check-in <= date < check-out, else covering check-out day). */
export function lodgingForDate(lodgings: Lodging[] | undefined | null, date: string): Lodging | undefined {
  const list = lodgings || []
  return list.find((l) => l.checkIn <= date && date < l.checkOut) || list.find((l) => l.checkIn <= date && date <= l.checkOut)
}

export function newDay(id: string, date: string, dayNumber: number): Day {
  return { id, date, dayNumber, places: [], visited: false }
}

/** One Day per date from start to end; ids from makeId (uuid in the app). */
export function buildDays(start: string, end: string, makeId: () => string): Day[] {
  return Array.from({ length: daysInclusive(start, end) }, (_, i) => newDay(makeId(), addDays(start, i), i + 1))
}

/**
 * Fit existing days to new trip dates: keeps days in order (their content stays with the day
 * number), re-dates them, adds empty days at the end or drops days from the end.
 */
export function resizeDays(
  days: Day[],
  start: string,
  end: string,
  makeId: () => string,
): { days: Day[]; added: Day[]; removed: Day[] } {
  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber)
  const count = daysInclusive(start, end)
  const kept = ordered.slice(0, count)
  const removed = ordered.slice(count)
  const added: Day[] = []
  for (let i = kept.length; i < count; i++) added.push(newDay(makeId(), addDays(start, i), i + 1))
  const result = [...kept, ...added].map((d, i) => ({ ...d, dayNumber: i + 1, date: addDays(start, i) }))
  return { days: result, added, removed }
}

export type TripStatus =
  | { kind: 'upcoming'; inDays: number }
  | { kind: 'ongoing'; day: number; of: number }
  | { kind: 'past' }

/** Where a trip stands relative to today (both "YYYY-MM-DD", local dates). */
export function tripStatus(start: string, end: string, today: string): TripStatus {
  if (today < start) return { kind: 'upcoming', inDays: daysInclusive(today, start) - 1 }
  if (today > end) return { kind: 'past' }
  return { kind: 'ongoing', day: daysInclusive(start, today), of: daysInclusive(start, end) }
}
