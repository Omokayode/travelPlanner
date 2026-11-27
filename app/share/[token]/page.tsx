// /share/<token> — read-only view of a shared trip, no login needed (see middleware.ts).
// Only what lib/domain/share.ts allows is sent to the browser.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Compass, Route, CalendarDays, BedDouble } from 'lucide-react'
import prisma from '@/lib/db'
import { toTrip, tripInclude } from '@/lib/server/store'
import { toPublicTrip } from '@/lib/domain/share'
import { daysInclusive } from '@/lib/domain/dates'
import type { Trip } from '@/lib/types'
import PlacesMap from '@/components/itinerary/PlacesMapLazy'
import { dayColor } from '@/lib/dayColors'
import TripTimeline from '@/components/TripTimeline'

export const dynamic = 'force-dynamic'

const TOKEN = /^[A-Za-z0-9_-]{43}$/

async function load(token: string) {
  if (!TOKEN.test(token)) return null
  const row = await prisma.trip.findUnique({ where: { shareToken: token }, include: tripInclude })
  return row ? toPublicTrip(toTrip(row) as unknown as Trip) : null
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const trip = await load(params.token)
  return { title: trip ? `${trip.name} — shared trip` : 'Trip not found', robots: { index: false, follow: false } }
}

export default async function SharedTripPage({ params }: { params: { token: string } }) {
  const trip = await load(params.token)
  if (!trip) notFound()

  const mapDays = trip.days.map((d) => ({ dayNumber: d.dayNumber, color: dayColor(d.dayNumber), places: d.places }))
  const miles = Math.round(trip.days.flatMap((d) => d.places).reduce((n, p) => n + (p.travel?.distance || 0), 0))
  const days = daysInclusive(trip.startDate, trip.endDate)

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-page/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-ink">Shared trip</span>
          <span className="ml-auto text-xs text-ink-3">read-only</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink">{trip.name}</h1>
          {trip.description && <p className="text-ink-2 mt-1">{trip.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-ink-3">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {format(parseISO(trip.startDate), 'MMM d')} – {format(parseISO(trip.endDate), 'MMM d, yyyy')} · {days} day{days === 1 ? '' : 's'}
            </span>
            {miles > 0 && (
              <span className="flex items-center gap-1.5">
                <Route className="w-4 h-4" />
                {miles.toLocaleString()} miles
              </span>
            )}
          </div>
        </div>

        {mapDays.some((d) => d.places.length) && (
          <div className="tp-card p-0 overflow-hidden h-[clamp(260px,50vh,460px)]">
            <PlacesMap days={mapDays} lodgings={trip.lodgings} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 tp-card" aria-labelledby="itinerary">
            <h2 id="itinerary" className="font-display text-xl font-semibold text-ink mb-4">Itinerary</h2>
            <TripTimeline trip={trip as Trip} linkBase={null} />
          </section>

          {(trip.lodgings?.length ?? 0) > 0 && (
            <section className="tp-card h-fit" aria-labelledby="stays">
              <h2 id="stays" className="font-display text-xl font-semibold text-ink mb-3">Where we stay</h2>
              <ul className="space-y-3">
                {trip.lodgings!.map((l) => (
                  <li key={l.id} className="flex gap-2.5 text-sm">
                    <BedDouble className="w-4 h-4 text-info mt-0.5 shrink-0" />
                    <div>
                      <div className="text-ink">{l.name}</div>
                      <div className="text-xs text-ink-3">
                        {[l.location.city, l.location.state].filter(Boolean).join(', ')} · {format(parseISO(l.checkIn), 'MMM d')} – {format(parseISO(l.checkOut), 'MMM d')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <p className="text-center text-xs text-ink-4 pb-6">Shared from Trip by JKBLabs. Costs, bookings and notes are not shown.</p>
      </main>
    </div>
  )
}
