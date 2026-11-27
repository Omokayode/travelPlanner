'use client'

import { Edit2, Trash2, ChevronRight, Mail, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import StopPanel from '@/components/StopPanel'
import { Trip, Segment, TRANSPORT_ICONS, TRANSPORT_COLORS, Stop } from '@/lib/types'
import Detail from '@/components/ui/Detail'

export default function SegmentCard({ segment: seg, isRoadTrip, expanded, onToggle, onEdit, onDelete, onUpdateStops, onUpdateSegment, onShowConfirmation, vehicle, move, onGrip }: {
  segment: Segment; isRoadTrip: boolean; expanded: boolean
  /** reorder within the day (buttons work with keyboard and on phones; the grip is for dragging) */
  move?: { up?: () => void; down?: () => void }
  onGrip?: () => void
  onToggle: () => void; onEdit: () => void; onDelete: () => void
  onUpdateStops: (stops: Stop[]) => void
  onUpdateSegment: (patch: Partial<Segment>) => void
  onShowConfirmation: () => void
  vehicle?: Trip['vehicle']
}) {
  const color = TRANSPORT_COLORS[seg.mode] || '#f59e0b'
  return (
    <div className="tp-card overflow-hidden">
      <div className="flex items-start gap-3">
        {move && (
          <span onMouseDown={onGrip} onTouchStart={onGrip} title="Drag to reorder" aria-hidden
            className="hidden sm:flex -ml-2 mt-1.5 cursor-grab active:cursor-grabbing text-ink-4 hover:text-ink-2">
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          {TRANSPORT_ICONS[seg.mode]}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <span className="truncate">{seg.from.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">{seg.to.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-ink/40">
            {!!seg.distance && <span>{Math.round(seg.distance)} mi</span>}
            {!!seg.duration && <span>{Math.floor(seg.duration / 60)}h {Math.round(seg.duration % 60)}m</span>}
            {!!seg.cost && <span className="text-ok">${seg.cost.toFixed(2)}</span>}
            {seg.carrier && <span>{seg.carrier} {seg.flightNumber}</span>}
            {seg.stops?.length > 0 && <span>{seg.stops.length} stop{seg.stops.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {seg.confirmationText && (
            <button onClick={onShowConfirmation} className="p-1.5 text-ink/30 hover:text-accent transition-colors">
              <Mail className="w-3.5 h-3.5" />
            </button>
          )}
          {move && (
            <span className="flex flex-col -my-1">
              <button type="button" onClick={move.up} disabled={!move.up} aria-label="Move leg up"
                className="p-0.5 text-ink-4 hover:text-accent disabled:opacity-20 disabled:hover:text-ink-4"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={move.down} disabled={!move.down} aria-label="Move leg down"
                className="p-0.5 text-ink-4 hover:text-accent disabled:opacity-20 disabled:hover:text-ink-4"><ChevronDown className="w-3.5 h-3.5" /></button>
            </span>
          )}
          <button onClick={onEdit} aria-label="Edit leg" className="p-1.5 text-ink/30 hover:text-accent transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} aria-label="Delete leg" className="p-1.5 text-ink/30 hover:text-danger transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink/6 space-y-3">
          {isRoadTrip && (seg.fuelCost || seg.tollCost) && (
            <div className="grid grid-cols-3 gap-2">
              {!!seg.fuelGallons && <Detail label="Gallons" value={`${seg.fuelGallons.toFixed(2)} gal`} />}
              {!!seg.fuelCost && <Detail label="Fuel Cost" value={`$${seg.fuelCost.toFixed(2)}`} />}
              {!!seg.tollCost && <Detail label="Tolls" value={`$${seg.tollCost.toFixed(2)}`} />}
            </div>
          )}
          {seg.departureTime && <Detail label="Departs" value={new Date(seg.departureTime).toLocaleString()} />}
          {seg.arrivalTime && <Detail label="Arrives" value={new Date(seg.arrivalTime).toLocaleString()} />}
          {seg.bookingRef && <Detail label="Ref #" value={seg.bookingRef} />}
          {seg.notes && <div className="text-xs text-ink/40 italic">{seg.notes}</div>}
          {isRoadTrip && <StopPanel segment={seg} vehicle={vehicle} onUpdate={onUpdateStops} onUpdateSegment={onUpdateSegment} />}
        </div>
      )}
    </div>
  )
}
