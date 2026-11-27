// lib/schemas.ts — request validation for the API routes (zod).
// Day contents are still a nested JSON blob (see roadmap Phase 2), so those are checked for
// shape and size here and kept as-is ("passthrough"); top-level fields are checked strictly.
import { z } from 'zod'

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'must be 1-80 letters, digits, _ or -')
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
const looseDate = z.string().max(40)
const text = (max: number) => z.string().max(max)
const jsonObject = z.record(z.unknown())
const money = z.number().finite().min(-1_000_000).max(10_000_000)

export const daySchema = z
  .object({
    id: idSchema.optional(),
    date: dateSchema,
    dayNumber: z.number().int().min(0).max(1000),
  })
  .passthrough()

const tripFields = {
  name: text(200).trim().min(1),
  description: text(5000).nullish(),
  startDate: dateSchema,
  endDate: dateSchema,
  type: text(40),
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
    lodgings: z.array(jsonObject).max(500).optional(),
  })
  .partial()

export const budgetSchema = z.array(jsonObject).max(500)

const receipt = z
  .string()
  .max(5_000_000)
  .refine((v) => v.startsWith('data:image/') || v.startsWith('data:application/pdf'), 'must be an image or PDF')
  .nullish()

export const expenseSchema = z.object({
  dayId: idSchema.nullish(),
  name: text(200).trim().min(1),
  amount: money,
  category: text(40),
  date: looseDate,
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
