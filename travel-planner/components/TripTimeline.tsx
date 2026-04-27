'use client'

import { useMemo } from 'react'
import { Trip, Day } from '@/lib/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import Link from 'next/link'

interface Props {
  trip: Trip
}

interface Stop {
  city: string
  dayNumber: number
  date: string
  dayId: string
  isBase?: boolean
  hasStops?: boolean
  stopNames?: string[]
  legs?: { from: string; to: string; stops: string[] }[]
}

export default function TripTimeline({ trip }: Props) {
  const totalDays = trip.days?.length || 1

  const stops = useMemo<Stop[]>(() => {
    const result: Stop[] = []
    const seen = new Set<string>()

    for (const day of (trip.days || [])) {
      const city = day.endCity || day.startCity
      if (!city) continue

      const legs = (day.segments || []).map(seg => ({
        from: seg.from?.city || seg.from?.name || '',
        to: seg.to?.city || seg.to?.name || '',
        stops: (seg.stops || []).filter(s => s.visited !== false).map(s => s.name),
      }))

      const stopNames = (day.segments || []).flatMap(s =>
        (s.stops || []).map(st => st.name)
      )

      const key = `${city}-${day.dayNumber}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          city,
          dayNumber: day.dayNumber,
          date: day.date,
          dayId: day.id,
          hasStops: stopNames.length > 0,
          stopNames,
          legs,
        })
      }
    }
    return result
  }, [trip.days])

  if (stops.length === 0) return null

  // SVG dimensions
  const W = 900
  const H = Math.max(120, stops.length * 80 + 40)
  const LINE_X = 60
  const START_Y = 40
  const END_Y = H - 40
  const STEP = stops.length > 1 ? (END_Y - START_Y) / (stops.length - 1) : 0

  const getY = (i: number) => stops.length === 1 ? (H / 2) : START_Y + i * STEP

  return (
    <div className="tp-card p-4 overflow-x-auto">
      <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-3">Trip Overview</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: `${Math.max(160, stops.length * 70)}px` }}>
        {/* Vertical line */}
        <line x1={LINE_X} y1={START_Y} x2={LINE_X} y2={END_Y}
          stroke="#10b981" strokeWidth="2" strokeOpacity="0.3" />

        {stops.map((stop, i) => {
          const y = getY(i)
          const isFirst = i === 0
          const isLast = i === stops.length - 1

          return (
            <g key={stop.dayId}>
              {/* Connector dot */}
              <circle cx={LINE_X} cy={y} r={isFirst || isLast ? 8 : 6}
                fill={stop.visited ? '#10b981' : isFirst || isLast ? '#10b981' : '#1e293b'}
                stroke="#10b981" strokeWidth={isFirst || isLast ? 2 : 1.5} />

              {/* Day number */}
              <text x={LINE_X} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="9" fontWeight="bold">{stop.dayNumber}</text>

              {/* City name */}
              <text x={LINE_X + 20} y={y - 8} fill="#f1f5f9" fontSize="14" fontWeight="600">
                {stop.city}
              </text>

              {/* Date */}
              <text x={LINE_X + 20} y={y + 8} fill="#64748b" fontSize="11">
                {format(parseISO(stop.date), 'EEE, MMM d')}
              </text>

              {/* Legs */}
              {stop.legs && stop.legs.length > 0 && (
                <>
                  {stop.legs.map((leg, li) => (
                    <g key={li}>
                      {leg.from && leg.to && (
                        <text x={LINE_X + 20} y={y + 22 + li * 14} fill="#475569" fontSize="10">
                          {`${leg.from} → ${leg.to}`}
                          {leg.stops.length > 0 && ` · ${leg.stops.slice(0, 2).join(', ')}${leg.stops.length > 2 ? `+${leg.stops.length - 2}` : ''}`}
                        </text>
                      )}
                    </g>
                  ))}
                </>
              )}

              {/* Clickable overlay */}
              <a href={`/trips/${trip.id}/day/${stop.dayId}`}>
                <rect x={LINE_X + 15} y={y - 20} width={W - LINE_X - 20} height={40}
                  fill="transparent" className="cursor-pointer" />
              </a>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
