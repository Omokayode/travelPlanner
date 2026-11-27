// app/trips/[id]/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Car, Plane, Train, Layers, CalendarDays, MapPin, ExternalLink, Trash2, Navigation, Globe, Loader2, Edit2, X, Check, Plus } from 'lucide-react'
import Navbar from '@/components/Navbar'
import MapView from '@/components/MapView'
import PackingListPanel from '@/components/PackingListPanel'
import BudgetPanel from '@/components/BudgetPanel'
import LodgingPanel from '@/components/LodgingPanel'
import ImmichPanel from '@/components/ImmichPanel'
import TripTimeline from '@/components/TripTimeline'
import { Trip, Day, Lodging } from '@/lib/types'
import { getGoogleMapsUrl, getWazeUrl } from '@/lib/api'
import { lodgingForDate, tripStats } from '@/lib/domain/trip'
import { daysInclusive, isIsoDate } from '@/lib/domain/dates'
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
    if (!confirm(`Delete "${trip?.name}"? This cannot be undone.`)) return
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
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
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
  const isCompleted = daysComplete === (trip.days?.length || 0) && daysComplete > 0

  return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link href="/" className="mt-1 p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-medium text-white/40 uppercase tracking-wide">{trip.type.replace('_', ' ')}</span>
              {isCompleted && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Completed</span>}
            </div>
            <h1 className="font-display text-3xl font-semibold text-white leading-tight">{trip.name}</h1>
            <div className="flex items-center gap-2 text-sm text-white/40 mt-1 flex-wrap">
              <CalendarDays className="w-4 h-4" />
              {format(parseISO(trip.startDate), 'MMM d')} – {format(parseISO(trip.endDate), 'MMM d, yyyy')}
              <span className="opacity-30">·</span>{trip.days?.length || 0} days
              {trip.vehicle && <><span className="opacity-30">·</span>{trip.vehicle.make} {trip.vehicle.model}</>}
              <button onClick={openDateEdit} className="text-emerald-400/60 hover:text-emerald-400 flex items-center gap-1 ml-1">
                <Edit2 className="w-3 h-3" /> Edit dates
              </button>
            </div>
          </div>
          <button onClick={handleDelete} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Date edit modal */}
        {editingDates && (
          <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
            <div className="bg-[#0f1929] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Edit Trip Dates</h3>
                <button onClick={() => { setEditingDates(false); setDateConfirm(null) }} className="text-white/40 hover:text-white/70">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!dateConfirm ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Start date</label>
                      <input type="date" className="tp-input w-full" value={newStart} onChange={e => setNewStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">End date</label>
                      <input type="date" className="tp-input w-full" value={newEnd} min={newStart} onChange={e => setNewEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="text-white/40 text-sm">
                    {isIsoDate(newStart) && isIsoDate(newEnd) && newEnd >= newStart ? daysInclusive(newStart, newEnd) : '–'} days (currently {trip.days.length})
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingDates(false)} className="px-4 py-2 text-sm text-white/50">Cancel</button>
                    <button onClick={checkDateChange} className="tp-btn text-sm">Review changes</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="tp-card p-4 space-y-2">
                    <div className="text-white/70 text-sm">Applying this change will:</div>
                    {dateConfirm.add > 0 && <div className="text-green-400 text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add {dateConfirm.add} day{dateConfirm.add !== 1 ? 's' : ''} at the end</div>}
                    {dateConfirm.remove > 0 && <div className="text-red-400 text-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Remove {dateConfirm.remove} day{dateConfirm.remove !== 1 ? 's' : ''} from the end</div>}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setDateConfirm(null)} className="px-4 py-2 text-sm text-white/50">Back</button>
                    <button onClick={applyDateChange} disabled={savingDates} className="tp-btn text-sm flex items-center gap-2 disabled:opacity-50">
                      {savingDates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl w-fit overflow-x-auto">
          {([
            ['itinerary', 'Itinerary', '🗺️'],
            ['photos', 'Photos', '🖼️'],
            ['lodging', 'Lodging', '🏨'],
            ['packing', 'Packing', '🎒'],
            ['budget', 'Budget', '💵'],
          ] as const).map(([t, label, icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                tab === t ? 'bg-emerald-500 text-white' : 'text-white/50 hover:text-white/80')}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'itinerary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map + stats */}
            <div className="lg:col-span-2 space-y-4">
              <div className="tp-card p-0 overflow-hidden">
                <MapView segments={allMapSegments} stops={allStops} height="420px" />
              </div>
              {firstSeg && lastSeg && (
                <div className="flex gap-2">
                  <a href={getGoogleMapsUrl(firstSeg.from, lastSeg.to, [], allMapSegments.map(s => s.segment))}
                    target="_blank" rel="noopener noreferrer"
                    className="tp-btn-ghost flex-1 justify-center text-sm">
                    <Globe className="w-4 h-4 text-blue-400" /> Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                  {lastSeg && (
                    <a href={getWazeUrl(lastSeg.to)} target="_blank" rel="noopener noreferrer"
                      className="tp-btn-ghost flex-1 justify-center text-sm">
                      <Navigation className="w-4 h-4 text-blue-400" /> Waze <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <StatTile icon="🗺️" label="Miles" value={stats.totalMiles > 0 ? stats.totalMiles.toLocaleString() : '–'} />
                <StatTile icon="⏱️" label="Drive Time" value={stats.totalDrivingHours > 0 ? `${stats.totalDrivingHours}h` : '–'} />
                <StatTile icon="⛽" label="Fuel" value={stats.totalFuelCost > 0 ? `$${stats.totalFuelCost}` : '–'} />
                <StatTile icon="✅" label="Done" value={`${daysComplete}/${trip.days?.length || 0}`} />
              </div>

              {/* Timeline */}
              <TripTimeline trip={trip} />
            </div>

            {/* Day list sidebar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-xl font-semibold text-white">Days</h2>
                <span className="text-xs text-white/30">{daysComplete}/{trip.days?.length || 0} complete</span>
              </div>
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {trip.days?.map(day => (
                  <DayRow key={day.id} day={day} tripId={tripId} isRoadTrip={trip.type === 'road_trip'}
                    lodging={lodgingForDate(trip.lodgings, day.date)}
                    onToggleVisited={() => handleMarkVisited(day)} />
                ))}
              </div>

              {(trip.visitedCities?.length ?? 0) > 0 && (
                <div className="tp-card mt-4">
                  <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">Cities Visited</div>
                  <div className="flex flex-wrap gap-1.5">
                    {trip.visitedCities!.map(city => (
                      <span key={city} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-xs text-white/70">
                        <MapPin className="w-3 h-3 text-emerald-500" />{city}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trip.vehicle && (
                <div className="tp-card">
                  <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" /> Vehicle
                  </div>
                  <div className="text-sm font-medium text-white">
                    {trip.vehicle.year && `${trip.vehicle.year} `}{trip.vehicle.make} {trip.vehicle.model}
                  </div>
                  <div className="text-xs text-white/40 mt-1">{trip.vehicle.fuelEfficiency} MPG · {trip.vehicle.tankSize}gal · {trip.vehicle.fuelType}</div>
                  <div className="mt-1.5 text-xs text-emerald-400">Range ~{Math.round(trip.vehicle.fuelEfficiency * trip.vehicle.tankSize)} miles/tank</div>
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
    </div>
  )
}
