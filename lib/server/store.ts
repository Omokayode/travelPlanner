// lib/server/store.ts — the only place that knows how trips are stored.
//
// The browser works with the nested shapes in lib/types.ts (Trip → days → segments → stops).
// Since Phase 2 they are stored as rows (Day, Segment, Stop, Activity, Lodging); this file turns
// rows into those shapes and back. Dates come out as "YYYY-MM-DD", money as plain numbers, and
// empty optional fields are left out (as they were in the old JSON).
import { Prisma } from '@prisma/client'
import type { Activity, Day, Expense, GeoLocation, Lodging, Segment, Stop } from '@/lib/types'
import type { ActivityInput, DayInput, LodgingInput, PlaceInput, SegmentInput, StopInput } from '@/lib/schemas'

type Tx = Prisma.TransactionClient

// ── reading ──────────────────────────────────────────────────────────────────────────────────

const byPosition = { orderBy: { position: 'asc' } } as const

export const dayInclude = {
  segments: { ...byPosition, include: { stops: byPosition } },
  activities: byPosition,
} satisfies Prisma.DayInclude

export const tripInclude = {
  days: { orderBy: { dayNumber: 'asc' }, include: dayInclude },
  lodgings: { orderBy: [{ checkIn: 'asc' }, { name: 'asc' }] },
} satisfies Prisma.TripInclude

type DayRow = Prisma.DayGetPayload<{ include: typeof dayInclude }>
type SegmentRow = DayRow['segments'][number]
type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>
type LodgingRow = TripRow['lodgings'][number]
type ActivityRow = DayRow['activities'][number]
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

function placeCols<P extends string>(p: P, l: PlaceInput): PlaceCols<P> {
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

function toStop(s: SegmentRow['stops'][number]): Stop {
  return compact({
    id: s.id,
    location: readPlace(s, 'place'),
    type: s.type as Stop['type'],
    name: s.name,
    description: s.description,
    rating: s.rating,
    duration: s.duration,
    notes: s.notes,
    visited: s.visited,
    isAutoSuggested: s.isAutoSuggested,
    osmId: s.osmId,
  }) as Stop
}

function toSegment(s: SegmentRow): Segment {
  return compact({
    id: s.id,
    from: readPlace(s, 'from'),
    to: readPlace(s, 'to'),
    mode: s.mode,
    distance: s.distance,
    duration: s.duration,
    cost: num(s.cost),
    fuelCost: num(s.fuelCost),
    fuelGallons: s.fuelGallons,
    tollCost: num(s.tollCost),
    bookingRef: s.bookingRef,
    confirmationText: s.confirmationText,
    stops: s.stops.map(toStop),
    routeCoords: (s.routeCoords as [number, number][] | null) ?? undefined,
    departureTime: s.departureTime,
    arrivalTime: s.arrivalTime,
    carrier: s.carrier,
    flightNumber: s.flightNumber,
    notes: s.notes,
  }) as Segment
}

function toActivity(a: ActivityRow): Activity {
  return compact({
    id: a.id,
    name: a.name,
    type: a.type as Activity['type'],
    location: a.placeLat !== null && a.placeLng !== null ? readPlace(a as PlaceCols<'place'>, 'place') : undefined,
    time: a.time,
    duration: a.duration,
    cost: num(a.cost),
    notes: a.notes,
    website: a.website,
    phone: a.phone,
    rating: a.rating,
    visited: a.visited,
    isHighlight: a.isHighlight || undefined,
  }) as Activity
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
    segments: d.segments.map(toSegment),
    activities: d.activities.map(toActivity),
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

function segmentData(dayId: string, s: SegmentInput, position: number): Prisma.SegmentCreateManyInput {
  return {
    id: s.id,
    dayId,
    position,
    mode: s.mode,
    ...placeCols('from', s.from),
    ...placeCols('to', s.to),
    distance: s.distance ?? null,
    duration: s.duration ?? null,
    cost: money(s.cost),
    fuelCost: money(s.fuelCost),
    fuelGallons: s.fuelGallons ?? null,
    tollCost: money(s.tollCost),
    bookingRef: s.bookingRef ?? null,
    confirmationText: s.confirmationText ?? null,
    departureTime: s.departureTime ?? null,
    arrivalTime: s.arrivalTime ?? null,
    carrier: s.carrier ?? null,
    flightNumber: s.flightNumber ?? null,
    notes: s.notes ?? null,
    routeCoords: s.routeCoords ?? Prisma.DbNull,
  }
}

function stopData(segmentId: string, s: StopInput, position: number): Prisma.StopCreateManyInput {
  return {
    id: s.id,
    segmentId,
    position,
    type: s.type,
    name: s.name,
    description: s.description ?? null,
    rating: s.rating ?? null,
    duration: s.duration ?? null,
    notes: s.notes ?? null,
    visited: s.visited ?? false,
    isAutoSuggested: s.isAutoSuggested ?? false,
    osmId: s.osmId ?? null,
    ...placeCols('place', s.location),
  }
}

function activityData(dayId: string, a: ActivityInput, position: number): Prisma.ActivityCreateManyInput {
  return {
    id: a.id,
    dayId,
    position,
    name: a.name,
    type: a.type,
    time: a.time ?? null,
    duration: a.duration ?? null,
    cost: money(a.cost),
    notes: a.notes ?? null,
    website: a.website ?? null,
    phone: a.phone ?? null,
    rating: a.rating ?? null,
    visited: a.visited ?? false,
    isHighlight: a.isHighlight ?? false,
    ...(a.location ? placeCols('place', a.location) : {}),
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

/** Replace a day's legs, stops and activities with the given ones (inside a transaction). */
export async function replaceDayContent(tx: Tx, dayId: string, d: DayInput) {
  await tx.segment.deleteMany({ where: { dayId } }) // stops go with them (cascade)
  await tx.activity.deleteMany({ where: { dayId } })
  const segments = d.segments ?? []
  if (segments.length) await tx.segment.createMany({ data: segments.map((s, i) => segmentData(dayId, s, i)) })
  const stops = segments.flatMap((s) => (s.stops ?? []).map((st, i) => stopData(s.id, st, i)))
  if (stops.length) await tx.stop.createMany({ data: stops })
  const activities = d.activities ?? []
  if (activities.length) await tx.activity.createMany({ data: activities.map((a, i) => activityData(dayId, a, i)) })
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

/** Cities on visited days (start/end city, every leg end and stop), for the trip card. */
export async function recomputeVisitedCities(tx: Tx, tripId: string) {
  const days = await tx.day.findMany({
    where: { tripId, visited: true },
    orderBy: { dayNumber: 'asc' },
    include: dayInclude,
  })
  const cities = new Set<string>()
  const add = (v: string | null | undefined) => {
    if (v?.trim()) cities.add(v.trim())
  }
  for (const d of days) {
    add(d.startCity)
    add(d.endCity)
    for (const s of d.segments) {
      add(s.fromCity || s.fromState || s.fromName)
      add(s.toCity || s.toState || s.toName)
      for (const st of s.stops) add(st.placeCity || st.placeState || st.placeName)
    }
  }
  await tx.trip.update({ where: { id: tripId }, data: { visitedCities: Array.from(cities) } })
}
