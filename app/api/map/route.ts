// GET /api/map — everything the world map needs in one go: every trip's routes (thinned out),
// cities you have been (days spent there; never the home city), lodgings and other places, and
// totals. "Been" counts only days marked as visited.
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handler } from '@/lib/http'
import { toTrip, tripInclude } from '@/lib/server/store'
import { cityLabel, cityName } from '@/lib/domain/cities'

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
  /** days spent there */
  visits: number
  trips: { id: string; name: string }[]
  days: Set<string>
}

export const GET = handler(async () => {
  const [trips, settings] = await Promise.all([
    prisma.trip.findMany({ orderBy: { startDate: 'asc' }, include: tripInclude }),
    prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { homeCity: true } }),
  ])
  const home = settings?.homeCity?.toLowerCase()

  const places = new Map<string, MapPlace>()
  const states = new Set<string>()
  const countries = new Set<string>()
  let milesBeen = 0

  const out = trips.map(toTrip).map((t, i) => {
    let miles = 0
    const legs: { id: string; dayId: string; dayNumber: number; mode: string; label: string; coords: [number, number][] }[] = []
    const stops: { id: string; dayId: string; name: string; type: string; lat: number; lng: number }[] = []
    for (const d of t.days) {
      d.places.forEach((p, j) => {
        const prev = d.places[j - 1]
        const c = p.location.coords
        if (prev && p.travel) {
          miles += p.travel.distance || 0
          if (d.visited) milesBeen += p.travel.distance || 0
          const route = p.travel.routeCoords && p.travel.routeCoords.length > 1 ? p.travel.routeCoords : null
          legs.push({
            id: p.id,
            dayId: d.id,
            dayNumber: d.dayNumber,
            mode: p.travel.mode,
            label: `${prev.name} → ${p.name}`,
            coords: route ? thin(route) : [[prev.location.coords.lat, prev.location.coords.lng], [c.lat, c.lng]],
          })
        }
        if (p.category !== 'city' && p.category !== 'airport' && p.category !== 'station') {
          stops.push({ id: p.id, dayId: d.id, name: p.name, type: p.category, lat: c.lat, lng: c.lng })
        }
        if (!d.visited) return
        if (p.location.state) states.add(p.location.state)
        if (p.location.country) countries.add(p.location.country)
        const label = cityLabel(p)
        if (!label || label.toLowerCase() === home) return
        const key = label.toLowerCase()
        const entry = places.get(key) ?? { name: cityName(label), state: p.location.state, country: p.location.country, lat: c.lat, lng: c.lng, visits: 0, trips: [] as { id: string; name: string }[], days: new Set<string>() }
        // one visit per day in that city
        if (!entry.days.has(d.id)) {
          entry.days.add(d.id)
          entry.visits += 1
        }
        if (!entry.trips.some((x) => x.id === t.id)) entry.trips.push({ id: t.id, name: t.name })
        places.set(key, entry)
      })
    }
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      startDate: t.startDate,
      endDate: t.endDate,
      color: PALETTE[i % PALETTE.length],
      miles: Math.round(miles),
      daysVisited: t.days.filter((d) => d.visited).length,
      days: t.days.length,
      legs,
      stops,
      lodgings: t.lodgings.map((l) => ({ id: l.id, name: l.name, city: l.location.city ?? null, lat: l.location.coords.lat, lng: l.location.coords.lng, checkIn: l.checkIn })),
    }
  })

  return NextResponse.json({
    trips: out,
    places: Array.from(places.values())
      .map(({ days: _d, ...p }) => p)
      .sort((a, b) => b.visits - a.visits),
    totals: {
      trips: trips.length,
      miles: Math.round(milesBeen),
      places: places.size,
      states: states.size,
      countries: countries.size,
    },
  })
})
