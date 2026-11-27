'use client'

// One place in a day's list: number (in the day's colour), name, kind, city, time, notes.
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import type { Place } from '@/lib/types'
import { PLACE_ICONS, PLACE_LABELS } from '@/lib/types'
import { formatMinutes } from '@/lib/format'

interface Props {
  place: Place
  index: number
  color: string
  active?: boolean
  readOnly?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onDelete?: () => void
  move?: { up?: () => void; down?: () => void }
  /** drag & drop (desktop): the grip arms dragging, the card is the drop target */
  drag?: {
    onGrip: () => void
    draggable: boolean
    isOver: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
}

export default function PlaceCard({ place, index, color, active, readOnly, onSelect, onEdit, onDelete, move, drag }: Props) {
  const where = [place.location.city && place.location.city !== place.name ? place.location.city : null, place.location.state]
    .filter(Boolean)
    .join(', ')
  const actions = (className: string) =>
    readOnly ? null : (
      <div className={clsx('items-center sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity', className)}>
              {move && (
                <>
                  <button type="button" onClick={move.up} disabled={!move.up} aria-label="Move up" className="p-1 text-ink-4 hover:text-accent disabled:opacity-20">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={move.down} disabled={!move.down} aria-label="Move down" className="p-1 text-ink-4 hover:text-accent disabled:opacity-20">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </>
              )}
              <button type="button" onClick={onEdit} aria-label={`Edit ${place.name}`} className="p-1 text-ink-4 hover:text-accent">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onDelete} aria-label={`Remove ${place.name}`} className="p-1 text-ink-4 hover:text-danger">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {drag && (
                <span onMouseDown={drag.onGrip} title="Drag to move (also to another day)" aria-hidden
                  className="hidden sm:inline p-1 text-ink-4 hover:text-ink-2 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </span>
              )}
            </div>
    )

  return (
    <div
      id={`place-${place.id}`}
      draggable={drag?.draggable}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      onDragEnd={drag?.onDragEnd}
      className={clsx('relative flex gap-3 scroll-mt-24', drag?.isOver && 'before:absolute before:-top-1.5 before:inset-x-0 before:h-0.5 before:rounded before:bg-emerald-500')}
    >
      {/* number on the rail */}
      <div className="relative z-10 shrink-0 pt-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow ring-2 ring-page"
          style={{ background: color }}
          aria-label={`Place ${index + 1}`}
        >
          {index + 1}
        </span>
      </div>

      <div
        className={clsx(
          'group flex-1 min-w-0 flex gap-3 rounded-xl border p-3 transition-colors',
          active ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-line bg-card hover:border-line-strong',
        )}
      >
        {/* the text is the "show on map" button; the actions sit beside it, not inside */}
        <div className="flex-1 min-w-0">
        <div
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          aria-label={onSelect ? `Show ${place.name} on the map` : undefined}
          onClick={onSelect}
          onKeyDown={(e) => onSelect && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
          className={clsx('rounded-md', onSelect && 'cursor-pointer')}
        >
          <div className="flex items-start gap-2">
            <h4 className="font-semibold text-ink leading-snug">{place.name}</h4>
            {place.visited && <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" aria-label="visited" />}
          </div>
          <div className="text-xs text-ink-3 mt-0.5 flex flex-wrap gap-x-2">
            <span>{PLACE_LABELS[place.category] || 'Place'}</span>
            {where && <span>· {where}</span>}
            {place.arriveTime && <span>· {place.arriveTime}</span>}
            {place.stayMinutes ? <span>· {formatMinutes(place.stayMinutes)} there</span> : null}
            {place.cost ? <span className="text-ok">· ${place.cost.toFixed(2)}</span> : null}
          </div>
          {place.notes && <p className="text-sm text-ink-2 mt-1.5 line-clamp-3 whitespace-pre-line">{place.notes}</p>}
        </div>
        {actions('flex sm:hidden -ml-1 mt-1')}
        </div>

        <div className="flex items-start gap-1 shrink-0">
          {actions('hidden sm:flex')}
          <span className="w-10 h-10 rounded-lg bg-ink/5 flex items-center justify-center text-xl" aria-hidden>
            {PLACE_ICONS[place.category] || '📍'}
          </span>
        </div>
      </div>
    </div>
  )
}
