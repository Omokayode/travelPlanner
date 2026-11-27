// lib/domain/trip.ts — totals, days and lodging lookups shared by the pages, panels and API.
import type { Day, Lodging, Stop, Trip, TripStats } from '@/lib/types'
import { addDays, daysInclusive } from './dates'

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places
const sum = <T>(list: T[] | undefined | null, pick: (x: T) => number | undefined | null) =>
  (list || []).reduce((s, x) => s + (Number(pick(x)) || 0), 0)

export interface DayTotals {
  miles: number
  driveMinutes: number
  fuelCost: number
  tollCost: number
  /** leg costs (fuel + tolls or tickets) + activity costs */
  cost: number
  stops: number
}

export function dayTotals(day: Partial<Day>): DayTotals {
  const segments = day.segments || []
  return {
    miles: sum(segments, (s) => s.distance),
    driveMinutes: sum(segments, (s) => s.duration),
    fuelCost: sum(segments, (s) => s.fuelCost),
    tollCost: sum(segments, (s) => s.tollCost),
    cost: sum(segments, (s) => s.cost) + sum(day.activities, (a) => a.cost),
    stops: sum(segments, (s) => (s.stops || []).length),
  }
}

/** All stops of a day, skipping legs without a stop list. */
export function dayStops(day: Partial<Day>): Stop[] {
  return (day.segments || []).flatMap((s) => s.stops || [])
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
    stopsCount: sum(t, (x) => x.stops),
  }
}

/** Dashboard header numbers across all trips. */
export function overallStats(trips: Trip[]): { miles: number; cities: number; cost: number } {
  const stats = trips.map(tripStats)
  return {
    miles: sum(stats, (s) => s.totalMiles),
    cities: sum(stats, (s) => s.citiesCount),
    cost: round(sum(stats, (s) => s.totalCost), 2),
  }
}

/** The lodging you sleep at on that night (check-in <= date < check-out, else covering check-out day). */
export function lodgingForDate(lodgings: Lodging[] | undefined | null, date: string): Lodging | undefined {
  const list = lodgings || []
  return list.find((l) => l.checkIn <= date && date < l.checkOut) || list.find((l) => l.checkIn <= date && date <= l.checkOut)
}

export function newDay(id: string, date: string, dayNumber: number): Day {
  return { id, date, dayNumber, segments: [], activities: [], photos: [], visited: false }
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
