import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/db'
import { handler, parseBody } from '@/lib/http'
import { recomputeVisitedCities } from '@/lib/server/store'

export const dynamic = 'force-dynamic' // never pre-render or cache at build time

const vehicle = z.object({
  make: z.string().max(80),
  model: z.string().max(80).optional().default(''),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  fuelEfficiency: z.number().positive().max(500),
  fuelType: z.enum(['regular', 'premium', 'diesel', 'electric']),
  tankSize: z.number().positive().max(500).optional().nullable(),
})

const price = z.number().nonnegative().max(50).nullable().optional()

// Every field optional: the page sends only what changed (or the whole object, minus the key).
const settingsInput = z
  .object({
    immichUrl: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === '' || /^https?:\/\/[^\s]+$/.test(v), 'must be an http(s) URL')
      .nullable()
      .optional(),
    // Only written when a new key is typed in; '' leaves the saved key alone.
    immichApiKey: z.string().trim().max(200).optional(),
    clearImmichApiKey: z.boolean().optional(),
    immichAlbumId: z.string().trim().max(64).nullable().optional(),
    gasPriceRegular: price,
    gasPricePremium: price,
    gasPriceDiesel: price,
    savedVehicles: z.array(vehicle).max(50).optional(),
    /** "City, State" you travel from — not counted as a city visited */
    homeCity: z.string().trim().max(200).nullable().optional(),
  })
  .strip()

type Stored = Awaited<ReturnType<typeof load>>

async function load() {
  return prisma.appSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })
}

/** What the browser sees: everything except the key itself. */
function publicView(s: Stored) {
  const { immichApiKey, ...rest } = s
  return {
    ...rest,
    immichKeySet: Boolean(immichApiKey),
    immichFromEnv: Boolean(process.env.IMMICH_URL && process.env.IMMICH_API_KEY),
    immichUrlFromEnv: Boolean(process.env.IMMICH_URL),
    immichConfigured: Boolean((process.env.IMMICH_URL || s.immichUrl) && (process.env.IMMICH_API_KEY || immichApiKey)),
  }
}

export const GET = handler(async () => NextResponse.json(publicView(await load())))

export const PUT = handler(async (req: NextRequest) => {
  const { immichApiKey, clearImmichApiKey, ...rest } = await parseBody(req, settingsInput)
  const data: Prisma.AppSettingsUpdateInput = { ...rest }
  if (immichApiKey) data.immichApiKey = immichApiKey
  if (clearImmichApiKey) data.immichApiKey = null
  if (data.immichUrl === '') data.immichUrl = null
  if (data.homeCity === '') data.homeCity = null
  const saved = await prisma.$transaction(async (tx) => {
    const before = await tx.appSettings.findUnique({ where: { id: 'singleton' }, select: { homeCity: true } })
    const s = await tx.appSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...(data as Omit<Prisma.AppSettingsCreateInput, 'id'>) },
      update: data,
    })
    // a different home city changes what counts as visited on every trip
    if ((before?.homeCity ?? null) !== s.homeCity) {
      const trips = await tx.trip.findMany({ select: { id: true } })
      for (const t of trips) await recomputeVisitedCities(tx, t.id)
    }
    return s
  })
  return NextResponse.json(publicView(saved))
})
