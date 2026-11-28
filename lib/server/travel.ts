// lib/server/travel.ts — how you get from one place to the next, worked out on save.
//
// For each place after the first: if its travel is automatic (drive/walk, or a flight/train
// without typed numbers) and the hop changed since it was last worked out (travelKey), it is
// routed again: drives via OSRM (straight line × 1.25 at 50 mph if OSRM is down), walks at
// 3 mph, flights/trains/buses/ferries as the crow flies at a typical speed. Drives get fuel and
// toll prices from the trip's vehicle and the saved gas prices (tolls from Google's Routes API
// when a server key is set, else a per-mile estimate). Typed-in travel (auto:false, e.g. a
// looked-up flight) is kept as it is.
import type { Coordinates, TransportMode, Travel, Vehicle } from '@/lib/types'
import type { PlaceInput } from '@/lib/schemas'
import { drivingRoute } from '@/lib/osm'
import { haversineMiles } from '@/lib/domain/geo'
import { driveCosts, fuelPrice, type GasPrices } from '@/lib/domain/fuel'
import { googleKeys, routeTolls, type GoogleKeys } from '@/lib/server/google'

/** drives shorter than this skip the toll lookup (city hops rarely have tolls) */
const TOLL_LOOKUP_MILES = 10

/** "lat,lng>lat,lng" with 5 decimals — the 1.7.0 migration builds the same string. */
export const hopKey = (a: Coordinates, b: Coordinates) =>
  `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`

/** Keep at most ~800 points of a route line (plenty to draw it; full OSRM geometry can be 20k+). */
export function thinRoute(coords: [number, number][], max = 800): [number, number][] {
  if (coords.length <= max) return coords
  const step = coords.length / (max - 1)
  const out: [number, number][] = []
  for (let i = 0; i < max - 1; i++) out.push(coords[Math.floor(i * step)])
  out.push(coords[coords.length - 1])
  return out.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5])
}

const MPH: Record<TransportMode, number> = { drive: 50, walk: 3, flight: 450, train: 55, bus: 45, ferry: 20 }
const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p

export interface TravelContext {
  vehicle?: Vehicle | null
  gas?: GasPrices | null
  /** hop key and mode currently stored per place id (from the database) */
  stored: Map<string, { key: string | null; mode: TransportMode | null }>
  /** Google keys (looked up once per save when not given) */
  google?: GoogleKeys | null
}

export interface PlannedPlace extends PlaceInput {
  travelKey: string | null
}

async function route(mode: TransportMode, a: Coordinates, b: Coordinates): Promise<Pick<Travel, 'distance' | 'duration' | 'routeCoords'>> {
  const crow = haversineMiles(a, b)
  if (mode === 'drive') {
    try {
      const r = await drivingRoute([a, b])
      if (r) return { distance: round(r.distanceMiles), duration: Math.round(r.durationMinutes), routeCoords: thinRoute(r.coords) }
    } catch (err) {
      console.error('Routing failed, using a straight-line estimate', err instanceof Error ? err.message : err)
    }
    const miles = crow * 1.25
    return { distance: round(miles), duration: Math.round((miles / MPH.drive) * 60), routeCoords: undefined }
  }
  const miles = mode === 'walk' ? crow * 1.2 : crow
  const extra = mode === 'flight' ? 45 : 0 // taxi, climb, descent
  return { distance: round(miles), duration: Math.round((miles / MPH[mode]) * 60 + extra), routeCoords: undefined }
}

/** Fuel and toll estimate for a drive — only when it has none yet (past trips keep their prices). */
function withDriveCosts(t: Travel, ctx: TravelContext, knownToll?: number | null): Travel {
  if (t.mode !== 'drive' || !t.distance || t.fuelCost != null) return t
  const c = driveCosts(t.distance, ctx.vehicle, fuelPrice(ctx.vehicle?.fuelType, ctx.gas), knownToll)
  return { ...t, fuelCost: c.fuelCost, fuelGallons: c.fuelGallons, tollCost: c.tollCost, tollSource: knownToll != null ? 'google' : 'estimate', cost: c.cost }
}

/** Run fn over items, at most `limit` at a time, keeping order. */
async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Fill in travel for a day's places (in order). Network calls happen here, outside any transaction. */
export async function planTravel(places: PlaceInput[], ctx: TravelContext): Promise<PlannedPlace[]> {
  const google = ctx.google !== undefined ? ctx.google : await googleKeys().catch(() => null)
  return pool(places, 4, async (p, i): Promise<PlannedPlace> => {
    if (i === 0) return { ...p, travel: undefined, travelKey: null }
    const prev = places[i - 1].location.coords
    const key = hopKey(prev, p.location.coords)
    const given: Travel = p.travel ?? { mode: 'drive', auto: true }

    if (given.auto === false) {
      // typed in: keep, only fill a missing distance
      const t = given.distance == null ? { ...given, distance: round(haversineMiles(prev, p.location.coords)) } : given
      return { ...p, travel: t, travelKey: key }
    }
    const was = ctx.stored.get(p.id)
    if (was && was.key === key && was.mode === given.mode && given.distance != null) {
      // same hop as before: keep its numbers (and the prices it was costed at)
      return { ...p, travel: withDriveCosts(given, ctx), travelKey: key }
    }
    // new or changed hop: route it and price it fresh
    const t: Travel = {
      ...given,
      ...(await route(given.mode, prev, p.location.coords)),
      auto: true,
      fuelCost: undefined,
      fuelGallons: undefined,
      tollCost: undefined,
      tollSource: undefined,
      cost: given.mode === 'drive' || given.mode === 'walk' ? undefined : given.cost,
    }
    const toll =
      t.mode === 'drive' && (t.distance ?? 0) >= TOLL_LOOKUP_MILES && google?.serverKey ? await routeTolls(prev, p.location.coords, google) : null
    return { ...p, travel: withDriveCosts(t, ctx, toll), travelKey: key }
  })
}
