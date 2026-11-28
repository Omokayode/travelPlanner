import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/db'
import { handler, parseBody } from '@/lib/http'
import { recomputeVisitedCities } from '@/lib/server/store'
import { poiCacheSummary } from '@/lib/server/poiCache'
import { MAP_STYLE_IDS } from '@/lib/mapStyles'
import { TOLL_PASSES } from '@/lib/domain/google'

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
    /** Ollama model for planning; null = server default */
    aiModel: z.string().trim().max(120).regex(/^[\w.:/-]*$/).nullable().optional(),
    /** Google keys: only written when typed in ('' leaves the saved one alone) */
    googleServerKey: z.string().trim().max(200).regex(/^[\w-]*$/, 'not a Google API key').optional(),
    clearGoogleServerKey: z.boolean().optional(),
    googleMapsKey: z.string().trim().max(200).regex(/^[\w-]*$/, 'not a Google API key').optional(),
    clearGoogleMapsKey: z.boolean().optional(),
    mapStyle: z.enum(MAP_STYLE_IDS).nullable().optional(),
    tollPass: z
      .string()
      .refine((v) => v === '' || TOLL_PASSES.some((t) => t.id === v), 'unknown toll pass')
      .nullable()
      .optional(),
  })
  .strip()

type Stored = Awaited<ReturnType<typeof load>>

async function load() {
  return prisma.appSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })
}

/** What the browser sees: everything except the key itself. */
async function publicView(s: Stored) {
  const { immichApiKey, googleServerKey, googleMapsKey, ...rest } = s
  const serverSet = Boolean(googleServerKey || process.env.GOOGLE_SERVER_KEY)
  const mapsSet = Boolean(googleMapsKey || process.env.GOOGLE_MAPS_KEY)
  return {
    ...rest,
    googleServerKeySet: serverSet,
    googleMapsKeySet: mapsSet,
    googleMapsReady: serverSet && mapsSet,
    poiCache: await poiCacheSummary().catch(() => null),
    immichKeySet: Boolean(immichApiKey),
    immichFromEnv: Boolean(process.env.IMMICH_URL && process.env.IMMICH_API_KEY),
    immichUrlFromEnv: Boolean(process.env.IMMICH_URL),
    immichConfigured: Boolean((process.env.IMMICH_URL || s.immichUrl) && (process.env.IMMICH_API_KEY || immichApiKey)),
  }
}

export const GET = handler(async () => NextResponse.json(await publicView(await load())))

export const PUT = handler(async (req: NextRequest) => {
  const { immichApiKey, clearImmichApiKey, googleServerKey, clearGoogleServerKey, googleMapsKey, clearGoogleMapsKey, ...rest } = await parseBody(req, settingsInput)
  const data: Prisma.AppSettingsUpdateInput = { ...rest }
  if (googleServerKey) data.googleServerKey = googleServerKey
  if (clearGoogleServerKey) data.googleServerKey = null
  if (googleMapsKey) data.googleMapsKey = googleMapsKey
  if (clearGoogleMapsKey) data.googleMapsKey = null
  if (data.tollPass === '') data.tollPass = null
  if (immichApiKey) data.immichApiKey = immichApiKey
  if (clearImmichApiKey) data.immichApiKey = null
  if (data.immichUrl === '') data.immichUrl = null
  if (data.homeCity === '') data.homeCity = null
  if (data.aiModel === '') data.aiModel = null
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
  return NextResponse.json(await publicView(saved))
})
