// components/TripCard.tsx — dashboard card: cover photo (from Immich) with status, then the numbers.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Car, Plane, Train, Layers, MapPin, Calendar, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { confirmDialog } from '@/components/ui/Confirm'
import { Trip, TripStats } from '@/lib/types'
import { daysInclusive, toLocalDate } from '@/lib/domain/dates'
import type { TripStatus } from '@/lib/domain/trip'

/** Stable small number from the trip id, to pick a background. */
function idHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

const TYPE_CONFIG = {
  road_trip: { icon: Car, label: 'Road trip' },
  flight: { icon: Plane, label: 'Flight' },
  train: { icon: Train, label: 'Train' },
  mixed: { icon: Layers, label: 'Mixed' },
}

const GRADIENTS = [
  'from-emerald-600 to-teal-800',
  'from-sky-600 to-indigo-800',
  'from-amber-500 to-rose-700',
  'from-violet-600 to-fuchsia-800',
  'from-cyan-600 to-blue-800',
]

function StatusBadge({ status }: { status: TripStatus }) {
  if (status.kind === 'ongoing')
    return (
      <span className="badge bg-emerald-500 text-white shadow">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> On the road · day {status.day} of {status.of}
      </span>
    )
  if (status.kind === 'upcoming')
    return (
      <span className="badge bg-sky-500 text-white shadow">
        {status.inDays === 0 ? 'Starts today' : status.inDays === 1 ? 'Tomorrow' : `In ${status.inDays} days`}
      </span>
    )
  return <span className="badge bg-black/50 text-white backdrop-blur">Done</span>
}

interface TripCardProps {
  trip: Trip
  stats: TripStats
  status: TripStatus
  /** try to pick a cover photo from Immich when the trip has none yet */
  autoCover?: boolean
  onDelete: (id: string) => void
}

export default function TripCard({ trip, stats, status, autoCover, onDelete }: TripCardProps) {
  const config = TYPE_CONFIG[trip.type]
  const TypeIcon = config.icon
  const duration = daysInclusive(trip.startDate, trip.endDate)
  const progress = stats.totalDays > 0 ? (stats.daysCompleted / stats.totalDays) * 100 : 0
  const [cover, setCover] = useState(trip.coverPhotoUrl)
  const [imgFailed, setImgFailed] = useState(false)

  // null/undefined = never looked; "" = looked, Immich had nothing
  useEffect(() => {
    if (!autoCover || (cover !== null && cover !== undefined)) return
    let alive = true
    fetch(`/api/trips/${trip.id}/cover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"auto":true}' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && d.coverPhotoUrl !== null && setCover(d.coverPhotoUrl))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [autoCover, cover, trip.id])

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = await confirmDialog({
      title: `Delete “${trip.name}”?`,
      message: 'All its days, legs, lodging, packing list and expenses are deleted too. This cannot be undone.',
      confirmLabel: 'Delete trip',
      danger: true,
    })
    if (ok) onDelete(trip.id)
  }

  const showPhoto = !!cover && !imgFailed

  return (
    <Link href={`/trips/${trip.id}`} className="block group rounded-2xl">
      <article
        className="relative bg-card border border-line rounded-2xl overflow-hidden h-full
        hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
      >
        {/* Cover */}
        <div className={clsx('relative aspect-[16/9] bg-gradient-to-br', GRADIENTS[idHash(trip.id) % GRADIENTS.length])}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- streamed through our Immich proxy
            <img
              src={cover!}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <TypeIcon aria-hidden className="absolute right-4 bottom-3 w-16 h-16 text-white/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <StatusBadge status={status} />
          </div>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${trip.name}`}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/40 text-white/80 hover:text-white hover:bg-red-600
              opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="absolute left-4 right-4 bottom-3 text-white">
            <div className="flex items-center gap-1.5 text-xs text-white/80">
              <TypeIcon className="w-3.5 h-3.5" /> {config.label}
            </div>
            <h3 className="font-display text-2xl font-bold leading-tight drop-shadow">{trip.name}</h3>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(toLocalDate(trip.startDate), 'MMM d')} – {format(toLocalDate(trip.endDate), 'MMM d, yyyy')}
            </span>
            <span>
              {duration} day{duration === 1 ? '' : 's'}
            </span>
          </div>
          {trip.description && <p className="text-xs text-ink-3 line-clamp-1 -mt-1">{trip.description}</p>}

          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Miles" value={stats.totalMiles > 0 ? stats.totalMiles.toLocaleString() : '–'} />
            <StatBox label="Cities" value={stats.citiesCount > 0 ? String(stats.citiesCount) : '–'} />
            <StatBox label="Cost" value={stats.totalCost > 0 ? `$${Math.round(stats.totalCost).toLocaleString()}` : '–'} />
          </div>

          {stats.totalDays > 0 && status.kind !== 'upcoming' && (
            <div>
              <div className="flex justify-between text-xs text-ink-3 mb-1">
                <span>Days done</span>
                <span>
                  {stats.daysCompleted}/{stats.totalDays}
                </span>
              </div>
              <div className="h-1.5 bg-ink/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {trip.visitedCities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trip.visitedCities.slice(0, 3).map((city) => (
                <span key={city} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-ink/5 text-[11px] text-ink-2">
                  <MapPin className="w-2.5 h-2.5" />
                  {city}
                </span>
              ))}
              {trip.visitedCities.length > 3 && (
                <span className="px-1.5 py-0.5 rounded bg-ink/5 text-[11px] text-ink-3">+{trip.visitedCities.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink/[0.04] rounded-lg px-2 py-1.5 text-center">
      <div className="text-sm font-semibold text-ink">{value}</div>
      <div className="text-[10px] text-ink-3 uppercase tracking-wide">{label}</div>
    </div>
  )
}

/** Same shape as a card, for loading. */
export function TripCardSkeleton() {
  return (
    <div className="bg-card border border-line rounded-2xl overflow-hidden">
      <div className="aspect-[16/9] skeleton rounded-none" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-3 w-1/2" />
        <div className="grid grid-cols-3 gap-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
        <div className="skeleton h-1.5" />
      </div>
    </div>
  )
}
