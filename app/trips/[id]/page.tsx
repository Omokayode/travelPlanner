// app/trips/[id]/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import { confirmDialog } from '@/components/ui/Confirm'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Car, Plane, Train, Layers, CalendarDays, MapPin, ExternalLink, Trash2, Navigation, Globe, Loader2, Edit2, Check, Plus, List, GitCommitVertical } from 'lucide-react'
import Navbar from '@/components/Navbar'
import MapView from '@/components/MapView'
import PackingListPanel from '@/components/PackingListPanel'
import BudgetPanel from '@/components/BudgetPanel'
import LodgingPanel from '@/components/LodgingPanel'
import ImmichPanel from '@/components/ImmichPanel'
import TripTimeline from '@/components/TripTimeline'
import QuickAdd from '@/components/QuickAdd'
import { Trip, Day, Lodging } from '@/lib/types'
import { getGoogleMapsUrl, getWazeUrl } from '@/lib/api'
import { lodgingForDate, tripStats } from '@/lib/domain/trip'
import { daysInclusive, isIsoDate, todayLocal } from '@/lib/domain/dates'
import { api, reportError } from '@/lib/client'
import StatTile from '@/components/ui/StatTile'
import DayRow from '@/components/trip/DayRow'
import clsx from 'clsx'

const TYPE_ICONS = { road_trip: Car, flight: Plane, train: Train, mixed: Layers }
type Tab = 'itinerary' | 'lodging' | 'packing' | 'budget' | 'photos'

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('itinerary')
  const [editingDates, setEditingDates] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [savingDates, setSavingDates] = useState(false)
  const [dateConfirm, setDateConfirm] = useState<{ add: number; remove: number } | null>(null)
  const [dayView, setDayView] = useState<'list' | 'timeline'>('list')
  useEffect(() => {
    try { if (localStorage.getItem('tp-day-view') === 'timeline') setDayView('timeline') } catch { /* no storage */ }
  }, [])
  const chooseDayView = (v: 'list' | 'timeline') => {
    setDayView(v)
    try { localStorage.setItem('tp-day-view', v) } catch { /* no storage */ }
  }

  const load = useCallback(async () => {
    try {
      const t = await api<Trip>(`/api/trips/${tripId}`)
      setTrip(t)
      setNewStart(t.startDate)
      setNewEnd(t.endDate)
    } catch (err) {
      reportError(err, 'Could not load the trip')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }, [tripId, router])

  useEffect(() => { load() }, [load])

  const handleMarkVisited = async (day: Day) => {
    if (!trip) return
    try {
      await api(`/api/trips/${tripId}/days/${day.id}`, 'PUT', { ...day, visited: !day.visited })
      load() // visited cities are recalculated on the server
    } catch (err) {
      reportError(err, 'Could not update the day')
    }
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete “${trip?.name}”?`,
      message: 'All its days, legs, lodging, packing list and expenses are deleted too. This cannot be undone.',
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

  const handleLodgingUpdate = (lodgings: Lodging[]) => {
    setTrip(t => t ? { ...t, lodgings } : t)
  }

  const openDateEdit = () => {
    setNewStart(trip!.startDate)
    setNewEnd(trip!.endDate)
    setEditingDates(true)
    setDateConfirm(null)
  }

  const checkDateChange = () => {
    if (!trip) return
    if (!isIsoDate(newStart) || !isIsoDate(newEnd) || newEnd < newStart) { reportError(null, 'The end date must be on or after the start date.'); return }
    const oldDays = trip.days.length
    const newDays = daysInclusive(newStart, newEnd)
    const diff = newDays - oldDays
    if (diff === 0) { applyDateChange(); return }
    setDateConfirm({ add: Math.max(0, diff), remove: Math.max(0, -diff) })
  }

  const applyDateChange = async () => {
    if (!trip) return
    setSavingDates(true)
    try {
      // one server call: re-dates, adds or removes days in a single transaction
      await api(`/api/trips/${tripId}/dates`, 'PUT', { startDate: newStart, endDate: newEnd })
      setEditingDates(false)
      setDateConfirm(null)
      load()
    } catch (err) {
      reportError(err, 'Could not change the dates')
    } finally { setSavingDates(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-base">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    </div>
  )

  if (!trip) return null

  const TypeIcon = TYPE_ICONS[trip.type]
  const stats = tripStats(trip)
  const allMapSegments = trip.days?.flatMap(d => d.segments?.map(s => ({ segment: s })) || []) || []
  const allStops = trip.days?.flatMap(d => d.segments?.flatMap(s => s.stops || []) || []) || []
  const firstSeg = trip.days?.[0]?.segments?.[0]
  const lastDay = trip.days?.[trip.days.length - 1]
  const lastSeg = lastDay?.segments?.[lastDay.segments.length - 1]
  const daysComplete = trip.days?.filter(d => d.visited).length || 0
  const todayDay = trip.days?.find(d => d.date === todayLocal())
  const isCompleted = daysComplete === (trip.days?.length || 0) && daysComplete > 0

  return (
    <div className="min-h-screen bg-base">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link href="/" className="mt-1 p-2 rounded-lg text-ink/30 hover:text-ink/70 hover:bg-ink/5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="w-5 h-5 text-accent" />
              <span className="text-xs font-medium text-ink/40 uppercase tracking-wide">{trip.type.replace('_', ' ')}</span>
              {isCompleted && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-ok border border-green-500/20">Completed</span>}
            </div>
            <h1 className="font-display text-3xl font-semibold text-ink leading-tight">{trip.name}</h1>
            <div className="flex items-center gap-2 text-sm text-ink/40 mt-1 flex-wrap">
              <CalendarDays className="w-4 h-4" />
              {format(parseISO(trip.startDate), 'MMM d')} – {format(parseISO(trip.endDate), 'MMM d, yyyy')}
              <span className="opacity-30">·</span>{trip.days?.length || 0} days
              {trip.vehicle && <><span className="opacity-30">·</span>{trip.vehicle.make} {trip.vehicle.model}</>}
              <button onClick={openDateEdit} className="text-accent/60 hover:text-accent flex items-center gap-1 ml-1">
                <Edit2 className="w-3 h-3" /> Edit dates
              </button>
            </div>
          </div>
          <button onClick={handleDelete} className="p-2 rounded-lg text-ink/30 hover:text-danger hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <Dialog open={editingDates} onClose={() => { setEditingDates(false); setDateConfirm(null) }} title="Edit trip dates">
          <div className="space-y-4">
              {!dateConfirm ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ink/50 text-xs mb-1 block">Start date</label>
                      <input type="date" className="tp-input w-full" value={newStart} onChange={e => setNewStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-ink/50 text-xs mb-1 block">End date</label>
                      <input type="date" className="tp-input w-full" value={newEnd} min={newStart} onChange={e => setNewEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="text-ink/40 text-sm">
                    {isIsoDate(newStart) && isIsoDate(newEnd) && newEnd >= newStart ? daysInclusive(newStart, newEnd) : '–'} days (currently {trip.days.length})
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingDates(false)} className="px-4 py-2 text-sm text-ink/50">Cancel</button>
                    <button onClick={checkDateChange} className="tp-btn-primary">Review changes</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="tp-card p-4 space-y-2">
                    <div className="text-ink/70 text-sm">Applying this change will:</div>
                    {dateConfirm.add > 0 && <div className="text-ok text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add {dateConfirm.add} day{dateConfirm.add !== 1 ? 's' : ''} at the end</div>}
                    {dateConfirm.remove > 0 && <div className="text-danger text-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Remove {dateConfirm.remove} day{dateConfirm.remove !== 1 ? 's' : ''} from the end</div>}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setDateConfirm(null)} className="px-4 py-2 text-sm text-ink/50">Back</button>
                    <button onClick={applyDateChange} disabled={savingDates} className="tp-btn-primary">
                      {savingDates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm
                    </button>
                  </div>
                </>
              )}
          </div>
        </Dialog>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 mb-6 p-1 bg-ink/5 rounded-xl w-fit max-w-full overflow-x-auto">
          {([
            ['itinerary', 'Itinerary', '🗺️'],
            ['photos', 'Photos', '🖼️'],
            ['lodging', 'Lodging', '🏨'],
            ['packing', 'Packing', '🎒'],
            ['budget', 'Budget', '💵'],
          ] as const).map(([t, label, icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                tab === t ? 'bg-emerald-500 text-white' : 'text-ink/50 hover:text-ink/80')}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'itinerary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map + stats */}
            <div className="lg:col-span-2 space-y-4">
              <div className="tp-card p-0 overflow-hidden">
                <MapView segments={allMapSegments} stops={allStops} height="clamp(260px, 45vh, 420px)" />
              </div>
              {firstSeg && lastSeg && (
                <div className="flex gap-2">
                  <a href={getGoogleMapsUrl(firstSeg.from, lastSeg.to, [], allMapSegments.map(s => s.segment))}
                    target="_blank" rel="noopener noreferrer"
                    className="tp-btn-ghost flex-1 justify-center text-sm">
                    <Globe className="w-4 h-4 text-info" /> Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                  {lastSeg && (
                    <a href={getWazeUrl(lastSeg.to)} target="_blank" rel="noopener noreferrer"
                      className="tp-btn-ghost flex-1 justify-center text-sm">
                      <Navigation className="w-4 h-4 text-info" /> Waze <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile icon="🗺️" label="Miles" value={stats.totalMiles > 0 ? stats.totalMiles.toLocaleString() : '–'} />
                <StatTile icon="⏱️" label="Drive Time" value={stats.totalDrivingHours > 0 ? `${stats.totalDrivingHours}h` : '–'} />
                <StatTile icon="⛽" label="Fuel" value={stats.totalFuelCost > 0 ? `$${stats.totalFuelCost}` : '–'} />
                <StatTile icon="✅" label="Done" value={`${daysComplete}/${trip.days?.length || 0}`} />
              </div>
            </div>

            {/* Day list sidebar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">Days</h2>
                  <span className="text-xs text-ink-3">{daysComplete}/{trip.days?.length || 0} complete</span>
                </div>
                <div role="radiogroup" aria-label="Days view" className="flex p-0.5 rounded-lg bg-ink/5 text-xs">
                  {(['list', 'timeline'] as const).map(v => (
                    <button key={v} type="button" role="radio" aria-checked={dayView === v} onClick={() => chooseDayView(v)}
                      className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-md capitalize',
                        dayView === v ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink')}>
                      {v === 'list' ? <List className="w-3.5 h-3.5" /> : <GitCommitVertical className="w-3.5 h-3.5" />}{v}
                    </button>
                  ))}
                </div>
              </div>
              {dayView === 'list' ? (
                <div className="space-y-2 lg:max-h-[700px] lg:overflow-y-auto lg:pr-1">
                  {trip.days?.map(day => (
                    <DayRow key={day.id} day={day} tripId={tripId} isRoadTrip={trip.type === 'road_trip'}
                      lodging={lodgingForDate(trip.lodgings, day.date)}
                      onToggleVisited={() => handleMarkVisited(day)} />
                  ))}
                </div>
              ) : (
                <div className="tp-card lg:max-h-[700px] lg:overflow-y-auto">
                  <TripTimeline trip={trip} />
                </div>
              )}

              {(trip.visitedCities?.length ?? 0) > 0 && (
                <div className="tp-card mt-4">
                  <div className="text-xs font-medium text-ink/40 uppercase tracking-wide mb-2">Cities Visited</div>
                  <div className="flex flex-wrap gap-1.5">
                    {trip.visitedCities!.map(city => (
                      <span key={city} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-ink/5 text-xs text-ink/70">
                        <MapPin className="w-3 h-3 text-accent" />{city}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trip.vehicle && (
                <div className="tp-card">
                  <div className="text-xs font-medium text-ink/40 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" /> Vehicle
                  </div>
                  <div className="text-sm font-medium text-ink">
                    {trip.vehicle.year && `${trip.vehicle.year} `}{trip.vehicle.make} {trip.vehicle.model}
                  </div>
                  <div className="text-xs text-ink/40 mt-1">{trip.vehicle.fuelEfficiency} MPG · {trip.vehicle.tankSize}gal · {trip.vehicle.fuelType}</div>
                  <div className="mt-1.5 text-xs text-accent">Range ~{Math.round(trip.vehicle.fuelEfficiency * trip.vehicle.tankSize)} miles/tank</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'photos' && (
          <div className="max-w-4xl">
            <ImmichPanel tripId={tripId} startDate={trip.startDate} endDate={trip.endDate} />
          </div>
        )}

        {tab === 'lodging' && (
          <div className="max-w-2xl">
            <LodgingPanel trip={trip} onUpdate={handleLodgingUpdate} />
          </div>
        )}

        {tab === 'packing' && (
          <div className="max-w-2xl">
            <PackingListPanel tripId={tripId} tripType={trip.type} />
          </div>
        )}

        {tab === 'budget' && (
          <div className="max-w-2xl">
            <BudgetPanel tripId={tripId} trip={trip} />
          </div>
        )}
      </div>
      {todayDay && <QuickAdd tripId={tripId} day={todayDay} onSaved={load} />}
    </div>
  )
}
