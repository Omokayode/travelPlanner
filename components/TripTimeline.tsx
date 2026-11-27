'use client'

// The whole trip as one vertical timeline: each day, its legs (with an icon per way of
// travelling), the stops on each leg, and where you sleep that night. Each day links to its page.
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { BedDouble, Bus, Car, CheckCircle2, Footprints, MapPin, Plane, Ship, Train } from 'lucide-react'
import clsx from 'clsx'
import type { Trip, TransportMode } from '@/lib/types'
import { STOP_TYPE_ICONS } from '@/lib/types'
import { lodgingForDate } from '@/lib/domain/trip'

export const MODE_ICON: Record<TransportMode, typeof Car> = {
  drive: Car,
  flight: Plane,
  train: Train,
  bus: Bus,
  ferry: Ship,
  walk: Footprints,
}

const place = (p: { city?: string; name: string }) => p.city || p.name

function legDetail(miles?: number, minutes?: number) {
  const parts: string[] = []
  if (miles) parts.push(`${Math.round(miles).toLocaleString()} mi`)
  if (minutes) parts.push(minutes >= 60 ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m` : `${Math.round(minutes)}m`)
  return parts.join(' · ')
}

export default function TripTimeline({ trip, linkBase }: { trip: Trip; linkBase?: string | null }) {
  const days = [...(trip.days || [])].sort((a, b) => a.dayNumber - b.dayNumber)
  if (!days.length) return null
  // linkBase null = no links (shared read-only view)
  const base = linkBase === undefined ? `/trips/${trip.id}/day/` : linkBase

  return (
    <ol className="relative">
      {days.map((day, i) => {
        const lodging = lodgingForDate(trip.lodgings, day.date)
        const last = i === days.length - 1
        const title =
          day.title ||
          [day.startCity, day.endCity].filter(Boolean).join(' → ') ||
          (day.segments[0] ? `${place(day.segments[0].from)} → ${place(day.segments[day.segments.length - 1].to)}` : 'Free day')
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
            {/* rail */}
            {!last && <span aria-hidden className="absolute left-[19px] top-10 bottom-0 w-px bg-emerald-500/25" />}
            {/* node */}
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
              <Link href={`${base}${day.id}`} className="block group rounded-lg -mx-2 px-2 py-1 hover:bg-ink/[0.03]">
                {heading}
              </Link>
            ) : (
              <div className="py-1">{heading}</div>
            )}

            {(day.segments.length > 0 || lodging) && (
              <ul className="mt-2 space-y-2">
                {day.segments.map((seg) => {
                  const Icon = MODE_ICON[seg.mode] || Car
                  const detail = legDetail(seg.distance, seg.duration)
                  return (
                    <li key={seg.id} className="text-sm">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-6 h-6 rounded-md bg-ink/5 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-ink-2" aria-label={seg.mode} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-ink-2">
                            {place(seg.from)} <span className="text-ink-4">→</span> {place(seg.to)}
                            {seg.flightNumber && <span className="text-ink-3"> · {seg.flightNumber}</span>}
                          </div>
                          {detail && <div className="text-xs text-ink-3">{detail}</div>}
                          {seg.stops.length > 0 && (
                            <ul className="mt-1 flex flex-wrap gap-1">
                              {seg.stops.map((s) => (
                                <li key={s.id} className="text-xs px-1.5 py-0.5 rounded bg-ink/5 text-ink-2">
                                  <span aria-hidden>{STOP_TYPE_ICONS[s.type] || '📍'} </span>
                                  {s.name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
                {lodging && (
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                      <BedDouble className="w-3.5 h-3.5 text-info" aria-label="lodging" />
                    </span>
                    <span className="text-ink-2 truncate">
                      {lodging.name}
                      {lodging.location.city && <span className="text-ink-3"> · {lodging.location.city}</span>}
                    </span>
                  </li>
                )}
              </ul>
            )}
            {day.segments.length === 0 && !lodging && day.notes && (
              <p className="mt-1 text-xs text-ink-3 line-clamp-2 flex gap-1">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                {day.notes}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
