// app/trips/[id]/day/[dayId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Plus, Edit2, Trash2, Map, Navigation,
  Fuel, Clock, DollarSign, CheckCircle2, Circle,
  ChevronRight, ExternalLink, Car, Plane, Train,
  Camera, Calendar, Globe, Route, X, Mail,
  Eye, MapPin, Cloud, Receipt, Loader2, Check
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import MapView from '@/components/MapView'
import SegmentEditor from '@/components/SegmentEditor'
import StopPanel from '@/components/StopPanel'
import ActivityPanel from '@/components/ActivityPanel'
import WeatherCard from '@/components/WeatherCard'
import BudgetPanel from '@/components/BudgetPanel'
import ImmichPanel from '@/components/ImmichPanel'
import { getLodgingForDate } from '@/components/LodgingPanel'
import { Day, Trip, Segment, Activity, Photo, Lodging, TRANSPORT_ICONS, TRANSPORT_COLORS, Stop } from '@/lib/types'
import { getGoogleMapsUrl, getWazeUrl } from '@/lib/api'
import clsx from 'clsx'

type PanelTab = 'photos' | 'stops' | 'activities' | 'weather' | 'budget' | 'notes'

export default function DayPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string
  const dayId = params.dayId as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [day, setDay] = useState<Day | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<PanelTab>('photos')
  const [addingSegment, setAddingSegment] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [expandedSegId, setExpandedSegId] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null)

  const load = async () => {
    try {
      const [tripRes, tripData] = await Promise.all([
        fetch(`/api/trips/${tripId}`),
        fetch(`/api/trips/${tripId}`),
      ])
      const t: Trip = await tripRes.json()
      if (!t || !t.days) { router.push(`/trips/${tripId}`); return }
      const d = t.days.find((day: Day) => day.id === dayId)
      if (!d) { router.push(`/trips/${tripId}`); return }
      setTrip(t)
      setDay(d)
    } catch { router.push(`/trips/${tripId}`) }
    setLoading(false)
  }

  useEffect(() => { load() }, [tripId, dayId])

  const saveDay = async (updatedDay: Day) => {
    const res = await fetch(`/api/trips/${tripId}/days/${dayId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDay),
    })
    const saved = await res.json()
    setDay(saved)
    return saved
  }

  const handleSaveSegment = async (seg: Segment) => {
    if (!day) return
    let segments: Segment[]
    if (editingSegment) {
      segments = day.segments.map(s => s.id === seg.id ? seg : s)
    } else {
      segments = [...(day.segments || []), seg]
    }
    const updated = {
      ...day,
      segments,
      startCity: segments[0]?.from.city || segments[0]?.from.state || segments[0]?.from.name,
      endCity: segments[segments.length - 1]?.to.city || segments[segments.length - 1]?.to.state || segments[segments.length - 1]?.to.name,
    }
    await saveDay(updated)
    setAddingSegment(false)
    setEditingSegment(null)
  }

  const handleDeleteSegment = async (segId: string) => {
    if (!day) return
    const segments = day.segments.filter(s => s.id !== segId)
    await saveDay({ ...day, segments })
  }

  const handleUpdateStops = async (segId: string, stops: Stop[]) => {
    if (!day) return
    const segments = day.segments.map(s => s.id === segId ? { ...s, stops } : s)
    await saveDay({ ...day, segments })
  }

  const handleUpdateSegment = async (segId: string, patch: Partial<Segment>) => {
    if (!day) return
    const segments = day.segments.map(s => s.id === segId ? { ...s, ...patch } : s)
    await saveDay({ ...day, segments })
  }

  const handleActivity = async (act: Activity, action: 'add' | 'update' | 'delete') => {
    if (!day) return
    let activities: Activity[]
    if (action === 'add') activities = [...(day.activities || []), act]
    else if (action === 'update') activities = day.activities.map(a => a.id === act.id ? act : a)
    else activities = day.activities.filter(a => a.id !== act.id)
    await saveDay({ ...day, activities })
  }

  const handlePhoto = async (photo: Photo | string, action: 'add' | 'delete') => {
    if (!day) return
    let photos: Photo[]
    if (action === 'add') photos = [...(day.photos || []), photo as Photo]
    else photos = day.photos.filter(p => p.id !== (photo as string))
    await saveDay({ ...day, photos })
  }

  const handleNotesSave = async (notes: string) => {
    if (!day) return
    await saveDay({ ...day, notes })
  }

  const handleToggleVisited = async () => {
    if (!day) return
    await saveDay({ ...day, visited: !day.visited })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1121]">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (!trip || !day) return null

  const isRoadTrip = trip.type === 'road_trip'
  const totalMiles = day.segments?.reduce((s, seg) => s + (seg.distance || 0), 0) || 0
  const totalDriveMins = day.segments?.reduce((s, seg) => s + (seg.duration || 0), 0) || 0
  const totalFuel = day.segments?.reduce((s, seg) => s + (seg.fuelCost || 0), 0) || 0
  const totalCost = (day.segments?.reduce((s, seg) => s + (seg.cost || 0), 0) || 0) +
    (day.activities?.reduce((s, a) => s + (a.cost || 0), 0) || 0)

  const mapSegments = day.segments?.map(seg => ({ segment: seg })) || []
  const allStops = day.segments?.flatMap(s => s.stops) || []
  const firstSeg = day.segments?.[0]
  const lastSeg = day.segments?.[day.segments.length - 1]

  // Get coords for weather (first segment start point)
  const weatherLat = firstSeg?.from?.coords?.lat
  const weatherLng = firstSeg?.from?.coords?.lng
  const weatherLocation = firstSeg?.from?.city || firstSeg?.from?.name

  const dayLodging = getLodgingForDate((trip.lodgings as Lodging[]) || [], day.date)

  // Find previous day's end city for "same city" inherit
  const prevDay = trip.days?.find(d => d.dayNumber === day.dayNumber - 1)
  const prevDayCity = prevDay?.endCity || prevDay?.startCity

  const isCompleted = day.visited

  const TABS: { key: PanelTab; label: string; icon: string }[] = [
    { key: 'photos', label: 'Photos', icon: '🖼️' },
    ...(!isCompleted ? [
      { key: 'stops' as PanelTab, label: 'Stops', icon: '🛑' },
      { key: 'activities' as PanelTab, label: 'Things', icon: '🎡' },
    ] : []),
    { key: 'weather', label: 'Weather', icon: '🌤️' },
    { key: 'budget', label: 'Budget', icon: '💵' },
    { key: 'notes', label: 'Notes', icon: '📝' },
  ]

  return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link href={`/trips/${tripId}`}
            className="mt-1 p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/30 mb-0.5">{trip.name}</div>
            <h1 className="font-display text-2xl font-semibold text-white">
              Day {day.dayNumber}
              {day.title && ` · ${day.title}`}
            </h1>
            <div className="flex items-center gap-2 text-sm text-white/40 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}
              {(day.startCity || day.endCity) && (
                <>
                  <span className="opacity-30">·</span>
                  {day.startCity}
                  {day.startCity && day.endCity && <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />}
                  {day.endCity}
                </>
              )}
            </div>
            {dayLodging && (
              <div className="flex items-center gap-1.5 text-sm text-blue-400/70 mt-1">
                🏨 Base: <span className="font-medium text-blue-400">{dayLodging.name}</span>
                <span className="text-white/30 text-xs">· {dayLodging.location?.city || dayLodging.location?.name}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleToggleVisited}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all',
              day.visited
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-white/10 text-white/40 hover:border-green-500/30 hover:text-green-400'
            )}
          >
            {day.visited ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {day.visited ? 'Completed' : 'Mark done'}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left – map + segments */}
          <div className="xl:col-span-3 space-y-4">
            {/* Map */}
            <div className="tp-card p-0 overflow-hidden">
              <MapView segments={mapSegments} stops={allStops} height="380px" />
            </div>

            {/* Open in maps */}
            {firstSeg && lastSeg && (
              <div className="flex gap-2">
                <a href={getGoogleMapsUrl(firstSeg.from, lastSeg.to, [], day.segments)}
                  target="_blank" rel="noopener noreferrer" className="tp-btn-ghost flex-1 justify-center text-sm">
                  <Globe className="w-4 h-4 text-blue-400" /> Google Maps <ExternalLink className="w-3 h-3" />
                </a>
                <a href={getWazeUrl(lastSeg.to)}
                  target="_blank" rel="noopener noreferrer" className="tp-btn-ghost flex-1 justify-center text-sm">
                  <Navigation className="w-4 h-4 text-blue-400" /> Waze <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Inline weather strip */}
            {weatherLat && weatherLng && (
              <WeatherStrip dayDate={day.date} lat={weatherLat} lng={weatherLng} locationName={weatherLocation} />
            )}

            {/* Day stats */}
            {(totalMiles > 0 || totalCost > 0) && (
              <div className="grid grid-cols-4 gap-3">
                {totalMiles > 0 && isRoadTrip && <DayStat icon="🗺️" label="Miles" value={Math.round(totalMiles).toString()} />}
                {totalDriveMins > 0 && <DayStat icon="⏱️" label="Drive" value={`${Math.floor(totalDriveMins / 60)}h${Math.round(totalDriveMins % 60)}m`} />}
                {totalFuel > 0 && <DayStat icon="⛽" label="Fuel" value={`$${totalFuel.toFixed(2)}`} />}
                {totalCost > 0 && <DayStat icon="💵" label="Total" value={`$${totalCost.toFixed(2)}`} />}
              </div>
            )}

            {/* Segments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wide">Route Segments</h3>
                <button onClick={() => { setAddingSegment(true); setEditingSegment(null) }}
                  className="tp-btn text-xs py-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Leg
                </button>
              </div>

              {(day.segments?.length ?? 0) === 0 && !addingSegment && (
                <div className="tp-card text-center py-8 border-dashed space-y-3">
                  <Route className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <div className="text-sm text-white/40">No route segments yet</div>
                  {prevDayCity && (
                    <button
                      onClick={async () => {
                        const updated = {
                          ...day,
                          startCity: prevDayCity,
                          endCity: prevDayCity,
                        }
                        await saveDay(updated)
                      }}
                      className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
                    >
                      📍 Same city as yesterday — <span className="font-medium">{prevDayCity}</span>
                    </button>
                  )}
                  <div className="text-xs text-white/20">or add a leg below to plan travel</div>
                </div>
              )}

              {day.segments?.map(seg => (
                <SegmentCard
                  key={seg.id}
                  segment={seg}
                  isRoadTrip={isRoadTrip}
                  expanded={expandedSegId === seg.id}
                  onToggle={() => setExpandedSegId(expandedSegId === seg.id ? null : seg.id)}
                  onEdit={() => { setEditingSegment(seg); setAddingSegment(false) }}
                  onDelete={() => handleDeleteSegment(seg.id)}
                  onUpdateStops={stops => handleUpdateStops(seg.id, stops)}
                  onUpdateSegment={patch => handleUpdateSegment(seg.id, patch)}
                  vehicle={trip.vehicle}
                  onShowConfirmation={() => setShowConfirmation(seg.confirmationText || null)}
                />
              ))}

              {(addingSegment || editingSegment) && (
                <div className="tp-card border-emerald-500/20">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                    <Route className="w-4 h-4" />
                    {editingSegment ? 'Edit Segment' : 'New Segment'}
                  </h4>
                  <SegmentEditor
                    segment={editingSegment || undefined}
                    vehicle={trip.vehicle}
                    defaultFrom={day.segments && day.segments.length > 0 ? day.segments[day.segments.length - 1].to : undefined}
                    onSave={handleSaveSegment}
                    onCancel={() => { setAddingSegment(false); setEditingSegment(null) }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right – panel tabs */}
          <div className="xl:col-span-2">
            <div className="flex gap-1 mb-4 bg-white/5 p-1 rounded-xl overflow-x-auto">
              {TABS.map(({ key, label, icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    tab === key ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white/70'
                  )}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {tab === 'photos' && (
              <ImmichPanel tripId={tripId} dayDate={day.date} />
            )}

            {tab === 'stops' && (
              <div className="space-y-3">
                {(day.segments?.length ?? 0) === 0 ? (
                  <div className="tp-card text-center py-6 text-sm text-white/40">
                    Add a route segment first to manage stops
                  </div>
                ) : (
                  day.segments!.map(seg => (
                    <StopPanel key={seg.id} segment={seg} vehicle={trip.vehicle}
                      onUpdate={stops => handleUpdateStops(seg.id, stops)}
                      onUpdateSegment={patch => handleUpdateSegment(seg.id, patch)} />
                  ))
                )}
              </div>
            )}

            {tab === 'activities' && (
              <ActivityPanel
                activities={day.activities || []}
                cityName={day.endCity || day.startCity}
                onAdd={act => handleActivity(act, 'add')}
                onUpdate={act => handleActivity(act, 'update')}
                onDelete={id => handleActivity({ id } as Activity, 'delete')}
              />
            )}

            {tab === 'weather' && (
              <WeatherCard
                dayDate={day.date}
                locationName={weatherLocation}
                lat={weatherLat}
                lng={weatherLng}
              />
            )}

            {tab === 'budget' && (
              <BudgetPanel tripId={tripId} filterDayId={dayId} />
            )}

            {tab === 'notes' && (
              <DayNotes notes={day.notes || ''} onSave={handleNotesSave} />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirmation(null)}>
          <div className="bg-[#0f1929] border border-white/10 rounded-2xl p-6 max-w-2xl w-full"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-500" /> Confirmation Details
              </h3>
              <button onClick={() => setShowConfirmation(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="tp-input h-80 overflow-auto text-xs font-mono whitespace-pre-wrap">
              {showConfirmation}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

function SegmentCard({ segment: seg, isRoadTrip, expanded, onToggle, onEdit, onDelete, onUpdateStops, onUpdateSegment, onShowConfirmation, vehicle }: {
  segment: Segment; isRoadTrip: boolean; expanded: boolean
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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          {TRANSPORT_ICONS[seg.mode]}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-1.5 text-sm font-medium text-white">
            <span className="truncate">{seg.from.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{seg.to.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
            {seg.distance && <span>{Math.round(seg.distance)} mi</span>}
            {seg.duration && <span>{Math.floor(seg.duration / 60)}h {Math.round(seg.duration % 60)}m</span>}
            {seg.cost && <span className="text-green-400">${seg.cost.toFixed(2)}</span>}
            {seg.carrier && <span>{seg.carrier} {seg.flightNumber}</span>}
            {seg.stops?.length > 0 && <span>{seg.stops.length} stop{seg.stops.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {seg.confirmationText && (
            <button onClick={onShowConfirmation} className="p-1.5 text-white/30 hover:text-emerald-400 transition-colors">
              <Mail className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-white/30 hover:text-emerald-400 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-white/30 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/6 space-y-3">
          {isRoadTrip && (seg.fuelCost || seg.tollCost) && (
            <div className="grid grid-cols-3 gap-2">
              {seg.fuelGallons && <Detail label="Gallons" value={`${seg.fuelGallons.toFixed(2)} gal`} />}
              {seg.fuelCost && <Detail label="Fuel Cost" value={`$${seg.fuelCost.toFixed(2)}`} />}
              {seg.tollCost && <Detail label="Tolls" value={`$${seg.tollCost.toFixed(2)}`} />}
            </div>
          )}
          {seg.departureTime && <Detail label="Departs" value={new Date(seg.departureTime).toLocaleString()} />}
          {seg.arrivalTime && <Detail label="Arrives" value={new Date(seg.arrivalTime).toLocaleString()} />}
          {seg.bookingRef && <Detail label="Ref #" value={seg.bookingRef} />}
          {seg.notes && <div className="text-xs text-white/40 italic">{seg.notes}</div>}
          {isRoadTrip && <StopPanel segment={seg} onUpdate={onUpdateStops} onUpdateSegment={onUpdateSegment} />}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/4 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
      <div className="text-xs font-medium text-white/80">{value}</div>
    </div>
  )
}

function DayStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="tp-card flex flex-col items-center gap-0.5 py-3">
      <span className="text-base">{icon}</span>
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function DayNotes({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [value, setValue] = useState(notes)
  const [saved, setSaved] = useState(true)

  return (
    <div className="space-y-2">
      <label className="text-white/50 text-xs uppercase tracking-wide">Day Notes</label>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        className="tp-input h-48 resize-none w-full"
        placeholder="Notes for the day — observations, tips, memories…"
      />
      <button
        onClick={() => { onSave(value); setSaved(true) }}
        disabled={saved}
        className="tp-btn w-full justify-center disabled:opacity-50"
      >
        {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Notes'}
      </button>
    </div>
  )
}

// ── Inline weather strip ────────────────────────────────────────────────────
function WeatherStrip({ dayDate, lat, lng, locationName }: {
  dayDate: string; lat: number; lng: number; locationName?: string
}) {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/weather?lat=${lat}&lng=${lng}&start=${dayDate}&end=${dayDate}`)
      .then(r => r.json())
      .then(d => setWeather(d[0] || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lng, dayDate])

  if (loading) return (
    <div className="tp-card px-4 py-3 flex items-center gap-2 text-white/30 text-sm animate-pulse">
      🌡️ Loading weather…
    </div>
  )
  if (!weather) return null

  const hot = weather.tempMax >= 90
  const cold = weather.tempMax <= 40
  const rainy = weather.precipitation > 0.2

  return (
    <div className="tp-card px-4 py-3 flex items-center gap-4">
      <span className="text-3xl">{weather.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{weather.tempMax}°F</span>
          <span className="text-white/40 text-sm">/ {weather.tempMin}°F</span>
          <span className="text-white/50 text-sm">{weather.description}</span>
          {locationName && <span className="text-white/30 text-xs truncate">· {locationName}</span>}
        </div>
        <div className="flex gap-2 mt-0.5">
          {rainy && <span className="text-xs text-blue-400">☔ {weather.precipitation}" rain</span>}
          {hot && <span className="text-xs text-orange-400">🌡️ Hot day</span>}
          {cold && <span className="text-xs text-blue-300">🧥 Cold</span>}
        </div>
      </div>
    </div>
  )
}
