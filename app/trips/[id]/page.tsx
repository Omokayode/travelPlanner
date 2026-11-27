// app/trips/[id]/page.tsx — the trip: all days with their places on the left (Wanderlog style),
// a map on the right that follows the day you are reading. Lodging, packing, budget and photos
// are separate views. On phones the map opens from a button.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, BedDouble, Camera, Car, CalendarDays, Edit2, Layers, Map as MapIcon, MapPin, Package, Plane, Receipt, Route, Train, Trash2, X, ListOrdered } from 'lucide-react'
import clsx from 'clsx'
import Navbar from '@/components/Navbar'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { confirmDialog } from '@/components/ui/Confirm'
import PackingListPanel from '@/components/PackingListPanel'
import BudgetPanel from '@/components/BudgetPanel'
import LodgingPanel from '@/components/LodgingPanel'
import ImmichPanel from '@/components/ImmichPanel'
import QuickAdd from '@/components/QuickAdd'
import ShareTrip from '@/components/ShareTrip'
import EditDatesDialog from '@/components/trip/EditDatesDialog'
import DaySection, { insertBetween, type DragState } from '@/components/itinerary/DaySection'
import PlaceEditor from '@/components/itinerary/PlaceEditor'
import TravelEditor from '@/components/itinerary/TravelEditor'
import StopsOnTheWay from '@/components/itinerary/StopsOnTheWay'
import PlacesMap from '@/components/itinerary/PlacesMapLazy'
import type { Day, Lodging, Place, Travel, Trip } from '@/lib/types'
import { lodgingForDate, tripStats } from '@/lib/domain/trip'
import { todayLocal } from '@/lib/domain/dates'
import { cityName } from '@/lib/domain/cities'
import { dayColor } from '@/lib/dayColors'
import { formatMiles } from '@/lib/format'
import { api, reportError } from '@/lib/client'
import { useMediaQuery } from '@/lib/useMediaQuery'

const TYPE_ICONS = { road_trip: Car, flight: Plane, train: Train, mixed: Layers }
type View = 'itinerary' | 'lodging' | 'packing' | 'budget' | 'photos'
const VIEWS: { key: View; label: string; icon: typeof Car }[] = [
  { key: 'itinerary', label: 'Itinerary', icon: ListOrdered },
  { key: 'lodging', label: 'Lodging', icon: BedDouble },
  { key: 'packing', label: 'Packing', icon: Package },
  { key: 'budget', label: 'Budget', icon: Receipt },
  { key: 'photos', label: 'Photos', icon: Camera },
]

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const tripRef = useRef<Trip | null>(null)
  tripRef.current = trip
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('itinerary')
  const [activeDay, setActiveDay] = useState(1)
  const [activePlace, setActivePlace] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [placeEdit, setPlaceEdit] = useState<{ place: Place; dayNumber: number } | null>(null)
  const [travelEdit, setTravelEdit] = useState<{ from: Place; to: Place; day: Day } | null>(null)
  const [stopsFor, setStopsFor] = useState<{ from: Place; to: Place; dayNumber: number } | null>(null)
  const [editingDates, setEditingDates] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const queues = useRef(new Map<number, Promise<unknown>>())
  const wide = useMediaQuery('(min-width: 1024px)') // lg: map beside the list

  const load = useCallback(
    async (quiet = false) => {
      try {
        setTrip(await api<Trip>(`/api/trips/${tripId}`))
      } catch (err) {
        if (!quiet) {
          reportError(err, 'Could not load the trip')
          router.push('/')
        }
      } finally {
        setLoading(false)
      }
    },
    [tripId, router],
  )
  useEffect(() => {
    load()
  }, [load])

  // jump to #day-N (old day links redirect here)
  useEffect(() => {
    if (!trip) return
    const m = /^#day-(\d+)$/.exec(window.location.hash)
    if (m) setTimeout(() => document.getElementById(`day-${m[1]}`)?.scrollIntoView({ block: 'start' }), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, after the first load
  }, [!!trip])

  // which day is being read → the map follows it
  const sections = useRef(new Map<number, HTMLElement>())
  useEffect(() => {
    if (!trip || view !== 'itinerary') return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const n = Number((visible[0]?.target as HTMLElement | undefined)?.dataset.day)
        if (n) setActiveDay(n)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    sections.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [trip, view])

  const replaceDays = (days: Day[]) =>
    setTrip((t) => (t ? { ...t, days: t.days.map((d) => days.find((x) => x.id === d.id) ?? d) } : t))

  /** Save one day: shown at once, travel filled in when the server answers. Saves of a day run in order. */
  const saveDay = (day: Day) => {
    replaceDays([day])
    setSaving((s) => new Set(s).add(day.dayNumber))
    const prev = queues.current.get(day.dayNumber) ?? Promise.resolve()
    const run = prev
      .catch(() => undefined)
      .then(() => api<Day>(`/api/trips/${tripId}/days/${day.id}`, 'PUT', day))
      .then((saved) => replaceDays([saved]))
      .catch((err) => {
        reportError(err, 'Could not save the day')
        load(true)
      })
      .finally(() => {
        if (queues.current.get(day.dayNumber) === run) {
          queues.current.delete(day.dayNumber)
          setSaving((s) => {
            const n = new Set(s)
            n.delete(day.dayNumber)
            return n
          })
          if (!queues.current.size) load(true) // cities and totals from the server
        }
      })
    queues.current.set(day.dayNumber, run)
  }

  /** Save several days together (a place moving between days). */
  const saveDays = async (days: Day[]) => {
    replaceDays(days)
    setSaving((s) => new Set([...Array.from(s), ...days.map((d) => d.dayNumber)]))
    try {
      replaceDays(await api<Day[]>(`/api/trips/${tripId}/days`, 'PUT', { days }))
      load(true)
    } catch (err) {
      reportError(err, 'Could not move the place')
      load(true)
    } finally {
      setSaving((s) => {
        const n = new Set(s)
        days.forEach((d) => n.delete(d.dayNumber))
        return n
      })
    }
  }

  const firstNoTravel = (places: Place[]) => places.map((p, i) => (i === 0 ? { ...p, travel: undefined } : p))
  const dayByNumber = (n: number) => tripRef.current?.days.find((d) => d.dayNumber === n)

  /** Move a place to another day (at index, or the end). */
  const moveToDay = (placeId: string, fromN: number, toN: number, index?: number, changed?: Place) => {
    const from = dayByNumber(fromN)
    const to = dayByNumber(toN)
    if (!from || !to) return
    const p = changed ?? from.places.find((x) => x.id === placeId)
    if (!p) return
    const moved: Place = { ...p, travel: p.travel?.auto === false ? p.travel : { mode: p.travel?.mode || 'drive', auto: true } }
    const target = [...to.places]
    target.splice(index ?? target.length, 0, moved)
    saveDays([
      { ...from, places: firstNoTravel(from.places.filter((x) => x.id !== placeId)) },
      { ...to, places: firstNoTravel(target) },
    ])
  }

  const onDropAt = (toN: number, index: number) => {
    const d = drag
    setDrag(null)
    if (!d) return
    if (d.dayNumber !== toN) return moveToDay(d.placeId, d.dayNumber, toN, index)
    const day = dayByNumber(toN)
    if (!day) return
    const from = day.places.findIndex((p) => p.id === d.placeId)
    if (from < 0) return
    const next = [...day.places]
    const [p] = next.splice(from, 1)
    next.splice(index > from ? index - 1 : index, 0, p)
    if (next.every((x, i) => x.id === day.places[i].id)) return
    saveDay({ ...day, places: firstNoTravel(next) })
  }

  const focusPlace = (id: string, dayNumber?: number) => {
    setActivePlace(id)
    if (dayNumber) setActiveDay(dayNumber)
  }
  const revealPlace = (id: string, dayNumber: number) => {
    focusPlace(id, dayNumber)
    setMapOpen(false)
    document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete “${trip?.name}”?`,
      message: 'All its days, places, lodging, packing list and expenses are deleted too. This cannot be undone.',
      confirmLabel: 'Delete trip',
      danger: true,
    })
    if (!ok) return
    try {
      await api(`/api/trips/${tripId}`, 'DELETE')
      router.push('/')
    } catch (err) {
      reportError(err, 'Could not delete the trip')
    }
  }

  const days = useMemo(() => [...(trip?.days || [])].sort((a, b) => a.dayNumber - b.dayNumber), [trip])
  const mapDays = useMemo(() => days.map((d) => ({ dayNumber: d.dayNumber, color: dayColor(d.dayNumber), places: d.places })), [days])

  if (loading)
    return (
      <div className="min-h-screen bg-page">
        <Navbar />
        <PageSkeleton />
      </div>
    )
  if (!trip) return null

  const TypeIcon = TYPE_ICONS[trip.type]
  const stats = tripStats(trip)
  const todayDay = days.find((d) => d.date === todayLocal())
  const showMap = view === 'itinerary'
  const dayOptions = days.map((d) => ({ dayNumber: d.dayNumber, label: `Day ${d.dayNumber} · ${format(parseISO(d.date), 'EEE, MMM d')}` }))

  return (
    <div className="min-h-screen bg-page">
      <Navbar />
      <div className={clsx('lg:grid', showMap && wide ? 'lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,42%)]' : 'lg:grid-cols-[13rem_minmax(0,1fr)]')}>
        {/* ── left: sections and days (wide screens) ── */}
        <aside className="hidden lg:block border-r border-line">
          <nav aria-label="Trip" className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3 space-y-1 text-sm">
            {VIEWS.map((v) => (
              <div key={v.key}>
                <button type="button" onClick={() => setView(v.key)} aria-current={view === v.key ? 'page' : undefined}
                  className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg font-medium',
                    view === v.key ? 'bg-ink text-page' : 'text-ink-2 hover:bg-ink/5')}>
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
                {v.key === 'itinerary' && view === 'itinerary' && (
                  <ul className="mt-1 mb-2 space-y-0.5">
                    {days.map((d) => (
                      <li key={d.id}>
                        <a href={`#day-${d.dayNumber}`}
                          className={clsx('block px-3 py-1.5 rounded-lg border-l-2', activeDay === d.dayNumber ? 'bg-ink/5 text-ink' : 'text-ink-3 hover:text-ink border-transparent')}
                          style={activeDay === d.dayNumber ? { borderColor: dayColor(d.dayNumber) } : undefined}>
                          <span className="font-medium">{format(parseISO(d.date), 'EEE M/d')}</span>
                          <span className="block text-xs truncate">{d.title || d.places[d.places.length - 1]?.location.city || d.places[0]?.name || '—'}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── middle: header + the chosen view ── */}
        <main className="min-w-0 px-4 sm:px-6 py-5">
          <header className="flex items-start gap-3 mb-4">
            <Link href="/" aria-label="All trips" className="mt-1 p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-ink/5">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-ink-3 uppercase tracking-wide">
                <TypeIcon className="w-4 h-4 text-accent" /> {trip.type.replace('_', ' ')}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink leading-tight">{trip.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3 mt-1">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  {format(parseISO(trip.startDate), 'MMM d')} – {format(parseISO(trip.endDate), 'MMM d, yyyy')} · {days.length} days
                </span>
                <button type="button" onClick={() => setEditingDates(true)} className="text-accent/80 hover:text-accent inline-flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit dates
                </button>
              </div>
            </div>
            <ShareTrip tripId={tripId} token={trip.shareToken} />
            <button type="button" onClick={handleDelete} aria-label="Delete trip" className="p-2 rounded-lg text-ink-3 hover:text-danger hover:bg-red-500/10">
              <Trash2 className="w-4 h-4" />
            </button>
          </header>

          {/* views on phones / tablets */}
          <div role="tablist" className="lg:hidden flex gap-1 mb-4 p-1 bg-ink/5 rounded-xl max-w-full overflow-x-auto">
            {VIEWS.map((v) => (
              <button key={v.key} role="tab" aria-selected={view === v.key} type="button" onClick={() => setView(v.key)}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap',
                  view === v.key ? 'bg-card text-ink shadow-sm' : 'text-ink-3')}>
                <v.icon className="w-4 h-4" /> {v.label}
              </button>
            ))}
          </div>

          {view === 'itinerary' && (
            <>
              {/* overview */}
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { icon: Route, text: stats.totalMiles ? formatMiles(stats.totalMiles) : null },
                  { icon: Car, text: stats.totalDrivingHours ? `${stats.totalDrivingHours}h on the move` : null },
                  { icon: Receipt, text: stats.totalFuelCost ? `$${Math.round(stats.totalFuelCost + stats.totalTollCost)} fuel & tolls` : null },
                  { icon: MapPin, text: `${stats.citiesCount} ${stats.citiesCount === 1 ? 'city' : 'cities'} visited` },
                ]
                  .filter((s) => s.text)
                  .map((s) => (
                    <span key={s.text} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/5 text-xs text-ink-2">
                      <s.icon className="w-3.5 h-3.5" /> {s.text}
                    </span>
                  ))}
                {trip.vehicle && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/5 text-xs text-ink-2">
                    <Car className="w-3.5 h-3.5" /> {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.fuelEfficiency} mpg
                  </span>
                )}
              </div>
              {trip.visitedCities.length > 0 && (
                <p className="text-xs text-ink-3 mb-2">
                  Visited: {trip.visitedCities.map(cityName).join(' · ')}
                </p>
              )}

              {days.map((d, i) => (
                <DaySection
                  key={d.id}
                  ref={(el) => {
                    if (el) sections.current.set(d.dayNumber, el)
                    else sections.current.delete(d.dayNumber)
                  }}
                  tripId={tripId}
                  day={d}
                  color={dayColor(d.dayNumber)}
                  lodging={lodgingForDate(trip.lodgings, d.date)}
                  previousEnd={days[i - 1]?.places[days[i - 1].places.length - 1]}
                  saving={saving.has(d.dayNumber)}
                  activePlaceId={activePlace}
                  onSave={saveDay}
                  onFocusPlace={(id) => focusPlace(id, d.dayNumber)}
                  onEditPlace={(place, dayNumber) => setPlaceEdit({ place, dayNumber })}
                  onEditTravel={(from, to, day) => setTravelEdit({ from, to, day })}
                  onFindStops={(from, to, day) => setStopsFor({ from, to, dayNumber: day.dayNumber })}
                  drag={drag}
                  setDrag={setDrag}
                  onDropAt={onDropAt}
                />
              ))}
            </>
          )}

          {view === 'photos' && <ImmichPanel tripId={tripId} startDate={trip.startDate} endDate={trip.endDate} />}
          {view === 'lodging' && (
            <div className="max-w-2xl">
              <LodgingPanel trip={trip} onUpdate={(lodgings: Lodging[]) => setTrip((t) => (t ? { ...t, lodgings } : t))} />
            </div>
          )}
          {view === 'packing' && (
            <div className="max-w-2xl">
              <PackingListPanel tripId={tripId} tripType={trip.type} />
            </div>
          )}
          {view === 'budget' && (
            <div className="max-w-2xl">
              <BudgetPanel tripId={tripId} trip={trip} />
            </div>
          )}
        </main>

        {/* ── right: map of the day being read (wide screens) ── */}
        {showMap && wide && (
          <div className="border-l border-line">
            <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
              <PlacesMap days={mapDays} lodgings={trip.lodgings} focusDay={activeDay} activePlaceId={activePlace} onPlaceClick={revealPlace} />
              <div className="absolute top-3 left-3 z-[500] px-3 py-1.5 rounded-full bg-page/90 backdrop-blur text-xs font-medium text-ink shadow flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: dayColor(activeDay) }} />
                Day {activeDay}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* phones: map button + full-screen map */}
      {showMap && !wide && (
        <button type="button" onClick={() => setMapOpen(true)}
          className="lg:hidden fixed z-30 left-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 flex items-center gap-2 px-4 h-12 rounded-full bg-ink text-page shadow-lg">
          <MapIcon className="w-5 h-5" /> Map
        </button>
      )}
      {mapOpen && !wide && (
        <div className="fixed inset-0 z-[1050] bg-page flex flex-col" role="dialog" aria-modal="true" aria-label="Map">
          <div className="flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-line">
            <div className="flex-1 flex gap-1 overflow-x-auto">
              {days.map((d) => (
                <button key={d.id} type="button" onClick={() => setActiveDay(d.dayNumber)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs whitespace-nowrap border',
                    activeDay === d.dayNumber ? 'text-white border-transparent' : 'border-line text-ink-2')}
                  style={activeDay === d.dayNumber ? { background: dayColor(d.dayNumber) } : undefined}>
                  Day {d.dayNumber}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setMapOpen(false)} aria-label="Close map" className="p-2 rounded-lg text-ink-2 hover:bg-ink/5">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1">
            <PlacesMap days={mapDays} lodgings={trip.lodgings} focusDay={activeDay} activePlaceId={activePlace} onPlaceClick={revealPlace} />
          </div>
        </div>
      )}

      <EditDatesDialog open={editingDates} tripId={tripId} startDate={trip.startDate} endDate={trip.endDate} dayCount={days.length}
        onClose={() => setEditingDates(false)} onChanged={() => load(true)} />

      <PlaceEditor
        place={placeEdit?.place ?? null}
        dayNumber={placeEdit?.dayNumber ?? 1}
        days={dayOptions}
        onClose={() => setPlaceEdit(null)}
        onSave={(place, toN) => {
          const fromN = placeEdit!.dayNumber
          setPlaceEdit(null)
          if (toN !== fromN) return moveToDay(place.id, fromN, toN, undefined, place)
          const day = dayByNumber(fromN)
          if (day) saveDay({ ...day, places: day.places.map((p) => (p.id === place.id ? place : p)) })
        }}
      />

      <TravelEditor
        open={!!travelEdit}
        from={travelEdit?.from ?? null}
        to={travelEdit?.to ?? null}
        date={travelEdit?.day.date ?? trip.startDate}
        onClose={() => setTravelEdit(null)}
        onSave={(travel: Travel, patch) => {
          const te = travelEdit!
          setTravelEdit(null)
          const day = dayByNumber(te.day.dayNumber)
          if (day) saveDay({ ...day, places: day.places.map((p) => (p.id === te.to.id ? { ...p, ...patch, travel } : p)) })
        }}
      />

      <StopsOnTheWay
        from={stopsFor?.from ?? null}
        to={stopsFor?.to ?? null}
        onClose={() => setStopsFor(null)}
        onAdd={(place) => {
          const s = stopsFor!
          const day = dayByNumber(s.dayNumber)
          if (day) saveDay({ ...day, places: insertBetween(day.places, s.from.id, s.to.id, place) })
        }}
      />

      {todayDay && <QuickAdd tripId={tripId} day={todayDay} onSaved={() => load(true)} />}
    </div>
  )
}
