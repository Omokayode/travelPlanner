// GET /api/map — everything the world map needs in one go: every trip's legs (route lines,
// thinned out), places you have been (with how often), lodgings and stops, and totals.
// "Been" counts only days marked as visited.
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler } from '@/lib/http'
import { isoDate } from '@/lib/server/store'

export const dynamic = 'force-dynamic'

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16']
const MAX_POINTS_PER_LEG = 200

function thin(coords: [number, number][]): [number, number][] {
  if (coords.length <= MAX_POINTS_PER_LEG) return coords
  const step = Math.ceil(coords.length / MAX_POINTS_PER_LEG)
  const out = coords.filter((_, i) => i % step === 0)
  out.push(coords[coords.length - 1])
  return out.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5])
}

interface MapPlace {
  name: string
  state?: string
  country?: string
  lat: number
  lng: number
  visits: number
  trips: { id: string; name: string }[]
}

export const GET = handler(async () => {
  const trips = await prisma.trip.findMany({
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      startDate: true,
      endDate: true,
      lodgings: { select: { id: true, name: true, placeCity: true, placeLat: true, placeLng: true, checkIn: true } },
      days: {
        orderBy: { dayNumber: 'asc' },
        select: {
          id: true,
          dayNumber: true,
          visited: true,
          segments: {
            orderBy: { position: 'asc' },
            select: {
              id: true, mode: true, distance: true, routeCoords: true,
              fromName: true, fromCity: true, fromState: true, fromCountry: true, fromLat: true, fromLng: true,
              toName: true, toCity: true, toState: true, toCountry: true, toLat: true, toLng: true,
              stops: { select: { id: true, name: true, type: true, placeCity: true, placeState: true, placeCountry: true, placeLat: true, placeLng: true, visited: true } },
            },
          },
        },
      },
    },
  })

  const places = new Map<string, MapPlace>()
  const states = new Set<string>()
  const countries = new Set<string>()
  let milesBeen = 0
  const been = (trip: { id: string; name: string }, name: string | null, state: string | null, country: string | null, lat: number, lng: number) => {
    if (!name) return
    const key = `${name}|${state || ''}`.toLowerCase()
    const p = places.get(key) ?? { name, state: state || undefined, country: country || undefined, lat, lng, visits: 0, trips: [] }
    p.visits += 1
    if (!p.trips.some((t) => t.id === trip.id)) p.trips.push({ id: trip.id, name: trip.name })
    places.set(key, p)
    if (state) states.add(state)
    if (country) countries.add(country)
  }

  const out = trips.map((t, i) => {
    let miles = 0
    const legs = t.days.flatMap((d) =>
      d.segments.map((s) => {
        miles += s.distance || 0
        if (d.visited) {
          milesBeen += s.distance || 0
          been(t, s.fromCity || s.fromName, s.fromState, s.fromCountry, s.fromLat, s.fromLng)
          been(t, s.toCity || s.toName, s.toState, s.toCountry, s.toLat, s.toLng)
        }
        const route = Array.isArray(s.routeCoords) && s.routeCoords.length > 1 ? (s.routeCoords as [number, number][]) : null
        return {
          id: s.id,
          dayId: d.id,
          dayNumber: d.dayNumber,
          mode: s.mode,
          label: `${s.fromCity || s.fromName} → ${s.toCity || s.toName}`,
          coords: route ? thin(route) : ([[s.fromLat, s.fromLng], [s.toLat, s.toLng]] as [number, number][]),
        }
      }),
    )
    const stops = t.days.flatMap((d) =>
      d.segments.flatMap((s) =>
        s.stops.map((st) => {
          if (d.visited && st.visited) been(t, st.placeCity || st.name, st.placeState, st.placeCountry, st.placeLat, st.placeLng)
          return { id: st.id, dayId: d.id, name: st.name, type: st.type, lat: st.placeLat, lng: st.placeLng }
        }),
      ),
    )
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      startDate: isoDate(t.startDate),
      endDate: isoDate(t.endDate),
      color: PALETTE[i % PALETTE.length],
      miles: Math.round(miles),
      daysVisited: t.days.filter((d) => d.visited).length,
      days: t.days.length,
      legs,
      stops,
      lodgings: t.lodgings.map((l) => ({ id: l.id, name: l.name, city: l.placeCity, lat: l.placeLat, lng: l.placeLng, checkIn: isoDate(l.checkIn) })),
    }
  })

  return NextResponse.json({
    trips: out,
    places: Array.from(places.values()).sort((a, b) => b.visits - a.visits),
    totals: {
      trips: trips.length,
      miles: Math.round(milesBeen),
      places: places.size,
      states: states.size,
      countries: countries.size,
    },
  })
})
