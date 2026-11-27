// app/trips/[id]/day/[dayId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Dialog from '@/components/ui/Dialog'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Plus, Navigation, CheckCircle2, Circle, ChevronRight, ExternalLink, Calendar, Globe, Route, Mail, Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import MapView from '@/components/MapView'
import SegmentEditor from '@/components/SegmentEditor'
import StopPanel from '@/components/StopPanel'
import ActivityPanel from '@/components/ActivityPanel'
import WeatherCard from '@/components/WeatherCard'
import BudgetPanel from '@/components/BudgetPanel'
import ImmichPanel from '@/components/ImmichPanel'
import { dayStops, dayTotals, lodgingForDate } from '@/lib/domain/trip'
import { Day, Trip, Segment, Activity, Stop } from '@/lib/types'
import { getGoogleMapsUrl, getWazeUrl } from '@/lib/api'
import { api, ApiError, reportError } from '@/lib/client'
import StatTile from '@/components/ui/StatTile'
import SegmentCard from '@/components/day/SegmentCard'
import DayNotes from '@/components/day/DayNotes'
import WeatherStrip from '@/components/day/WeatherStrip'
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

  useEffect(() => {
    let alive = true
    api<Trip>(`/api/trips/${tripId}`)
      .then(t => {
        if (!alive) return
        const d = t.days?.find(x => x.id === dayId)
        if (!d) { router.push(`/trips/${tripId}`); return }
        setTrip(t)
        setDay(d)
      })
      .catch(err => {
        if (!alive) return
        reportError(err, 'Could not load this day')
        router.push(err instanceof ApiError && err.status === 404 ? '/' : `/trips/${tripId}`)
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [tripId, dayId, router])

  /** Saves the day; returns the saved day, or null (and shows the error) if it failed. */
  const saveDay = async (updatedDay: Day): Promise<Day | null> => {
    try {
      const saved = await api<Day>(`/api/trips/${tripId}/days/${dayId}`, 'PUT', updatedDay)
      setDay(saved)
      return saved
    } catch (err) {
      reportError(err, 'Could not save the day')
      return null
    }
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
    if (!(await saveDay(updated))) return // keep the editor open so nothing typed is lost
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
      <div className="min-h-screen bg-base">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </div>
    )
  }

  if (!trip || !day) return null

  const isRoadTrip = trip.type === 'road_trip'
  const { miles: totalMiles, driveMinutes: totalDriveMins, fuelCost: totalFuel, cost: totalCost } = dayTotals(day)

  const mapSegments = day.segments?.map(seg => ({ segment: seg })) || []
  const allStops = dayStops(day)
  const firstSeg = day.segments?.[0]
  const lastSeg = day.segments?.[day.segments.length - 1]

  // Get coords for weather (first segment start point)
  const weatherLat = firstSeg?.from?.coords?.lat
  const weatherLng = firstSeg?.from?.coords?.lng
  const weatherLocation = firstSeg?.from?.city || firstSeg?.from?.name

  const dayLodging = lodgingForDate(trip.lodgings, day.date)

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
    <div className="min-h-screen bg-base">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link href={`/trips/${tripId}`}
            className="mt-1 p-2 rounded-lg text-ink/30 hover:text-ink/70 hover:bg-ink/5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink/30 mb-0.5">{trip.name}</div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Day {day.dayNumber}
              {day.title && ` · ${day.title}`}
            </h1>
            <div className="flex items-center gap-2 text-sm text-ink/40 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}
              {(day.startCity || day.endCity) && (
                <>
                  <span className="opacity-30">·</span>
                  {day.startCity}
                  {day.startCity && day.endCity && <ChevronRight className="w-3.5 h-3.5 text-accent" />}
                  {day.endCity}
                </>
              )}
            </div>
            {dayLodging && (
              <div className="flex items-center gap-1.5 text-sm text-info/70 mt-1">
                🏨 Base: <span className="font-medium text-info">{dayLodging.name}</span>
                <span className="text-ink/30 text-xs">· {dayLodging.location?.city || dayLodging.location?.name}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleToggleVisited}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all',
              day.visited
                ? 'border-green-500/30 bg-green-500/10 text-ok'
                : 'border-ink/10 text-ink/40 hover:border-green-500/30 hover:text-ok'
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
                  <Globe className="w-4 h-4 text-info" /> Google Maps <ExternalLink className="w-3 h-3" />
                </a>
                <a href={getWazeUrl(lastSeg.to)}
                  target="_blank" rel="noopener noreferrer" className="tp-btn-ghost flex-1 justify-center text-sm">
                  <Navigation className="w-4 h-4 text-info" /> Waze <ExternalLink className="w-3 h-3" />
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
                {totalMiles > 0 && isRoadTrip && <StatTile icon="🗺️" label="Miles" value={Math.round(totalMiles).toString()} />}
                {totalDriveMins > 0 && <StatTile icon="⏱️" label="Drive" value={`${Math.floor(totalDriveMins / 60)}h${Math.round(totalDriveMins % 60)}m`} />}
                {totalFuel > 0 && <StatTile icon="⛽" label="Fuel" value={`$${totalFuel.toFixed(2)}`} />}
                {totalCost > 0 && <StatTile icon="💵" label="Total" value={`$${totalCost.toFixed(2)}`} />}
              </div>
            )}

            {/* Segments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink/50 uppercase tracking-wide">Route Segments</h3>
                <button onClick={() => { setAddingSegment(true); setEditingSegment(null) }}
                  className="tp-btn text-xs py-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Leg
                </button>
              </div>

              {(day.segments?.length ?? 0) === 0 && !addingSegment && (
                <div className="tp-card text-center py-8 border-dashed space-y-3">
                  <Route className="w-8 h-8 text-ink/10 mx-auto mb-2" />
                  <div className="text-sm text-ink/40">No route segments yet</div>
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
                      className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-ink/5 border border-ink/10 text-sm text-ink/60 hover:border-emerald-500/30 hover:text-accent transition-all"
                    >
                      📍 Same city as yesterday — <span className="font-medium">{prevDayCity}</span>
                    </button>
                  )}
                  <div className="text-xs text-ink/20">or add a leg below to plan travel</div>
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
                  <h4 className="text-sm font-semibold text-accent mb-4 flex items-center gap-2">
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
            <div className="flex gap-1 mb-4 bg-ink/5 p-1 rounded-xl overflow-x-auto">
              {TABS.map(({ key, label, icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    tab === key ? 'bg-emerald-500 text-white' : 'text-ink/40 hover:text-ink/70'
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
                  <div className="tp-card text-center py-6 text-sm text-ink/40">
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

      <Dialog open={!!showConfirmation} onClose={() => setShowConfirmation(null)} size="lg"
        title="Confirmation details" icon={<Mail className="w-5 h-5 text-accent" />}>
        <pre className="tp-input h-80 overflow-auto text-xs font-mono whitespace-pre-wrap">{showConfirmation}</pre>
      </Dialog>
    </div>
  )
}
