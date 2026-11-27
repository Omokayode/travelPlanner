// lib/domain/share.ts — what a read-only share link may show.
// Allow-list: only these fields are copied; anything added to the types later stays private
// until it is added here on purpose. No costs, booking references, confirmation emails, notes,
// flight numbers, phone numbers, vehicle, budget, packing or expenses.
import type { Day, GeoLocation, Lodging, Place, Travel, Trip } from '@/lib/types'

const loc = (p: GeoLocation): GeoLocation => ({
  id: '',
  name: p.name,
  city: p.city,
  state: p.state,
  country: p.country,
  coords: p.coords,
})

// ids are replaced by positions: real ids are not needed on the shared page
const travel = (t: Travel | undefined): Travel | undefined =>
  t && { mode: t.mode, distance: t.distance, duration: t.duration, routeCoords: t.routeCoords, carrier: t.carrier }

const place = (dayNo: number) => (p: Place, i: number): Place => ({
  id: `day${dayNo}-place${i}`,
  name: p.name,
  category: p.category,
  location: loc(p.location),
  travel: travel(p.travel),
  arriveTime: p.arriveTime,
})

const day = (d: Day): Day => ({
  id: `day${d.dayNumber}`,
  date: d.date,
  dayNumber: d.dayNumber,
  title: d.title,
  visited: d.visited,
  places: d.places.map(place(d.dayNumber)),
})

const lodging = (l: Lodging, i: number): Lodging => ({
  id: `stay${i}`,
  name: l.name,
  location: loc(l.location),
  checkIn: l.checkIn,
  checkOut: l.checkOut,
})

export type PublicTrip = Pick<Trip, 'id' | 'name' | 'description' | 'startDate' | 'endDate' | 'type' | 'days' | 'lodgings' | 'visitedCities' | 'coverPhotoUrl'>

export function toPublicTrip(t: Trip): PublicTrip {
  return {
    id: 'shared', // the real id is not needed (and not useful) on the shared page
    name: t.name,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    type: t.type,
    visitedCities: t.visitedCities,
    coverPhotoUrl: undefined, // photos stay behind the login
    days: t.days.map(day),
    lodgings: (t.lodgings || []).map(lodging),
  }
}
