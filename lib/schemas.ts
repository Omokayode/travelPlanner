// lib/schemas.ts — request validation for the API routes (zod).
// Unknown keys are dropped (zod's default "strip"), so only known fields are ever stored.
import { z } from 'zod'

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'must be 1-80 letters, digits, _ or -')
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
const text = (max: number) => z.string().max(max)
const optText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => v ?? undefined)
const optNum = (min: number, max: number) =>
  z
    .number()
    .finite()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? undefined)
const jsonObject = z.record(z.unknown())
const money = z.number().finite().min(-1_000_000).max(10_000_000)
const optMoney = money.nullish().transform((v) => v ?? undefined)
/** Local wall-clock date-time as typed, e.g. "2025-11-22T13:08" (no time zone). */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$|^\d{2}:\d{2}$|^$/, 'must be YYYY-MM-DDTHH:mm')
  .nullish()
  .transform((v) => v || undefined)

export const TRIP_TYPES = ['road_trip', 'flight', 'train', 'mixed'] as const
export const TRANSPORT_MODES = ['drive', 'flight', 'train', 'bus', 'ferry', 'walk'] as const

/** A location: name + coordinates (+ address parts). */
export const locationSchema = z.object({
  id: optText(300),
  name: text(500),
  address: optText(1000),
  city: optText(200),
  state: optText(200),
  country: optText(200),
  coords: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
})

export const PLACE_CATEGORIES = [
  'city', 'lodging', 'airport', 'station', 'food', 'coffee', 'attraction', 'museum', 'historical', 'park',
  'national_park', 'scenic', 'viewpoint', 'shopping', 'nightlife', 'gas_station', 'bucees', 'rest_area',
  'state_line', 'love_lock', 'other',
] as const

export const travelSchema = z.object({
  mode: z.enum(TRANSPORT_MODES),
  auto: z.boolean().optional(),
  distance: optNum(0, 100_000),
  duration: optNum(0, 1_000_000),
  routeCoords: z
    .array(z.tuple([z.number().finite(), z.number().finite()]))
    .max(100_000)
    .nullish()
    .transform((v) => v ?? undefined),
  fuelCost: optMoney,
  fuelGallons: optNum(0, 100_000),
  tollCost: optMoney,
  cost: optMoney,
  carrier: optText(200),
  flightNumber: optText(40),
  bookingRef: optText(200),
  confirmationText: optText(20_000),
  departureTime: localDateTime,
  arrivalTime: localDateTime,
})

/** A place on a day; `travel` = how you get there from the previous place. */
export const placeSchema = z.object({
  id: idSchema,
  name: text(500).trim().min(1),
  // unknown categories (older clients) become "other"
  category: z.string().max(40).transform((c) => ((PLACE_CATEGORIES as readonly string[]).includes(c) ? c : 'other') as (typeof PLACE_CATEGORIES)[number]),
  location: locationSchema,
  travel: travelSchema.nullish().transform((v) => v ?? undefined),
  arriveTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, 'must be HH:mm')
    .nullish()
    .transform((v) => v || undefined),
  stayMinutes: optNum(0, 100_000).transform((v) => (v === undefined ? v : Math.round(v))),
  notes: optText(10_000),
  cost: optMoney,
  website: optText(2000),
  phone: optText(100),
  visited: z.boolean().optional(),
  osmId: optText(100),
})

export const daySchema = z.object({
  id: idSchema.optional(),
  date: dateSchema,
  dayNumber: z.number().int().min(1).max(1000),
  title: optText(300),
  notes: optText(50_000),
  startCity: optText(200),
  endCity: optText(200),
  visited: z.boolean().optional(),
  places: z.array(placeSchema).max(200).default([]),
})

export const lodgingSchema = z
  .object({
    id: idSchema,
    name: text(500).trim().min(1),
    location: locationSchema,
    checkIn: dateSchema,
    checkOut: dateSchema,
    confirmationText: optText(20_000),
    notes: optText(10_000),
    cost: optMoney,
    bookingRef: optText(200),
  })
  .refine((l) => l.checkOut >= l.checkIn, 'checkOut must be on or after checkIn')

export type LocationInput = z.infer<typeof locationSchema>
export type TravelInput = z.infer<typeof travelSchema>
export type PlaceInput = z.infer<typeof placeSchema>
export type DayInput = z.infer<typeof daySchema>
export type LodgingInput = z.infer<typeof lodgingSchema>

const tripFields = {
  name: text(200).trim().min(1),
  description: text(5000).nullish(),
  startDate: dateSchema,
  endDate: dateSchema,
  type: z.enum(TRIP_TYPES),
  visitedCities: z.array(text(200)).max(2000).optional(),
  coverPhotoUrl: text(2000).nullish(),
  totalBudget: money.nonnegative().nullish(),
  tags: z.array(text(60)).max(50).optional(),
  isActive: z.boolean().optional(),
  vehicle: jsonObject.nullish(),
  homeCoords: jsonObject.nullish(),
}

export const tripCreateSchema = z.object({
  id: idSchema,
  ...tripFields,
  days: z.array(daySchema.extend({ id: idSchema })).max(400).optional(),
})

export const tripUpdateSchema = z
  .object({
    ...tripFields,
    lodgings: z.array(lodgingSchema).max(500).optional(),
  })
  .partial()

export const budgetSchema = z.array(jsonObject).max(500)

/**
 * Receipt on an expense: a new upload (data: URL of an image or PDF), the URL the API gave out
 * for the stored one (= keep it), or null (= remove it).
 */
export const RECEIPT_DATA_URL = /^data:(image\/(png|jpeg|gif|webp|heic|heif)|application\/pdf);base64,/
const receipt = z
  .string()
  .max(5_000_000)
  .refine((v) => RECEIPT_DATA_URL.test(v) || /^\/api\/trips\/[A-Za-z0-9_-]+\/expenses\/[A-Za-z0-9_-]+\/receipt$/.test(v), 'must be an image or PDF')
  .nullish()

export const expenseSchema = z.object({
  dayId: idSchema.nullish(),
  name: text(200).trim().min(1),
  amount: money,
  category: text(40),
  date: dateSchema,
  notes: text(5000).nullish(),
  receipt,
  paymentMethod: text(60).nullish(),
})

export const packingItemSchema = z.object({
  name: text(200).trim().min(1),
  category: text(40),
  packed: z.boolean().optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  notes: text(2000).nullish(),
  essential: z.boolean().optional(),
})

export const packingListSchema = z.array(packingItemSchema).max(500)

// ── trip planner (new-trip page) ─────────────────────────────────────────────
const planCity = z.object({
  name: text(120).trim().min(1),
  state: optText(80),
  country: optText(80),
  coords: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
})

export const outlineSchema = z.object({
  name: text(120).trim().min(1),
  start: planCity,
  stays: z.array(z.object({ city: planCity, nights: z.number().int().min(1).max(30) })).min(1).max(20),
  returnHome: z.boolean(),
  startDate: dateSchema.optional(),
  interests: z.array(z.enum(['sights', 'museums', 'history', 'food', 'coffee', 'nature', 'shopping', 'nightlife'])).max(8),
  pace: z.enum(['relaxed', 'normal', 'packed']),
  mode: z.enum(['drive', 'flight', 'train']),
})
