// Trip cover photo (from Immich).
//   POST {"assetId": "<uuid>"}  use that photo
//   POST {"auto": true}         pick one: a favourite taken during the trip, else one from the
//                               first third of the trip; remembers "none found" as "" so the
//                               dashboard doesn't ask again
//   DELETE                      forget the cover (the dashboard picks again next time)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { handler, notFound, parseBody } from '@/lib/http'
import { getImmichConfig, immichFetch, UUID_RE } from '@/lib/immich'
import { addDays } from '@/lib/domain/dates'
import { isoDate } from '@/lib/server/store'

type Ctx = { params: { id: string } }

const body = z.union([z.object({ assetId: z.string().regex(UUID_RE) }), z.object({ auto: z.literal(true) })])

interface Search {
  assets?: { items?: { id: string; isTrashed?: boolean }[] }
}

const coverUrl = (assetId: string) => `/api/immich/assets/${assetId}/thumbnail`

/** Asset id, null = Immich has no photo from those dates, undefined = Immich not set up. */
async function findCover(start: string, end: string): Promise<string | null | undefined> {
  const cfg = await getImmichConfig()
  if (!cfg) return undefined
  const search = async (extra: Record<string, unknown>, size: number) => {
    const res = await immichFetch(cfg, '/search/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        takenAfter: `${start}T00:00:00.000Z`,
        takenBefore: `${addDays(end, 1)}T12:00:00.000Z`, // local evening of the last day, roughly
        type: 'IMAGE',
        order: 'asc',
        size,
        ...extra,
      }),
    })
    return (((await res.json()) as Search).assets?.items || []).filter((a) => !a.isTrashed)
  }
  const favourites = await search({ isFavorite: true }, 1)
  if (favourites[0]) return favourites[0].id
  const any = await search({}, 60)
  return any.length ? any[Math.floor(any.length / 3)].id : null
}

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const input = await parseBody(req, body)
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, select: { startDate: true, endDate: true } })
  if (!trip) throw notFound()

  let url: string
  if ('assetId' in input) url = coverUrl(input.assetId)
  else {
    try {
      const id = await findCover(isoDate(trip.startDate), isoDate(trip.endDate))
      if (id === undefined) return NextResponse.json({ coverPhotoUrl: null }) // ask again once Immich is set up
      url = id ? coverUrl(id) : ''
    } catch (err) {
      console.error('Cover search failed', err)
      return NextResponse.json({ coverPhotoUrl: null }) // try again another time
    }
  }
  await prisma.trip.update({ where: { id: params.id }, data: { coverPhotoUrl: url } })
  return NextResponse.json({ coverPhotoUrl: url })
})

export const DELETE = handler(async (_: NextRequest, { params }: Ctx) => {
  await prisma.trip.update({ where: { id: params.id }, data: { coverPhotoUrl: null } })
  return NextResponse.json({ coverPhotoUrl: null })
})
