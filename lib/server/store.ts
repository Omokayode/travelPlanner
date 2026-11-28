// lib/server/store.ts — the only place that knows how trips are stored.
//
// The browser works with the nested shapes in lib/types.ts (Trip → days → places).
// They are stored as rows (Day, Place, Lodging…); this file turns
// rows into those shapes and back. Dates come out as "YYYY-MM-DD", money as plain numbers, and
// empty optional fields are left out (as they were in the old JSON).
import { Prisma } from '@prisma/client'
import type { Day, Expense, GeoLocation, Lodging, Place, PlaceCategory, Travel } from '@/lib/types'
import type { DayInput, LocationInput, LodgingInput } from '@/lib/schemas'
import type { PlannedPlace } from './travel'
import { visitedCities } from '@/lib/domain/cities'

type Tx = Prisma.TransactionClient

// ── reading ──────────────────────────────────────────────────────────────────────────────────

const byPosition = { orderBy: { position: 'asc' } } as const

export const dayInclude = {
  places: byPosition,
} satisfies Prisma.DayInclude

export const tripInclude = {
  days: { orderBy: { dayNumber: 'asc' }, include: dayInclude },
  lodgings: { orderBy: [{ checkIn: 'asc' }, { name: 'asc' }] },
} satisfies Prisma.TripInclude

type DayRow = Prisma.DayGetPayload<{ include: typeof dayInclude }>
type PlaceRow = DayRow['places'][number]
type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>
type LodgingRow = TripRow['lodgings'][number]
type ExpenseRow = Prisma.ExpenseGetPayload<object>

/** DATE column (midnight UTC) → "YYYY-MM-DD". */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10)
/** "YYYY-MM-DD" → value for a DATE column. */
export const dbDate = (s: string) => new Date(`${s}T00:00:00Z`)
const num = (v: Prisma.Decimal | null) => (v === null ? undefined : v.toNumber())

/** Drop keys whose value is null or undefined (shallow). */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T
}

type PlaceKey = 'Name' | 'Address' | 'City' | 'State' | 'Country' | 'Lat' | 'Lng' | 'Id'
type PlaceCols<P extends string> = {
  [K in PlaceKey as `${P}${K}`]: K extends 'Lat' | 'Lng' ? number : K extends 'Name' ? string : string | null
}

function readPlace<P extends string>(row: PlaceCols<P>, p: P): GeoLocation {
  const r = row as unknown as Record<string, string | number | null>
  return compact({
    id: (r[`${p}Id`] as string | null) ?? '',
    name: r[`${p}Name`] as string,
    address: r[`${p}Address`] as string | null,
    city: r[`${p}City`] as string | null,
    state: r[`${p}State`] as string | null,
    country: r[`${p}Country`] as string | null,
    coords: { lat: r[`${p}Lat`] as number, lng: r[`${p}Lng`] as number },
  }) as GeoLocation
}

function placeCols<P extends string>(p: P, l: LocationInput): PlaceCols<P> {
  return {
    [`${p}Name`]: l.name,
    [`${p}Address`]: l.address ?? null,
    [`${p}City`]: l.city ?? null,
    [`${p}State`]: l.state ?? null,
    [`${p}Country`]: l.country ?? null,
    [`${p}Lat`]: l.coords.lat,
    [`${p}Lng`]: l.coords.lng,
    [`${p}Id`]: l.id || null,
  } as PlaceCols<P>
}

function toTravel(r: PlaceRow): Travel | undefined {
  if (!r.travelMode) return undefined
  return compact({
    mode: r.travelMode,
    auto: r.travelAuto,
    distance: r.travelMiles,
    duration: r.travelMinutes,
    routeCoords: (r.travelRoute as [number, number][] | null) ?? undefined,
    fuelCost: num(r.fuelCost),
    fuelGallons: r.fuelGallons,
    tollCost: num(r.tollCost),
    tollSource: r.tollSource,
    cost: num(r.travelCost),
    carrier: r.carrier,
    flightNumber: r.flightNumber,
    bookingRef: r.bookingRef,
    confirmationText: r.confirmationText,
    departureTime: r.departureTime,
    arrivalTime: r.arrivalTime,
  }) as Travel
}

export function toPlace(r: PlaceRow): Place {
  return compact({
    id: r.id,
    name: r.name,
    category: r.category as PlaceCategory,
    location: readPlace(r, 'place'),
    travel: toTravel(r),
    arriveTime: r.arriveTime,
    stayMinutes: r.stayMinutes,
    notes: r.notes,
    cost: num(r.cost),
    website: r.website,
    phone: r.phone,
    visited: r.visited || undefined,
    osmId: r.osmId,
  }) as Place
}

export function toDay(d: DayRow): Day {
  return compact({
    id: d.id,
    date: isoDate(d.date),
    dayNumber: d.dayNumber,
    title: d.title,
    notes: d.notes,
    startCity: d.startCity,
    endCity: d.endCity,
    visited: d.visited,
    places: d.places.map(toPlace),
  }) as Day
}

export function toLodging(l: LodgingRow): Lodging {
  return compact({
    id: l.id,
    name: l.name,
    location: readPlace(l, 'place'),
    checkIn: isoDate(l.checkIn),
    checkOut: isoDate(l.checkOut),
    confirmationText: l.confirmationText,
    notes: l.notes,
    cost: num(l.cost),
    bookingRef: l.bookingRef,
  }) as Lodging
}

/** A trip as the browser expects it. */
export function toTrip(t: TripRow) {
  const { days, lodgings, startDate, endDate, totalBudget, ...rest } = t
  return {
    ...rest,
    startDate: isoDate(startDate),
    endDate: isoDate(endDate),
    totalBudget: num(totalBudget) ?? null,
    days: days.map(toDay),
    lodgings: lodgings.map(toLodging),
  }
}

/** URL the browser loads a stored receipt from (same origin, behind the login). */
export const receiptUrl = (tripId: string, expenseId: string) => `/api/trips/${tripId}/expenses/${expenseId}/receipt`

export function toExpense(e: ExpenseRow): Expense {
  return {
    id: e.id,
    tripId: e.tripId,
    dayId: e.dayId ?? undefined,
    name: e.name,
    amount: e.amount.toNumber(),
    category: e.category as Expense['category'],
    date: isoDate(e.date),
    notes: e.notes ?? undefined,
    receipt: e.receiptFile || e.receipt ? receiptUrl(e.tripId, e.id) : null,
    paymentMethod: e.paymentMethod,
  }
}

// ── writing ──────────────────────────────────────────────────────────────────────────────────

const money = (v: number | null | undefined) => (v === null || v === undefined ? null : new Prisma.Decimal(v.toFixed(2)))

function placeData(dayId: string, p: PlannedPlace, position: number): Prisma.PlaceCreateManyInput {
  const t = p.travel
  return {
    id: p.id,
    dayId,
    position,
    name: p.name,
    category: p.category,
    arriveTime: p.arriveTime ?? null,
    stayMinutes: p.stayMinutes ?? null,
    notes: p.notes ?? null,
    cost: money(p.cost),
    website: p.website ?? null,
    phone: p.phone ?? null,
    visited: p.visited ?? false,
    osmId: p.osmId ?? null,
    ...placeCols('place', p.location),
    travelMode: t?.mode ?? null,
    travelAuto: t?.auto ?? true,
    travelKey: t ? p.travelKey : null,
    travelMiles: t?.distance ?? null,
    travelMinutes: t?.duration ?? null,
    travelRoute: t?.routeCoords ?? Prisma.DbNull,
    fuelCost: money(t?.fuelCost),
    fuelGallons: t?.fuelGallons ?? null,
    tollCost: money(t?.tollCost),
    tollSource: t?.tollCost != null ? (t.tollSource ?? null) : null,
    travelCost: money(t?.cost),
    carrier: t?.carrier ?? null,
    flightNumber: t?.flightNumber ?? null,
    bookingRef: t?.bookingRef ?? null,
    confirmationText: t?.confirmationText ?? null,
    departureTime: t?.departureTime ?? null,
    arrivalTime: t?.arrivalTime ?? null,
  }
}

/** Day fields that live on the Day row itself. */
export function dayFields(d: DayInput) {
  return {
    date: dbDate(d.date),
    dayNumber: d.dayNumber,
    title: d.title || null,
    notes: d.notes || null,
    startCity: d.startCity || null,
    endCity: d.endCity || null,
    visited: d.visited ?? false,
  }
}

/** Replace a day's places (inside a transaction); travel already worked out by planTravel(). */
export async function replaceDayPlaces(tx: Tx, dayId: string, places: PlannedPlace[]) {
  await tx.place.deleteMany({ where: { dayId } })
  if (places.length) await tx.place.createMany({ data: places.map((p, i) => placeData(dayId, p, i)) })
}

/** Replace all of a trip's lodgings (inside a transaction). */
export async function replaceLodgings(tx: Tx, tripId: string, lodgings: LodgingInput[]) {
  await tx.lodging.deleteMany({ where: { tripId } })
  if (!lodgings.length) return
  await tx.lodging.createMany({
    data: lodgings.map((l) => ({
      id: l.id,
      tripId,
      name: l.name,
      checkIn: dbDate(l.checkIn),
      checkOut: dbDate(l.checkOut),
      confirmationText: l.confirmationText ?? null,
      notes: l.notes ?? null,
      cost: money(l.cost),
      bookingRef: l.bookingRef ?? null,
      ...placeCols('place', l.location),
    })),
  })
}

/** Unique "City, State" of visited days, without the home city (lib/domain/cities.ts). */
export async function recomputeVisitedCities(tx: Tx, tripId: string) {
  const [days, settings] = await Promise.all([
    tx.day.findMany({ where: { tripId }, include: dayInclude }),
    tx.appSettings.findUnique({ where: { id: 'singleton' }, select: { homeCity: true } }),
  ])
  const cities = visitedCities(days.map(toDay), settings?.homeCity)
  await tx.trip.update({ where: { id: tripId }, data: { visitedCities: cities } })
}
