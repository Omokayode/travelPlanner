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

export const placeSchema = z.object({
  id: optText(300),
  name: text(500),
  address: optText(1000),
  city: optText(200),
  state: optText(200),
  country: optText(200),
  coords: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
})

export const stopSchema = z.object({
  id: idSchema,
  location: placeSchema,
  type: text(40),
  name: text(500),
  description: optText(5000),
  rating: optNum(0, 10),
  duration: optNum(0, 100_000).transform((v) => (v === undefined ? v : Math.round(v))),
  notes: optText(5000),
  visited: z.boolean().optional(),
  isAutoSuggested: z.boolean().optional(),
  osmId: optText(100),
})

export const segmentSchema = z.object({
  id: idSchema,
  from: placeSchema,
  to: placeSchema,
  mode: z.enum(TRANSPORT_MODES),
  distance: optNum(0, 100_000),
  duration: optNum(0, 1_000_000),
  cost: optMoney,
  fuelCost: optMoney,
  fuelGallons: optNum(0, 100_000),
  tollCost: optMoney,
  bookingRef: optText(200),
  confirmationText: optText(20_000),
  stops: z.array(stopSchema).max(200).default([]),
  routeCoords: z
    .array(z.tuple([z.number().finite(), z.number().finite()]))
    .max(100_000)
    .nullish()
    .transform((v) => v ?? undefined),
  departureTime: localDateTime,
  arrivalTime: localDateTime,
  carrier: optText(200),
  flightNumber: optText(40),
  notes: optText(10_000),
})

export const activitySchema = z.object({
  id: idSchema,
  name: text(500),
  type: text(40),
  location: placeSchema.nullish().transform((v) => v ?? undefined),
  time: optText(40),
  duration: optNum(0, 100_000).transform((v) => (v === undefined ? v : Math.round(v))),
  cost: optMoney,
  notes: optText(10_000),
  website: optText(2000),
  phone: optText(100),
  rating: optNum(0, 10),
  visited: z.boolean().optional(),
  isHighlight: z.boolean().optional(),
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
  segments: z.array(segmentSchema).max(100).default([]),
  activities: z.array(activitySchema).max(200).default([]),
})

export const lodgingSchema = z
  .object({
    id: idSchema,
    name: text(500).trim().min(1),
    location: placeSchema,
    checkIn: dateSchema,
    checkOut: dateSchema,
    confirmationText: optText(20_000),
    notes: optText(10_000),
    cost: optMoney,
    bookingRef: optText(200),
  })
  .refine((l) => l.checkOut >= l.checkIn, 'checkOut must be on or after checkIn')

export type PlaceInput = z.infer<typeof placeSchema>
export type StopInput = z.infer<typeof stopSchema>
export type SegmentInput = z.infer<typeof segmentSchema>
export type ActivityInput = z.infer<typeof activitySchema>
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
