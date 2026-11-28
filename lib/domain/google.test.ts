import { describe, expect, it } from 'vitest'
import { bookingUrl, hotelFromGoogle, matchRating, moneyToNumber, pickHotels, tollFromRoute, type Hotel } from './google'

describe('tollFromRoute', () => {
  it('no tollInfo means no tolls', () => expect(tollFromRoute({ travelAdvisory: {} })).toBe(0))
  it('missing route is treated as no tolls', () => expect(tollFromRoute(undefined)).toBe(0))
  it('tollInfo without a price means unknown (estimate instead)', () => {
    expect(tollFromRoute({ travelAdvisory: { tollInfo: {} } })).toBeNull()
    expect(tollFromRoute({ travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: 'EUR', units: '3' }] } } })).toBeNull()
  })
  it('adds up Money (units + nanos)', () => {
    const r = { travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: 'USD', units: '6', nanos: 450_000_000 }, { currencyCode: 'USD', nanos: 750_000_000 }] } } }
    expect(tollFromRoute(r)).toBe(7.2)
  })
  it('moneyToNumber', () => expect(moneyToNumber({ units: '12', nanos: 10_000_000 })).toBeCloseTo(12.01))
})

const h = (name: string, rating?: number, reviews?: number, miles = 1): Hotel => ({ name, coords: { lat: 0, lng: 0 }, rating, reviews, miles, source: 'google' })

describe('hotels', () => {
  it('reads a Google place', () => {
    const x = hotelFromGoogle(
      { displayName: { text: 'Hotel Valley Ho' }, location: { latitude: 33.49, longitude: -111.93 }, rating: 4.5, userRatingCount: 3000, priceLevel: 'PRICE_LEVEL_EXPENSIVE', googleMapsUri: 'https://maps.google.com/?cid=1' },
      { lat: 33.49, lng: -111.93 },
    )!
    expect(x).toMatchObject({ name: 'Hotel Valley Ho', rating: 4.5, reviews: 3000, priceLevel: 3, source: 'google', miles: 0 })
    expect(hotelFromGoogle({ displayName: { text: 'x' } }, { lat: 0, lng: 0 })).toBeNull()
  })
  it('keeps good, well-reviewed ones, best first', () => {
    const list = [h('Meh', 3.6, 900), h('Few reviews', 4.9, 12), h('Great', 4.6, 2000, 2), h('Good', 4.2, 300, 0.5)]
    expect(pickHotels(list).map((x) => x.name)).toEqual(['Great', 'Good'])
  })
  it('without ratings (OpenStreetMap) keeps what there is', () => {
    expect(pickHotels([{ ...h('A'), source: 'osm' }, { ...h('B'), source: 'osm' }])).toHaveLength(2)
  })
  it('booking link has the dates', () => {
    const q = new URL(bookingUrl('Hotel Valley Ho', 'Scottsdale, Arizona', '2026-12-18', '2026-12-21')).searchParams
    expect(q.get('ss')).toBe('Hotel Valley Ho, Scottsdale, Arizona')
    expect(q.get('checkin')).toBe('2026-12-18')
    expect(q.get('checkout')).toBe('2026-12-21')
  })
})

describe('matchRating', () => {
  const rated = [{ name: 'Heard Museum', coords: { lat: 33.4725, lng: -112.0723 }, rating: 4.8, reviews: 6000 }]
  it('matches by name nearby', () => expect(matchRating('Heard Museum', { lat: 33.4726, lng: -112.0724 }, rated)?.rating).toBe(4.8))
  it('not far away', () => expect(matchRating('Heard Museum', { lat: 34.0, lng: -112.0 }, rated)).toBeUndefined())
  it('not a different name', () => expect(matchRating('Phoenix Art Museum', { lat: 33.4726, lng: -112.0724 }, rated)).toBeUndefined())
})
