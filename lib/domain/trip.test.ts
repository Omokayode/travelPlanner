import { describe, expect, it } from 'vitest'
import type { Day, Lodging, Segment, Trip } from '@/lib/types'
import { buildDays, dayStops, dayTotals, lodgingForDate, overallStats, resizeDays, tripStats, tripStatus } from './trip'
import { haversineMiles, minDistanceToRoute } from './geo'

const loc = (name: string) => ({ id: name, name, coords: { lat: 0, lng: 0 } })
const seg = (p: Partial<Segment>): Segment => ({ id: 's', from: loc('a'), to: loc('b'), mode: 'drive', stops: [], ...p })
const day = (p: Partial<Day>): Day => ({
  id: 'd', date: '2025-07-01', dayNumber: 1, segments: [], activities: [], visited: false, ...p,
})
let n = 0
const id = () => `id${++n}`

describe('day and trip totals', () => {
  const d1 = day({
    visited: true,
    segments: [
      seg({ distance: 100, duration: 90, fuelCost: 10, tollCost: 4, cost: 14, stops: [{ id: 'x' } as never] }),
      seg({ distance: 50.5, duration: 30, cost: 0 }),
      // a leg saved without a stop list (old data) must not break anything
      { ...seg({ distance: 1 }), stops: undefined as unknown as [] },
    ],
    activities: [{ id: 'a', name: 'Museum', type: 'attraction', visited: false, cost: 20 }],
  })
  const d2 = day({ id: 'd2', dayNumber: 2, segments: [seg({ distance: 10, cost: 3 })] })

  it('adds up a day, including activities', () => {
    expect(dayTotals(d1)).toEqual({ miles: 151.5, driveMinutes: 120, fuelCost: 10, tollCost: 4, cost: 34, stops: 1 })
    expect(dayStops(d1)).toHaveLength(1)
    expect(dayTotals({})).toEqual({ miles: 0, driveMinutes: 0, fuelCost: 0, tollCost: 0, cost: 0, stops: 0 })
  })

  it('adds up a trip', () => {
    const s = tripStats({ days: [d1, d2], visitedCities: ['Atlanta', 'Nashville'] })
    expect(s).toMatchObject({ totalMiles: 162, totalDrivingHours: 2, totalCost: 37, citiesCount: 2, daysCompleted: 1, totalDays: 2, stopsCount: 1 })
  })

  it('adds up the dashboard', () => {
    const t = { days: [d1, d2], visitedCities: ['A'] } as unknown as Trip
    expect(overallStats([t, t])).toEqual({ miles: 324, cities: 2, cost: 74 })
  })
})

describe('lodging for a date', () => {
  const a: Lodging = { id: 'a', name: 'Hotel A', location: loc('A'), checkIn: '2025-07-01', checkOut: '2025-07-03' }
  const b: Lodging = { id: 'b', name: 'Hotel B', location: loc('B'), checkIn: '2025-07-03', checkOut: '2025-07-05' }
  it('picks where you sleep that night', () => {
    expect(lodgingForDate([a, b], '2025-07-01')?.id).toBe('a')
    expect(lodgingForDate([a, b], '2025-07-03')?.id).toBe('b') // check-out of A, check-in of B
    expect(lodgingForDate([a, b], '2025-07-05')?.id).toBe('b') // last check-out day still shows B
    expect(lodgingForDate([a, b], '2025-07-06')).toBeUndefined()
    expect(lodgingForDate(undefined, '2025-07-01')).toBeUndefined()
  })
})

describe('building and resizing days', () => {
  it('builds one day per date, day 1 on the start date', () => {
    const days = buildDays('2025-07-01', '2025-07-03', id)
    expect(days.map((d) => [d.dayNumber, d.date])).toEqual([[1, '2025-07-01'], [2, '2025-07-02'], [3, '2025-07-03']])
  })

  it('keeps content with the day number, re-dates, and adds days at the end', () => {
    const days = [day({ id: 'k1', dayNumber: 1, notes: 'one' }), day({ id: 'k2', dayNumber: 2, notes: 'two' })]
    const r = resizeDays(days, '2025-08-10', '2025-08-13', id)
    expect(r.days.map((d) => [d.id, d.dayNumber, d.date, d.notes])).toEqual([
      ['k1', 1, '2025-08-10', 'one'],
      ['k2', 2, '2025-08-11', 'two'],
      [r.added[0].id, 3, '2025-08-12', undefined],
      [r.added[1].id, 4, '2025-08-13', undefined],
    ])
    expect(r.removed).toEqual([])
  })

  it('drops days from the end when the trip gets shorter, whatever order they came in', () => {
    const days = [day({ id: 'k3', dayNumber: 3 }), day({ id: 'k1', dayNumber: 1 }), day({ id: 'k2', dayNumber: 2 })]
    const r = resizeDays(days, '2025-07-01', '2025-07-02', id)
    expect(r.days.map((d) => d.id)).toEqual(['k1', 'k2'])
    expect(r.removed.map((d) => d.id)).toEqual(['k3'])
  })
})

describe('geo', () => {
  it('measures great-circle distance in miles', () => {
    const chicago = { lat: 41.8781, lng: -87.6298 }
    const milwaukee = { lat: 43.0389, lng: -87.9065 }
    expect(Math.round(haversineMiles(chicago, milwaukee))).toBe(81)
    expect(haversineMiles(chicago, chicago)).toBe(0)
    expect(Math.round(minDistanceToRoute(milwaukee, [[41.8781, -87.6298], [43.0389, -87.9065]]))).toBe(0)
  })
})

describe('tripStatus', () => {
  it('counts down, then days on the road, then past', () => {
    expect(tripStatus('2026-12-10', '2026-12-12', '2026-12-09')).toEqual({ kind: 'upcoming', inDays: 1 })
    expect(tripStatus('2026-12-10', '2026-12-12', '2026-11-30')).toEqual({ kind: 'upcoming', inDays: 10 })
    expect(tripStatus('2026-12-10', '2026-12-12', '2026-12-10')).toEqual({ kind: 'ongoing', day: 1, of: 3 })
    expect(tripStatus('2026-12-10', '2026-12-12', '2026-12-12')).toEqual({ kind: 'ongoing', day: 3, of: 3 })
    expect(tripStatus('2026-12-10', '2026-12-12', '2026-12-13')).toEqual({ kind: 'past' })
  })
})
