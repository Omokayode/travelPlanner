import { describe, expect, it } from 'vitest'
import { elementsToPois, osmCategory, overpassAreaQuery } from './osmCategory'

describe('osmCategory', () => {
  it.each([
    [{ tourism: 'museum' }, 'museum'],
    [{ leisure: 'park' }, 'park'],
    [{ leisure: 'nature_reserve' }, 'park'],
    [{ boundary: 'national_park', leisure: 'park' }, 'national_park'],
    [{ amenity: 'cafe' }, 'coffee'],
    [{ amenity: 'restaurant' }, 'food'],
    [{ tourism: 'hotel' }, 'lodging'],
    [{ historic: 'fort' }, 'historical'],
    [{ amenity: 'bar' }, 'nightlife'],
    [{ natural: 'waterfall' }, 'scenic'],
  ])('%o → %s', (tags, cat) => expect(osmCategory(tags as Record<string, string>)).toBe(cat))
  it('ignores what we do not list', () => expect(osmCategory({ amenity: 'bank' })).toBeNull())
})

describe('elementsToPois', () => {
  it('uses the centre of ways/relations and keeps a few tags', () => {
    const rows = elementsToPois([
      { type: 'way', id: 5, lat: undefined as unknown as number, lon: undefined as unknown as number, center: { lat: 33.46, lon: -112.0 }, tags: { name: 'Encanto Park', leisure: 'park', website: 'https://x', surface: 'grass' } },
      { type: 'node', id: 6, lat: 33.4, lon: -112.1, tags: { name: 'Cafe', amenity: 'cafe', cuisine: 'coffee_shop' } },
      { type: 'node', id: 7, lat: 33.4, lon: -112.1, tags: { amenity: 'cafe' } }, // no name
      { type: 'node', id: 8, lat: 33.4, lon: -112.1, tags: { name: 'Bank', amenity: 'bank' } }, // not listed
    ])
    expect(rows).toEqual([
      { id: 'way/5', name: 'Encanto Park', category: 'park', lat: 33.46, lng: -112.0, tags: { website: 'https://x' } },
      { id: 'node/6', name: 'Cafe', category: 'coffee', lat: 33.4, lng: -112.1, tags: { cuisine: 'coffee_shop' } },
    ])
  })
})

describe('overpassAreaQuery', () => {
  it('asks for named places with centres, long timeout', () => {
    const q = overpassAreaQuery('food', '33.3,-112.2,33.6,-111.9')
    expect(q).toContain('[timeout:180]')
    expect(q).toContain('out center tags;')
    expect(q).toMatch(/nwr\["amenity"~"\^\(cafe\|restaurant/)
    expect(q).toContain('["name"](33.3,-112.2,33.6,-111.9)')
    expect(q).not.toContain('museum')
  })
})
