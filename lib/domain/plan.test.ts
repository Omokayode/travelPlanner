import { describe, expect, it } from 'vitest'
import { hintsFromText, layoutDays, orderByDistance, pickForDays, rankCandidates, totalNights, type Candidate, type TripOutline } from './plan'

const city = (name: string, lat = 0, lng = 0) => ({ name, state: 'X', coords: { lat, lng } })
const outline = (p: Partial<TripOutline> = {}): TripOutline => ({
  name: 'Test',
  start: city('Home'),
  stays: [
    { city: city('Phoenix'), nights: 3 },
    { city: city('Sedona'), nights: 2 },
  ],
  returnHome: true,
  interests: ['museums'],
  pace: 'normal',
  mode: 'drive',
  ...p,
})

describe('layoutDays', () => {
  it('nights + 1 days: arrive, explore, move on, go home', () => {
    const days = layoutDays(outline())
    expect(totalNights(outline())).toBe(5)
    expect(days.map((d) => `${d.kind}:${d.city.name}`)).toEqual([
      'travel:Phoenix',
      'explore:Phoenix',
      'explore:Phoenix',
      'travel:Sedona',
      'explore:Sedona',
      'return:Home',
    ])
    expect(days[3].from?.name).toBe('Phoenix')
    expect(days.map((d) => d.slots)).toEqual([1, 4, 4, 1, 4, 0])
  })
  it('one-way trip ends with a last morning; relaxed pace means fewer places', () => {
    const days = layoutDays(outline({ returnHome: false, pace: 'relaxed', stays: [{ city: city('Chicago'), nights: 1 }] }))
    expect(days.map((d) => d.kind)).toEqual(['travel', 'depart'])
    expect(days.map((d) => d.slots)).toEqual([0, 1])
  })
})

const c = (name: string, category: Candidate['category'], known = false, lat = 0): Candidate => ({ name, category, known, coords: { lat, lng: 0 } })

describe('choosing places', () => {
  const list = [c('Diner', 'food'), c('Park', 'park', true), c('Art Museum', 'museum'), c('Cafe', 'coffee'), c('History Museum', 'museum', true), c('Mall', 'shopping')]
  it('ranks your interests first, well-known ones before others', () => {
    expect(rankCandidates(list, ['museums']).map((x) => x.name).slice(0, 3)).toEqual(['History Museum', 'Art Museum', 'Park'])
  })
  it('shares places over days without repeats, one meal a day', () => {
    const days = pickForDays(rankCandidates(list, ['museums', 'food']), [3, 3])
    const all = days.flat().map((x) => x.name)
    expect(new Set(all).size).toBe(all.length)
    for (const d of days) expect(d.filter((x) => x.category === 'food' || x.category === 'coffee').length).toBeLessThanOrEqual(1)
    // takes turns: a museum, a meal, the next museum
    expect(days[0].map((x) => x.name)).toEqual(['History Museum', 'Diner', 'Art Museum'])
  })
  it('mixes interests within a day', () => {
    const many = [c('M1', 'museum', true), c('M2', 'museum', true), c('M3', 'museum', true), c('P1', 'park'), c('H1', 'historical')]
    expect(rankCandidates(many, ['museums', 'nature', 'history']).map((x) => x.name).slice(0, 4)).toEqual(['M1', 'P1', 'H1', 'M2'])
  })
  it('visits nearest first', () => {
    const far = c('Far', 'museum', false, 5)
    const near = c('Near', 'museum', false, 1)
    const mid = c('Mid', 'museum', false, 3)
    expect(orderByDistance([far, near, mid], { lat: 0, lng: 0 }).map((x) => x.name)).toEqual(['Near', 'Mid', 'Far'])
  })
})

describe('hintsFromText', () => {
  it('finds the start city, one-way and interests', () => {
    const h = hintsFromText('5 days in Arizona in mid December from Milwaukee: Phoenix then Sedona, museums and hiking, driving')
    expect(h.start).toEqual({ name: 'Milwaukee', state: undefined })
    expect(h.oneWay).toBe(false)
    expect(h.interests.sort()).toEqual(['museums', 'nature'])
    expect(hintsFromText('one-way from Saint Paul, Minnesota to Denver').start).toEqual({ name: 'Saint Paul', state: 'Minnesota' })
    expect(hintsFromText('one-way to Denver').oneWay).toBe(true)
    expect(hintsFromText('a week in Chicago').start).toBeUndefined()
  })
})
