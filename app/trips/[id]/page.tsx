// app/trips/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO, addDays, differenceInDays } from 'date-fns'
import {
  ArrowLeft, Car, Plane, Train, Layers, CalendarDays,
  MapPin, Fuel, ExternalLink, ChevronRight, ChevronDown,
  CheckCircle2, Circle, Trash2, Navigation,
  Globe, Package, Receipt, Loader2, Hotel, Edit2,
  X, Check, Plus
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import Navbar from '@/components/Navbar'
import MapView from '@/components/MapView'
import PackingListPanel from '@/components/PackingListPanel'
import BudgetPanel from '@/components/BudgetPanel'
import LodgingPanel from '@/components/LodgingPanel'
import ImmichPanel from '@/components/ImmichPanel'
import TripTimeline from '@/components/TripTimeline'
import { Trip, Day, Lodging, Segment, TRANSPORT_ICONS } from '@/lib/types'
import { getGoogleMapsUrl, getWazeUrl } from '@/lib/api'
import { getTripStats } from '@/lib/storage'
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

  const load = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) { router.push('/'); return }
      const t = await res.json()
      setTrip(t)
      setNewStart(t.startDate)
      setNewEnd(t.endDate)
    } catch { router.push('/') }
    setLoading(false)
  }

  useEffect(() => { load() }, [tripId])

  const handleMarkVisited = async (day: Day) => {
    if (!trip) return
    await fetch(`/api/trips/${tripId}/days/${day.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...day, visited: !day.visited }),
    })
    load()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${trip?.name}"? This cannot be undone.`)) return
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
    router.push('/')
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
    const oldDays = trip.days.length
    const newDays = Math.max(1, differenceInDays(new Date(newEnd), new Date(newStart)) + 1)
    const diff = newDays - oldDays
    if (diff === 0) { applyDateChange(); return }
    setDateConfirm({ add: Math.max(0, diff), remove: Math.max(0, -diff) })
  }

  const applyDateChange = async () => {
    if (!trip) return
    setSavingDates(true)
    try {
      const newDayCount = Math.max(1, differenceInDays(new Date(newEnd), new Date(newStart)) + 1)
      let days = [...trip.days]

      if (newDayCount > days.length) {
        for (let i = days.length; i < newDayCount; i++) {
          const newDay: Day = {
            id: uuidv4(), date: format(addDays(new Date(newStart), i), 'yyyy-MM-dd'),
            dayNumber: i + 1, segments: [], activities: [], photos: [], visited: false,
          }
          days.push(newDay)
          await fetch(`/api/trips/${tripId}/days/${newDay.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDay),
          })
        }
      } else if (newDayCount < days.length) {
        const toRemove = days.slice(newDayCount)
        days = days.slice(0, newDayCount)
        for (const d of toRemove) {
          await fetch(`/api/trips/${tripId}/days/${d.id}`, { method: 'DELETE' })
        }
      }

      days = days.map((d, i) => ({
        ...d, dayNumber: i + 1,
        date: format(addDays(new Date(newStart), i), 'yyyy-MM-dd'),
      }))
      for (const d of days) {
        await fetch(`/api/trips/${tripId}/days/${d.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(d),
        })
      }
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trip, startDate: newStart, endDate: newEnd, days }),
      })
      setEditingDates(false)
      setDateConfirm(null)
      load()
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
  const stats = getTripStats(trip)
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
                    {Math.max(1, differenceInDays(new Date(newEnd), new Date(newStart)) + 1)} days (currently {trip.days.length})
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
                <MiniStat icon="🗺️" label="Miles" value={stats.totalMiles > 0 ? stats.totalMiles.toLocaleString() : '–'} />
                <MiniStat icon="⏱️" label="Drive Time" value={stats.totalDrivingHours > 0 ? `${stats.totalDrivingHours}h` : '–'} />
                <MiniStat icon="⛽" label="Fuel" value={stats.totalFuelCost > 0 ? `$${stats.totalFuelCost}` : '–'} />
                <MiniStat icon="✅" label="Done" value={`${daysComplete}/${trip.days?.length || 0}`} />
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
                    lodging={(trip.lodgings as Lodging[] || []).find(l => l.checkIn <= day.date && day.date <= l.checkOut)}
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

// ── Day Row with legs + stops ─────────────────────────────────────────────────
function DayRow({ day, tripId, isRoadTrip, lodging, onToggleVisited }: {
  day: Day; tripId: string; isRoadTrip: boolean; lodging?: Lodging; onToggleVisited: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const totalDist = day.segments?.reduce((s, seg) => s + (seg.distance || 0), 0) || 0
  const totalCost = (day.segments?.reduce((s, seg) => s + (seg.cost || 0), 0) || 0) +
    (day.activities?.reduce((s, a) => s + (a.cost || 0), 0) || 0)
  const hasLegs = (day.segments?.length ?? 0) > 0

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-all',
      day.visited ? 'border-green-500/20 bg-green-500/3' : 'border-white/8 bg-white/3 hover:border-emerald-500/30')}>
      <div className="flex items-stretch">
        <div className={clsx('w-14 flex flex-col items-center justify-center py-3 border-r',
          day.visited ? 'border-green-500/20 bg-green-500/5' : 'border-white/6 bg-white/4')}>
          <div className="text-xs text-white/30 uppercase tracking-wide">Day</div>
          <div className={clsx('text-xl font-bold', day.visited ? 'text-green-400' : 'text-emerald-500')}>{day.dayNumber}</div>
        </div>
        <Link href={`/trips/${tripId}/day/${day.id}`} className="flex-1 px-3 py-3 min-w-0">
          <div className="text-xs text-white/30 mb-0.5">{format(parseISO(day.date), 'EEE, MMM d')}</div>
          {day.startCity || day.endCity ? (
            <div className="text-sm font-medium text-white flex items-center gap-1.5 truncate">
              {day.startCity && <span>{day.startCity}</span>}
              {day.startCity && day.endCity && day.startCity !== day.endCity && <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              {day.endCity && day.endCity !== day.startCity && <span>{day.endCity}</span>}
            </div>
          ) : lodging ? (
            <div className="text-sm text-white/60 flex items-center gap-1 truncate">
              <Hotel className="w-3 h-3 text-blue-400 shrink-0" />{lodging.name}
            </div>
          ) : (
            <div className="text-sm text-white/30 italic">No route yet</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {hasLegs && (
              <span className="text-xs text-white/30">
                {day.segments!.map(s => TRANSPORT_ICONS[s.mode]).join(' ')} {day.segments!.length} leg{day.segments!.length !== 1 ? 's' : ''}
              </span>
            )}
            {totalDist > 0 && isRoadTrip && <span className="text-xs text-white/30">· {Math.round(totalDist)}mi</span>}
            {totalCost > 0 && <span className="text-xs text-green-400">· ${totalCost.toFixed(0)}</span>}
          </div>
        </Link>
        <div className="flex flex-col items-center justify-center gap-1 pr-2">
          {hasLegs && (
            <button onClick={e => { e.preventDefault(); setExpanded(x => !x) }}
              className="p-1 text-white/20 hover:text-white/50">
              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
          <button onClick={e => { e.preventDefault(); onToggleVisited() }}
            className="p-1 text-white/30 hover:text-green-400 transition-colors">
            {day.visited ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Circle className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded legs + stops */}
      {expanded && hasLegs && (
        <div className="border-t border-white/6 px-4 py-3 space-y-2">
          {day.segments!.map((seg, si) => (
            <div key={seg.id} className="text-xs">
              <div className="flex items-center gap-1.5 text-white/60 font-medium">
                <span>{TRANSPORT_ICONS[seg.mode]}</span>
                <span>{seg.from?.city || seg.from?.name}</span>
                <ChevronRight className="w-3 h-3 text-emerald-500/50" />
                <span>{seg.to?.city || seg.to?.name}</span>
                {seg.distance && <span className="text-white/30 ml-1">· {Math.round(seg.distance)}mi</span>}
              </div>
              {(seg.stops?.length ?? 0) > 0 && (
                <div className="ml-5 mt-1 space-y-0.5">
                  {seg.stops!.map(stop => (
                    <div key={stop.id} className="flex items-center gap-1.5 text-white/30">
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

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="tp-card flex flex-col items-center gap-1 py-3">
      <span className="text-base">{icon}</span>
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
    </div>
  )
}
