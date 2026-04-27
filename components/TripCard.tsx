// components/TripCard.tsx
'use client'

import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { Car, Plane, Train, Layers, MapPin, Calendar, Trash2, MoreHorizontal, DollarSign } from 'lucide-react'
import { Trip, TripStats } from '@/lib/types'
import clsx from 'clsx'

const TYPE_CONFIG = {
  road_trip: { icon: Car, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Road Trip' },
  flight: { icon: Plane, color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'Flight' },
  train: { icon: Train, color: 'text-green-400', bg: 'bg-green-500/15', label: 'Train' },
  mixed: { icon: Layers, color: 'text-purple-400', bg: 'bg-purple-500/15', label: 'Mixed' },
}

const TRIP_BACKGROUNDS = [
  'from-emerald-500/20 to-orange-500/10',
  'from-blue-500/20 to-cyan-500/10',
  'from-green-500/20 to-teal-500/10',
  'from-purple-500/20 to-pink-500/10',
  'from-rose-500/20 to-red-500/10',
]

interface TripCardProps {
  trip: Trip
  stats: TripStats
  onDelete: (id: string) => void
}

export default function TripCard({ trip, stats, onDelete }: TripCardProps) {
  const config = TYPE_CONFIG[trip.type]
  const TypeIcon = config.icon
  const bgGradient = TRIP_BACKGROUNDS[Math.abs(trip.id.charCodeAt(5) || 0) % TRIP_BACKGROUNDS.length]
  const duration = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1
  const progress = stats.totalDays > 0 ? (stats.daysCompleted / stats.totalDays) * 100 : 0

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
      onDelete(trip.id)
    }
  }

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <div className="relative bg-[#1a2235] border border-[#1e293b] rounded-2xl overflow-hidden
        hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1
        hover:shadow-xl hover:shadow-black/40">

        {/* Top gradient band */}
        <div className={clsx('h-1.5 w-full bg-gradient-to-r', bgGradient)} />

        {/* Card header */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
              <TypeIcon className="w-3.5 h-3.5" />
              {config.label}
            </div>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#475569]
                hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <h3 className="font-display text-2xl font-bold text-[#f1f5f9] leading-snug mb-1 group-hover:text-emerald-400 transition-colors">
            {trip.name}
          </h3>
          {trip.description && (
            <p className="text-xs text-[#64748b] line-clamp-2 mb-3">{trip.description}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-[#64748b] mb-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d, yyyy')}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#1e293b]" />
            <span>{duration} days</span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatBox label="Miles" value={stats.totalMiles > 0 ? stats.totalMiles.toLocaleString() : '–'} />
            <StatBox label="Cities" value={stats.citiesCount > 0 ? String(stats.citiesCount) : '–'} />
            <StatBox label="Cost" value={stats.totalCost > 0 ? `$${stats.totalCost.toLocaleString()}` : '–'} />
          </div>

          {/* Progress bar */}
          {stats.totalDays > 0 && (
            <div>
              <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
                <span>Progress</span>
                <span>{stats.daysCompleted}/{stats.totalDays} days</span>
              </div>
              <div className="h-1.5 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cities visited */}
        {trip.visitedCities.length > 0 && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap gap-1">
              {trip.visitedCities.slice(0, 4).map(city => (
                <span key={city} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#111827] text-[10px] text-[#64748b]">
                  <MapPin className="w-2.5 h-2.5" />
                  {city}
                </span>
              ))}
              {trip.visitedCities.length > 4 && (
                <span className="px-1.5 py-0.5 rounded bg-[#111827] text-[10px] text-[#64748b]">
                  +{trip.visitedCities.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111827] rounded-lg px-2.5 py-2 text-center">
      <div className="text-sm font-semibold text-[#f1f5f9]">{value}</div>
      <div className="text-[10px] text-[#475569] uppercase tracking-wide">{label}</div>
    </div>
  )
}
