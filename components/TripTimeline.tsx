'use client'

// The whole trip as one vertical timeline: each day and its places in order, how you get from
// one to the next, and where you sleep that night. Used on the read-only share page.
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { BedDouble, Bus, Car, CheckCircle2, Footprints, Plane, Ship, Train } from 'lucide-react'
import clsx from 'clsx'
import type { Trip, TransportMode } from '@/lib/types'
import { PLACE_ICONS } from '@/lib/types'
import { lodgingForDate } from '@/lib/domain/trip'
import { formatMinutes } from '@/lib/format'

export const MODE_ICON: Record<TransportMode, typeof Car> = {
  drive: Car,
  flight: Plane,
  train: Train,
  bus: Bus,
  ferry: Ship,
  walk: Footprints,
}

export default function TripTimeline({ trip, linkBase }: { trip: Trip; linkBase?: string | null }) {
  const days = [...(trip.days || [])].sort((a, b) => a.dayNumber - b.dayNumber)
  if (!days.length) return null
  // linkBase null = no links (shared read-only view)
  const base = linkBase === undefined ? `/trips/${trip.id}#day-` : linkBase

  return (
    <ol className="relative">
      {days.map((day, i) => {
        const lodging = lodgingForDate(trip.lodgings, day.date)
        const last = i === days.length - 1
        const first = day.places[0]
        const final = day.places[day.places.length - 1]
        const title = day.title || (first && final && first !== final ? `${first.name} → ${final.name}` : first?.name) || 'Free day'
        const heading = (
          <>
            <div className="text-xs text-ink-3">
              Day {day.dayNumber} · {format(parseISO(day.date), 'EEE, MMM d')}
            </div>
            <div className="font-medium text-ink group-hover:text-accent transition-colors">{title}</div>
          </>
        )
        return (
          <li key={day.id} className="relative pl-12 pb-6">
            {!last && <span aria-hidden className="absolute left-[19px] top-10 bottom-0 w-px bg-emerald-500/25" />}
            <span
              aria-hidden
              className={clsx(
                'absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border',
                day.visited ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-card text-accent border-emerald-500/40',
              )}
            >
              {day.visited ? <CheckCircle2 className="w-5 h-5" /> : day.dayNumber}
            </span>

            {base ? (
              <Link href={`${base}${day.dayNumber}`} className="block group rounded-lg -mx-2 px-2 py-1 hover:bg-ink/[0.03]">
                {heading}
              </Link>
            ) : (
              <div className="py-1">{heading}</div>
            )}

            {(day.places.length > 0 || lodging) && (
              <ol className="mt-2 space-y-1.5">
                {day.places.map((p, n) => {
                  const Icon = p.travel ? MODE_ICON[p.travel.mode] || Car : null
                  return (
                    <li key={p.id} className="text-sm">
                      {Icon && p.travel && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-3 pl-1 mb-1">
                          <Icon className="w-3 h-3" aria-label={p.travel.mode} />
                          {[p.travel.distance ? `${Math.round(p.travel.distance)} mi` : '', formatMinutes(p.travel.duration), p.travel.carrier]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center shrink-0 text-[11px] font-semibold text-ink-2">
                          {n + 1}
                        </span>
                        <span aria-hidden>{PLACE_ICONS[p.category] || '📍'}</span>
                        <span className="text-ink-2 truncate">
                          {p.name}
                          {p.location.city && p.location.city !== p.name && <span className="text-ink-3"> · {p.location.city}</span>}
                        </span>
                        {p.arriveTime && <span className="ml-auto text-xs text-ink-3 tabular-nums">{p.arriveTime}</span>}
                      </div>
                    </li>
                  )
                })}
                {lodging && (
                  <li className="flex items-center gap-2 text-sm pt-1">
                    <span className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                      <BedDouble className="w-3.5 h-3.5 text-info" aria-label="lodging" />
                    </span>
                    <span className="text-ink-2 truncate">
                      {lodging.name}
                      {lodging.location.city && <span className="text-ink-3"> · {lodging.location.city}</span>}
                    </span>
                  </li>
                )}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
}
