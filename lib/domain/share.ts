// lib/domain/share.ts — what a read-only share link may show.
// Allow-list: only these fields are copied; anything added to the types later stays private
// until it is added here on purpose. No costs, booking references, confirmation emails, notes,
// phone numbers, vehicle, budget, packing or expenses.
import type { Activity, Day, GeoLocation, Lodging, Segment, Stop, Trip } from '@/lib/types'

const place = (p: GeoLocation): GeoLocation => ({
  id: '',
  name: p.name,
  city: p.city,
  state: p.state,
  country: p.country,
  coords: p.coords,
})

const stop = (prefix: string) => (s: Stop, i: number): Stop => ({ id: `${prefix}-stop${i}`, name: s.name, type: s.type, location: place(s.location), visited: s.visited })

// ids are replaced by positions: real ids are not needed on the shared page
const segment = (dayNo: number) => (s: Segment, i: number): Segment => ({
  id: `day${dayNo}-leg${i}`,
  mode: s.mode,
  from: place(s.from),
  to: place(s.to),
  distance: s.distance,
  duration: s.duration,
  routeCoords: s.routeCoords,
  carrier: s.carrier,
  stops: s.stops.map(stop(`day${dayNo}-leg${i}`)),
})

const activity = (dayNo: number) => (a: Activity, i: number): Activity => ({
  id: `day${dayNo}-act${i}`,
  name: a.name,
  type: a.type,
  location: a.location ? place(a.location) : undefined,
  time: a.time,
  visited: a.visited,
})

const day = (d: Day): Day => ({
  id: `day${d.dayNumber}`,
  date: d.date,
  dayNumber: d.dayNumber,
  title: d.title,
  startCity: d.startCity,
  endCity: d.endCity,
  visited: d.visited,
  segments: d.segments.map(segment(d.dayNumber)),
  activities: d.activities.map(activity(d.dayNumber)),
})

const lodging = (l: Lodging, i: number): Lodging => ({
  id: `stay${i}`,
  name: l.name,
  location: place(l.location),
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
