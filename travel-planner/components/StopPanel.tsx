// components/StopPanel.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Map, Check, Star, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Stop, StopType, Segment, GeoLocation, STOP_TYPE_ICONS } from '@/lib/types'
import { getRoute, calculateFuelCost, estimateTolls, FUEL_PRICES } from '@/lib/api'
import LocationSearch from './LocationSearch'
import clsx from 'clsx'

const STOP_TYPES: { type: StopType; label: string }[] = [
  { type: 'rest_area', label: 'Rest Areas' },
  { type: 'gas_station', label: 'Gas' },
  { type: 'food', label: 'Food' },
  { type: 'attraction', label: 'Attractions' },
  { type: 'scenic', label: 'Scenic' },
  { type: 'national_park', label: "Nat'l Parks" },
  { type: 'historical', label: 'History' },
  { type: 'bucees', label: "Buc-ee's" },
]

interface StopPanelProps {
  segment: Segment
  vehicle?: { fuelEfficiency: number; fuelType: string }
  onUpdate: (stops: Stop[]) => void
  onUpdateSegment?: (patch: Partial<Segment>) => void
}

export default function StopPanel({ segment, vehicle, onUpdate, onUpdateSegment }: StopPanelProps) {
  const [stops, setStops] = useState<Stop[]>(segment.stops || [])
  const [suggestions, setSuggestions] = useState<Stop[]>([])
  const [loading, setLoading] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [selectedPrefs, setSelectedPrefs] = useState<StopType[]>(['rest_area', 'gas_station', 'food', 'attraction'])
  const [addingManual, setAddingManual] = useState(false)
  const [manualLoc, setManualLoc] = useState<GeoLocation | null>(null)
  const [manualType, setManualType] = useState<StopType>('attraction')
  const [manualNotes, setManualNotes] = useState('')
  const [expanded, setExpanded] = useState(true)

  const recalcRoute = async (newStops: Stop[]) => {
    if (!segment.from || !segment.to || segment.mode !== 'drive' || !onUpdateSegment) return
    setRecalcing(true)
    try {
      const waypoints = newStops.map(s => s.location.coords)
      const result = await getRoute(segment.from.coords, segment.to.coords, waypoints)
      if (!result) return
      const fuelPrice = vehicle ? FUEL_PRICES[vehicle.fuelType as keyof typeof FUEL_PRICES] ?? FUEL_PRICES.regular : FUEL_PRICES.regular
      const mpg = vehicle?.fuelEfficiency || 28
      const { gallons, cost: fuelCost } = calculateFuelCost(result.distanceMiles, mpg, fuelPrice)
      const tollCost = estimateTolls(result.distanceMiles)
      onUpdateSegment({
        stops: newStops,
        distance: Math.round(result.distanceMiles * 10) / 10,
        duration: Math.round(result.durationMinutes),
        routeCoords: result.coords,
        fuelCost, fuelGallons: gallons, tollCost,
        cost: fuelCost + tollCost,
      })
    } catch (err) {
      console.error('Route recalc error:', err)
    } finally {
      setRecalcing(false)
    }
  }

  const handleFetchSuggestions = async () => {
    if (!segment.from || !segment.to) return
    setLoading(true)
    setSuggestions([])
    try {
      const res = await fetch('/api/stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: segment.from.coords,
          to: segment.to.coords,
          preferences: selectedPrefs,
          routeCoords: segment.routeCoords || [],
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch stops')
      const suggested: Stop[] = await res.json()
      // Filter out already-added stops
      setSuggestions(suggested.filter(s => !stops.find(e => e.osmId === s.osmId)))
    } catch (err) {
      console.error('Stop fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const addSuggestion = async (stop: Stop) => {
    const updated = [...stops, stop]
    setStops(updated)
    setSuggestions(prev => prev.filter(s => s.id !== stop.id))
    onUpdate(updated)
    if (segment.mode === 'drive') await recalcRoute(updated)
  }

  const dismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  const togglePref = (type: StopType) => {
    setSelectedPrefs(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const toggleVisited = (id: string) => {
    const updated = stops.map(s => s.id === id ? { ...s, visited: !s.visited } : s)
    setStops(updated)
    onUpdate(updated)
  }

  const removeStop = async (id: string) => {
    const updated = stops.filter(s => s.id !== id)
    setStops(updated)
    onUpdate(updated)
    if (segment.mode === 'drive') await recalcRoute(updated)
  }

  const addManualStop = async () => {
    if (!manualLoc) return
    const stop: Stop = {
      id: uuidv4(), location: manualLoc, type: manualType,
      name: manualLoc.name, notes: manualNotes || undefined,
      visited: false, isAutoSuggested: false,
    }
    const updated = [...stops, stop]
    setStops(updated)
    onUpdate(updated)
    setAddingManual(false)
    setManualLoc(null)
    setManualNotes('')
    if (segment.mode === 'drive') await recalcRoute(updated)
  }

  return (
    <div className="tp-card">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#f1f5f9] flex items-center gap-2">
          <Map className="w-4 h-4 text-emerald-500" />
          Stops & Points of Interest
          {stops.length > 0 && (
            <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{stops.length}</span>
          )}
          {recalcing && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin ml-1" />}
        </h4>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">

          {/* Preference selector */}
          <div>
            <label className="tp-label mb-2">What to look for</label>
            <div className="flex flex-wrap gap-1.5">
              {STOP_TYPES.map(({ type, label }) => (
                <button key={type} onClick={() => togglePref(type)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    selectedPrefs.includes(type)
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#111827] border-[#1e293b] text-[#64748b] hover:border-[#2d3f5a]'
                  )}>
                  {STOP_TYPE_ICONS[type]} {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleFetchSuggestions} disabled={loading || !segment.from || !segment.to}
            className="tp-btn-primary w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            {loading ? 'Searching route…' : 'Find Stops on Route'}
          </button>

          {/* Suggestions — pick to add */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/40 uppercase tracking-wide">
                  {suggestions.length} suggestions — tap + to add
                </div>
                <button onClick={() => setSuggestions([])} className="text-xs text-white/30 hover:text-white/60">
                  Clear all
                </button>
              </div>
              {suggestions.map(stop => (
                <div key={stop.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-white/10 bg-white/2 group">
                  <span className="text-base leading-none shrink-0">{STOP_TYPE_ICONS[stop.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/70 truncate">{stop.name}</div>
                    <div className="text-xs text-white/30 capitalize">{stop.type.replace('_', ' ')}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => addSuggestion(stop)}
                      className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Add to trip">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => dismissSuggestion(stop.id)}
                      className="p-1.5 rounded-lg text-white/20 hover:text-white/50 transition-colors"
                      title="Dismiss">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Added stops */}
          {stops.length > 0 && (
            <div className="space-y-2">
              {suggestions.length > 0 && (
                <div className="text-xs font-medium text-white/40 uppercase tracking-wide">Added to trip</div>
              )}
              {stops.map(stop => (
                <div key={stop.id}
                  className={clsx('flex items-start gap-2 p-2.5 rounded-lg border transition-all',
                    stop.visited ? 'bg-green-500/5 border-green-500/20 opacity-60' : 'bg-[#111827] border-[#1e293b]')}>
                  <span className="text-base leading-none mt-0.5">{STOP_TYPE_ICONS[stop.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[#f1f5f9] truncate">{stop.name}</span>
                    </div>
                    <div className="text-xs text-[#475569] capitalize">{stop.type.replace('_', ' ')}</div>
                    {stop.notes && <div className="text-xs text-[#64748b] mt-0.5 italic">{stop.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleVisited(stop.id)}
                      className={clsx('p-1 rounded transition-colors',
                        stop.visited ? 'text-green-400 bg-green-500/10' : 'text-[#475569] hover:text-green-400')}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeStop(stop.id)}
                      className="p-1 rounded text-[#475569] hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual stop add */}
          {addingManual ? (
            <div className="bg-[#111827] rounded-xl p-3 space-y-3">
              <LocationSearch label="Location" onChange={setManualLoc} placeholder="Search for a stop…" />
              <div>
                <label className="tp-label">Type</label>
                <select value={manualType} onChange={e => setManualType(e.target.value as StopType)} className="tp-input">
                  {STOP_TYPES.map(({ type, label }) => <option key={type} value={type}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="tp-label">Notes</label>
                <input type="text" value={manualNotes} onChange={e => setManualNotes(e.target.value)}
                  className="tp-input" placeholder="Why you're stopping here…" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAddingManual(false)} className="tp-btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={addManualStop} disabled={!manualLoc} className="tp-btn-primary flex-1 justify-center">Add Stop</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingManual(true)} className="tp-btn-ghost w-full justify-center text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Stop Manually
            </button>
          )}
        </div>
      )}
    </div>
  )
}
