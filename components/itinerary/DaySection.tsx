'use client'

// One day of the itinerary: date, title, totals, weather, notes, the places in order with how
// you get between them, where you sleep, and adding more. Changes are saved through onSave.
import { forwardRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { format, parseISO } from 'date-fns'
import { BedDouble, Camera, CheckCircle2, ChevronDown, Circle, Loader2, StickyNote, CornerDownRight, Navigation } from 'lucide-react'
import { appleDirections, googleDirections } from '@/lib/domain/mapLinks'
import clsx from 'clsx'
import type { Day, Lodging, Place, Travel } from '@/lib/types'
import { dayTotals } from '@/lib/domain/trip'
import { haversineMiles } from '@/lib/domain/geo'
import { formatMiles, formatMinutes } from '@/lib/format'
import { todayLocal, addDays } from '@/lib/domain/dates'
import { useWeather } from '@/lib/useWeather'
import Dialog from '@/components/ui/Dialog'
import ImmichPanel from '@/components/ImmichPanel'
import PlaceCard from './PlaceCard'
import TravelRow from './TravelRow'
import AddPlace from './AddPlace'

export interface DragState {
  placeId: string
  dayNumber: number
}

interface Props {
  tripId: string
  day: Day
  color: string
  lodging?: Lodging
  /** last place of the day before, to start from there */
  previousEnd?: Place
  saving: boolean
  activePlaceId?: string | null
  readOnly?: boolean
  onSave: (day: Day) => void
  onFocusPlace: (placeId: string) => void
  onEditPlace: (place: Place, dayNumber: number) => void
  onEditTravel: (from: Place, to: Place, day: Day) => void
  onFindStops: (from: Place, to: Place, day: Day) => void
  drag: DragState | null
  setDrag: (d: DragState | null) => void
  /** drop the dragged place at index in this day */
  onDropAt: (dayNumber: number, index: number) => void
}

/** Open the whole day in Google Maps (stops as waypoints) or Apple Maps (to the last place). */
function DayNavLinks({ places }: { places: Place[] }) {
  const stops = places.map((p) => ({ name: p.name, coords: p.location.coords }))
  const allWalk = places.every((p, i) => i === 0 || p.travel?.mode === 'walk')
  const mode = allWalk ? 'walk' : 'drive'
  const g = googleDirections(stops, mode)
  const last = stops[stops.length - 1]
  return (
    <span className="inline-flex items-center gap-2">
      <Navigation className="w-3 h-3" aria-hidden />
      <a href={g.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent underline-offset-2 hover:underline"
        title={g.included < stops.length ? `Google Maps takes the first ${g.included} of ${stops.length} places` : "All of this day's places, in order"}>
        Google Maps{g.included < stops.length ? ` (first ${g.included})` : ''}
      </a>
      <a href={appleDirections(stops[0], last, mode)} target="_blank" rel="noopener noreferrer" className="hover:text-accent underline-offset-2 hover:underline"
        title={`Apple Maps: from ${stops[0].name} to ${last.name} (Apple's link can't include the stops in between)`}>
        Apple Maps
      </a>
    </span>
  )
}

function DayWeather({ date, place }: { date: string; place?: Place }) {
  const { weather } = useWeather(place?.location.coords.lat, place?.location.coords.lng, date)
  if (!weather) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-2" title={weather.description}>
      <span aria-hidden>{weather.icon}</span> {weather.tempMax}° / {weather.tempMin}°
    </span>
  )
}

const DaySection = forwardRef<HTMLElement, Props>(function DaySection(
  { tripId, day, color, lodging, previousEnd, saving, activePlaceId, readOnly, onSave, onFocusPlace, onEditPlace, onEditTravel, onFindStops, drag, setDrag, onDropAt },
  ref,
) {
  const [open, setOpen] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(day.title || '')
  const [notesOpen, setNotesOpen] = useState(!!day.notes)
  const [notes, setNotes] = useState(day.notes || '')
  const [photos, setPhotos] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const totals = dayTotals(day)
  const places = day.places
  const today = todayLocal()
  const showWeather = day.date >= today && day.date <= addDays(today, 14)
  const save = (patch: Partial<Day>) => onSave({ ...day, ...patch })

  const setPlaces = (next: Place[]) => save({ places: next.map((p, i) => (i === 0 ? { ...p, travel: undefined } : p)) })
  const move = (from: number, to: number) => {
    const next = [...places]
    const [p] = next.splice(from, 1)
    next.splice(to, 0, p)
    setPlaces(next)
  }
  const add = (p: Place) => setPlaces([...places, { ...p, travel: places.length ? { mode: 'drive', auto: true } : undefined }])

  const dragProps = (i: number) =>
    readOnly
      ? undefined
      : {
          onGrip: () => setArmed(places[i].id),
          draggable: armed === places[i].id,
          isOver: over === i && drag?.placeId !== places[i].id,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', places[i].id)
            setDrag({ placeId: places[i].id, dayNumber: day.dayNumber })
          },
          onDragOver: (e: React.DragEvent) => {
            if (!drag) return
            e.preventDefault()
            setOver(i)
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            setOver(null)
            onDropAt(day.dayNumber, i)
          },
          onDragEnd: () => {
            setArmed(null)
            setOver(null)
            setDrag(null)
          },
        }

  return (
    <section ref={ref} id={`day-${day.dayNumber}`} data-day={day.dayNumber} aria-labelledby={`day-h-${day.dayNumber}`} className="scroll-mt-20 py-6 border-b border-line">
      {/* header */}
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`day-body-${day.dayNumber}`}
          className="mt-1 p-1 rounded text-ink-3 hover:text-ink" aria-label={open ? 'Collapse day' : 'Expand day'}>
          <ChevronDown className={clsx('w-5 h-5 transition-transform', !open && '-rotate-90')} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 id={`day-h-${day.dayNumber}`} className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />
            {format(parseISO(day.date), 'EEEE, MMMM do')}
          </h2>
          {editingTitle && !readOnly ? (
            <input
              autoFocus
              className="tp-input mt-1 max-w-sm"
              value={title}
              placeholder="Add a title (e.g. Day in Sedona)"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setEditingTitle(false)
                if ((day.title || '') !== title.trim()) save({ title: title.trim() || undefined })
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button type="button" disabled={readOnly} onClick={() => setEditingTitle(true)}
              className={clsx('text-sm mt-0.5', day.title ? 'text-ink-2 font-medium' : 'text-ink-4 hover:text-ink-2')}>
              Day {day.dayNumber}{day.title ? ` · ${day.title}` : readOnly ? '' : ' · Add a title'}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-ink-3">
            {totals.miles > 0 && <span>{[formatMinutes(totals.driveMinutes), formatMiles(totals.miles)].filter(Boolean).join(' · ')}</span>}
            {totals.cost > 0 && <span className="text-ok">${totals.cost.toFixed(2)}</span>}
            {showWeather && <DayWeather date={day.date} place={places[0]} />}
            {places.length >= 2 && <DayNavLinks places={places} />}
            {saving && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen} title="Notes"
              className={clsx('p-2 rounded-lg hover:bg-ink/5', notes ? 'text-accent' : 'text-ink-3')}>
              <StickyNote className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setPhotos(true)} title="Photos from this day" className="p-2 rounded-lg text-ink-3 hover:bg-ink/5">
              <Camera className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => save({ visited: !day.visited })} aria-pressed={day.visited}
              className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border',
                day.visited ? 'border-green-500/30 bg-green-500/10 text-ok' : 'border-line text-ink-3 hover:text-ok')}>
              {day.visited ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              <span className="hidden sm:inline">{day.visited ? 'Done' : 'Mark done'}</span>
            </button>
          </div>
        )}
      </div>

      {open && (
        <div id={`day-body-${day.dayNumber}`} className="mt-4 space-y-1">
          {notesOpen && !readOnly && (
            <textarea
              className="tp-input resize-y min-h-[4.5rem] mb-3 ml-0 sm:ml-10 sm:w-[calc(100%-2.5rem)]"
              placeholder="Notes for the day…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => (day.notes || '') !== notes && save({ notes: notes || undefined })}
            />
          )}

          {places.length === 0 && (
            <div
              className={clsx('ml-10 rounded-xl border border-dashed p-4 text-sm text-ink-3', drag ? 'border-emerald-500/50' : 'border-line')}
              onDragOver={(e) => drag && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onDropAt(day.dayNumber, 0)
              }}
            >
              No places yet.
              {previousEnd && !readOnly && (
                <button type="button" className="ml-2 inline-flex items-center gap-1 text-accent hover:underline"
                  onClick={() => add({ ...previousEnd, id: uuidv4(), travel: undefined, visited: false, arriveTime: undefined, notes: undefined, cost: undefined })}>
                  <CornerDownRight className="w-3.5 h-3.5" /> Start from {previousEnd.name}
                </button>
              )}
            </div>
          )}

          {/* the rail behind the numbers */}
          <ol className="relative">
            {places.length > 1 && <span aria-hidden className="absolute left-[13px] top-6 bottom-6 w-0.5 rounded" style={{ background: `${color}55` }} />}
            {places.map((p, i) => (
              <li key={p.id}>
                {i > 0 && (
                  <TravelRow
                    from={places[i - 1]}
                    to={p}
                    pending={saving && (!p.travel || p.travel.distance == null)}
                    readOnly={readOnly}
                    onEdit={() => onEditTravel(places[i - 1], p, day)}
                    onFindStops={() => onFindStops(places[i - 1], p, day)}
                  />
                )}
                <PlaceCard
                  place={p}
                  index={i}
                  color={color}
                  active={activePlaceId === p.id}
                  readOnly={readOnly}
                  onSelect={() => onFocusPlace(p.id)}
                  onEdit={() => onEditPlace(p, day.dayNumber)}
                  onDelete={() => setPlaces(places.filter((x) => x.id !== p.id))}
                  move={{ up: i > 0 ? () => move(i, i - 1) : undefined, down: i < places.length - 1 ? () => move(i, i + 1) : undefined }}
                  drag={dragProps(i)}
                />
              </li>
            ))}
            {/* drop at the end of the day */}
            {drag && places.length > 0 && (
              <li
                className={clsx('ml-10 mt-2 h-10 rounded-xl border border-dashed text-xs flex items-center justify-center',
                  over === places.length ? 'border-emerald-500 text-accent' : 'border-line text-ink-4')}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(places.length)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  onDropAt(day.dayNumber, places.length)
                }}
              >
                Drop here for the end of day {day.dayNumber}
              </li>
            )}
          </ol>

          {lodging && (
            <div className="flex items-center gap-2 ml-10 mt-3 px-3 py-2 rounded-xl bg-blue-500/[0.06] border border-blue-500/15 text-sm">
              <BedDouble className="w-4 h-4 text-info shrink-0" />
              <span className="text-ink-2 truncate">
                Night at <span className="text-ink font-medium">{lodging.name}</span>
                {lodging.location.city && <span className="text-ink-3"> · {lodging.location.city}</span>}
              </span>
            </div>
          )}

          {!readOnly && (
            <div className="pt-3">
              <AddPlace
                near={(() => {
                  const last = places[places.length - 1] ?? previousEnd
                  return last ? { coords: last.location.coords, city: last.location.city } : undefined
                })()}
                existingNames={new Set(places.map((p) => p.name.toLowerCase()))}
                onAdd={add}
              />
            </div>
          )}
        </div>
      )}

      <Dialog open={photos} onClose={() => setPhotos(false)} title={`Photos · ${format(parseISO(day.date), 'EEE, MMM d')}`} size="lg"
        icon={<Camera className="w-5 h-5 text-accent" />}>
        {photos && <ImmichPanel tripId={tripId} dayDate={day.date} />}
      </Dialog>
    </section>
  )
})

export default DaySection

/** Put stops between `from` and `to`, ordered by distance from `from` (closest first). */
export function insertBetween(places: Place[], fromId: string, toId: string, add: Place): Place[] {
  const a = places.findIndex((p) => p.id === fromId)
  const b = places.findIndex((p) => p.id === toId)
  if (a < 0 || b < 0 || b <= a) return [...places, add]
  const start = places[a].location.coords
  const d = haversineMiles(start, add.location.coords)
  let at = b
  for (let i = a + 1; i < b; i++) {
    if (haversineMiles(start, places[i].location.coords) > d) {
      at = i
      break
    }
  }
  const travel: Travel = { mode: 'drive', auto: true }
  const next = [...places]
  next.splice(at, 0, { ...add, travel })
  return next
}
