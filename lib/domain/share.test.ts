import { describe, expect, it } from 'vitest'
import type { Trip } from '@/lib/types'
import { toPublicTrip } from './share'

const loc = { id: 'nominatim_1', name: 'Hotel X', address: '1 Main St', city: 'Austin', coords: { lat: 30, lng: -97 } }
const trip: Trip = {
  id: 'trip123',
  name: 'Texas',
  startDate: '2026-12-01',
  endDate: '2026-12-02',
  type: 'road_trip',
  visitedCities: ['Austin'],
  createdAt: '',
  updatedAt: '',
  coverPhotoUrl: '/api/immich/assets/x/thumbnail',
  shareToken: 'SECRET-TOKEN',
  vehicle: { make: 'Honda', model: 'Civic', fuelEfficiency: 38, fuelType: 'regular', tankSize: 13 },
  lodgings: [{ id: 'l', name: 'Hotel X', location: loc, checkIn: '2026-12-01', checkOut: '2026-12-02', cost: 199, bookingRef: 'BOOK-REF', confirmationText: 'CONFIRMATION-MAIL', notes: 'NOTE-L' }],
  days: [
    {
      id: 'd1', date: '2026-12-01', dayNumber: 1, visited: true, notes: 'NOTE-DAY',
      places: [
        { id: 'p0', name: 'Austin', category: 'city', location: loc },
        {
          id: 'p1', name: 'Museum', category: 'museum', location: loc, cost: 25, phone: 'PHONE-1', notes: 'NOTE-A', website: 'https://x',
          travel: { mode: 'flight', distance: 100, cost: 321, fuelCost: 11, tollCost: 2, bookingRef: 'PNR-123', confirmationText: 'CONFIRMATION-MAIL', flightNumber: 'AA1999', carrier: 'American' },
        },
      ],
    },
  ],
}

describe('toPublicTrip', () => {
  it('drops everything private', () => {
    const json = JSON.stringify(toPublicTrip(trip))
    for (const secret of ['trip123', 'd1', '"p0"', '"p1"', 'AA1999', 'SECRET-TOKEN', 'BOOK-REF', 'PNR-123', 'CONFIRMATION-MAIL', 'NOTE-', 'PHONE-1', 'Honda', '1 Main St', 'nominatim_1', '/api/immich', '321', '199', 'DESC']) {
      expect(json).not.toContain(secret)
    }
  })
  it('keeps the itinerary', () => {
    const p = toPublicTrip(trip)
    expect(p.days[0].places[1]).toMatchObject({ name: 'Museum', category: 'museum', travel: { mode: 'flight', distance: 100, carrier: 'American' } })
    expect(p.days[0].places[0].location).toMatchObject({ name: 'Hotel X', city: 'Austin' })
    expect(p.lodgings?.[0]).toMatchObject({ name: 'Hotel X', checkIn: '2026-12-01' })
  })
})
