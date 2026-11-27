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
      activities: [{ id: 'a', name: 'Museum', type: 'attraction', visited: false, cost: 25, phone: 'PHONE-1', notes: 'NOTE-A', website: 'https://x' }],
      segments: [{
        id: 's', mode: 'flight', from: loc, to: loc, distance: 100, cost: 321, fuelCost: 11, tollCost: 2,
        bookingRef: 'PNR-123', confirmationText: 'CONFIRMATION-MAIL', notes: 'NOTE-S', flightNumber: 'AA1',
        stops: [{ id: 'st', name: 'Stop', type: 'food', visited: true, location: loc, notes: 'NOTE-ST', description: 'DESC' }],
      }],
    },
  ],
}

describe('toPublicTrip', () => {
  it('drops everything private', () => {
    const json = JSON.stringify(toPublicTrip(trip))
    for (const secret of ['trip123', 'd1', '"s"', '"st"', 'SECRET-TOKEN', 'BOOK-REF', 'PNR-123', 'CONFIRMATION-MAIL', 'NOTE-', 'PHONE-1', 'Honda', '1 Main St', 'nominatim_1', '/api/immich', '321', '199', 'DESC']) {
      expect(json).not.toContain(secret)
    }
  })
  it('keeps the itinerary', () => {
    const p = toPublicTrip(trip)
    expect(p.days[0].segments[0]).toMatchObject({ mode: 'flight', distance: 100, from: { name: 'Hotel X', city: 'Austin' } })
    expect(p.days[0].segments[0].stops[0].name).toBe('Stop')
    expect(p.lodgings?.[0]).toMatchObject({ name: 'Hotel X', checkIn: '2026-12-01' })
  })
})
