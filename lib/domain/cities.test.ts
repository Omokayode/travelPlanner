import { describe, expect, it } from 'vitest'
import type { Day, Place, PlaceCategory } from '@/lib/types'
import { cityLabel, visitedCities } from './cities'

const place = (category: PlaceCategory, name: string, city?: string, state?: string): Place => ({
  id: name, name, category, location: { id: '', name, city, state, coords: { lat: 0, lng: 0 } },
})
const day = (n: number, visited: boolean, places: Place[]): Day => ({ id: `d${n}`, date: '2026-01-01', dayNumber: n, visited, places })

describe('cityLabel', () => {
  it('uses the city, with the state', () => {
    expect(cityLabel(place('museum', 'Heard Museum', 'Phoenix', 'Arizona'))).toBe('Phoenix, Arizona')
  })
  it('a city place without a city field uses its name', () => {
    expect(cityLabel(place('city', 'Sedona', undefined, 'Arizona'))).toBe('Sedona, Arizona')
  })
  it('never counts a state as a city', () => {
    expect(cityLabel(place('city', 'Iowa', undefined, 'Iowa'))).toBeNull()
    expect(cityLabel(place('scenic', 'Lookout', undefined, 'Utah'))).toBeNull()
  })
})

describe('visitedCities', () => {
  const days = [
    day(1, true, [place('city', 'Milwaukee', 'Milwaukee', 'Wisconsin'), place('city', 'Fayetteville', 'Fayetteville', 'Arkansas')]),
    day(2, true, [place('food', 'Diner', 'Fayetteville', 'Arkansas'), place('city', 'Fayetteville', 'Fayetteville', 'Georgia')]),
    day(3, false, [place('city', 'Atlanta', 'Atlanta', 'Georgia')]),
  ]
  it('each city once, same-named cities in other states kept apart, home and unvisited days left out', () => {
    expect(visitedCities(days, 'Milwaukee, Wisconsin')).toEqual(['Fayetteville, Arkansas', 'Fayetteville, Georgia'])
  })
})
