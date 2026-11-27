'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ChevronRight, ChevronDown, CheckCircle2, Circle, Hotel } from 'lucide-react'
import { Day, Lodging, TRANSPORT_ICONS } from '@/lib/types'
import { dayTotals } from '@/lib/domain/trip'
import clsx from 'clsx'

// ── Day Row with legs + stops ─────────────────────────────────────────────────
export default function DayRow({ day, tripId, isRoadTrip, lodging, onToggleVisited }: {
  day: Day; tripId: string; isRoadTrip: boolean; lodging?: Lodging; onToggleVisited: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { miles: totalDist, cost: totalCost } = dayTotals(day)
  const hasLegs = (day.segments?.length ?? 0) > 0

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-all',
      day.visited ? 'border-green-500/20 bg-green-500/3' : 'border-ink/8 bg-ink/3 hover:border-emerald-500/30')}>
      <div className="flex items-stretch">
        <div className={clsx('w-14 flex flex-col items-center justify-center py-3 border-r',
          day.visited ? 'border-green-500/20 bg-green-500/5' : 'border-ink/6 bg-ink/4')}>
          <div className="text-xs text-ink/30 uppercase tracking-wide">Day</div>
          <div className={clsx('text-xl font-bold', day.visited ? 'text-ok' : 'text-accent')}>{day.dayNumber}</div>
        </div>
        <Link href={`/trips/${tripId}/day/${day.id}`} className="flex-1 px-3 py-3 min-w-0">
          <div className="text-xs text-ink/30 mb-0.5">{format(parseISO(day.date), 'EEE, MMM d')}</div>
          {day.startCity || day.endCity ? (
            <div className="text-sm font-medium text-ink flex items-center gap-1.5 truncate">
              {day.startCity && <span>{day.startCity}</span>}
              {day.startCity && day.endCity && day.startCity !== day.endCity && <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />}
              {day.endCity && day.endCity !== day.startCity && <span>{day.endCity}</span>}
            </div>
          ) : lodging ? (
            <div className="text-sm text-ink/60 flex items-center gap-1 truncate">
              <Hotel className="w-3 h-3 text-info shrink-0" />{lodging.name}
            </div>
          ) : (
            <div className="text-sm text-ink/30 italic">No route yet</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {hasLegs && (
              <span className="text-xs text-ink/30">
                {day.segments!.map(s => TRANSPORT_ICONS[s.mode]).join(' ')} {day.segments!.length} leg{day.segments!.length !== 1 ? 's' : ''}
              </span>
            )}
            {totalDist > 0 && isRoadTrip && <span className="text-xs text-ink/30">· {Math.round(totalDist)}mi</span>}
            {totalCost > 0 && <span className="text-xs text-ok">· ${totalCost.toFixed(0)}</span>}
          </div>
        </Link>
        <div className="flex flex-col items-center justify-center gap-1 pr-2">
          {hasLegs && (
            <button onClick={e => { e.preventDefault(); setExpanded(x => !x) }}
              className="p-1 text-ink/20 hover:text-ink/50">
              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
          <button onClick={e => { e.preventDefault(); onToggleVisited() }}
            className="p-1 text-ink/30 hover:text-ok transition-colors">
            {day.visited ? <CheckCircle2 className="w-4 h-4 text-ok" /> : <Circle className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded legs + stops */}
      {expanded && hasLegs && (
        <div className="border-t border-ink/6 px-4 py-3 space-y-2">
          {day.segments!.map(seg => (
            <div key={seg.id} className="text-xs">
              <div className="flex items-center gap-1.5 text-ink/60 font-medium">
                <span>{TRANSPORT_ICONS[seg.mode]}</span>
                <span>{seg.from?.city || seg.from?.name}</span>
                <ChevronRight className="w-3 h-3 text-accent/50" />
                <span>{seg.to?.city || seg.to?.name}</span>
                {!!seg.distance && <span className="text-ink/30 ml-1">· {Math.round(seg.distance)}mi</span>}
              </div>
              {(seg.stops?.length ?? 0) > 0 && (
                <div className="ml-5 mt-1 space-y-0.5">
                  {seg.stops!.map(stop => (
                    <div key={stop.id} className="flex items-center gap-1.5 text-ink/30">
                      <span className="text-[10px]">{stop.visited ? '✓' : '○'}</span>
                      <span>{stop.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
