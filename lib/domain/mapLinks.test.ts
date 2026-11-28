import { describe, expect, it } from 'vitest'
import { appleDirections, applePlace, googleDirections, googlePlace, GOOGLE_MAX_WAYPOINTS } from './mapLinks'

const stop = (i: number) => ({ name: `P${i}`, coords: { lat: 33 + i / 100, lng: -112 - i / 100 } })

describe('googleDirections', () => {
  it('one hop has no waypoints', () => {
    const { url, included } = googleDirections([stop(0), stop(1)])
    const q = new URL(url).searchParams
    expect(q.get('origin')).toBe('33.000000,-112.000000')
    expect(q.get('destination')).toBe('33.010000,-112.010000')
    expect(q.get('waypoints')).toBeNull()
    expect(q.get('travelmode')).toBe('driving')
    expect(included).toBe(2)
  })
  it('a day keeps the stops in between as waypoints, in order', () => {
    const q = new URL(googleDirections([0, 1, 2, 3].map(stop), 'walk').url).searchParams
    expect(q.get('waypoints')).toBe('33.010000,-112.010000|33.020000,-112.020000')
    expect(q.get('travelmode')).toBe('walking')
  })
  it('caps a long day at the first places Google accepts', () => {
    const many = Array.from({ length: 14 }, (_, i) => stop(i))
    const { url, included } = googleDirections(many)
    const q = new URL(url).searchParams
    expect(included).toBe(GOOGLE_MAX_WAYPOINTS + 2)
    expect(q.get('waypoints')!.split('|')).toHaveLength(GOOGLE_MAX_WAYPOINTS)
    expect(q.get('destination')).toBe('33.090000,-112.090000')
  })
  it('a single place is a search', () => {
    expect(googleDirections([stop(0)]).url).toContain('/maps/search/')
    expect(googlePlace(stop(0))).toContain('query=P0')
  })
})

describe('apple', () => {
  it('directions take one start and one destination', () => {
    const q = new URL(appleDirections(stop(0), stop(5))).searchParams
    expect(q.get('saddr')).toBe('33.000000,-112.000000')
    expect(q.get('daddr')).toBe('33.050000,-112.050000')
    expect(q.get('dirflg')).toBe('d')
  })
  it('place link has the name and position', () => {
    const q = new URL(applePlace(stop(1))).searchParams
    expect(q.get('q')).toBe('P1')
    expect(q.get('ll')).toBe('33.010000,-112.010000')
  })
})
