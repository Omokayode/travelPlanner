// components/SegmentEditor.tsx
'use client'

import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  Car, Plane, Train, Bus, Ship, Footprints,
  Loader2, Navigation, DollarSign, Fuel, X, Check,
  Clock, Route, AlertCircle, ChevronDown
} from 'lucide-react'
import { Segment, TransportMode, GeoLocation, Vehicle, TRANSPORT_ICONS, FuelType, FUEL_PRICES } from '@/lib/types'
import { getRoute, calculateFuelCost, estimateTolls } from '@/lib/api'
import LocationSearch from './LocationSearch'

const MODES: { mode: TransportMode; icon: React.ComponentType<any>; label: string }[] = [
  { mode: 'drive', icon: Car, label: 'Drive' },
  { mode: 'flight', icon: Plane, label: 'Flight' },
  { mode: 'train', icon: Train, label: 'Train' },
  { mode: 'bus', icon: Bus, label: 'Bus' },
  { mode: 'ferry', icon: Ship, label: 'Ferry' },
  { mode: 'walk', icon: Footprints, label: 'Walk' },
]

interface SegmentEditorProps {
  segment?: Segment
  vehicle?: Vehicle
  defaultFrom?: GeoLocation
  onSave: (segment: Segment) => void
  onCancel: () => void
}

export default function SegmentEditor({ segment, vehicle, defaultFrom, onSave, onCancel }: SegmentEditorProps) {
  const [mode, setMode] = useState<TransportMode>(segment?.mode || 'drive')
  const [from, setFrom] = useState<GeoLocation | null>(segment?.from || defaultFrom || null)
  const [to, setTo] = useState<GeoLocation | null>(segment?.to || null)
  const [distance, setDistance] = useState<number>(segment?.distance || 0)
  const [duration, setDuration] = useState<number>(segment?.duration || 0)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>(segment?.routeCoords || [])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [routeError, setRouteError] = useState('')

  // Cost fields
  const [cost, setCost] = useState<number>(segment?.cost || 0)
  const [fuelCost, setFuelCost] = useState<number>(segment?.fuelCost || 0)
  const [fuelGallons, setFuelGallons] = useState<number>(segment?.fuelGallons || 0)
  const [tollCost, setTollCost] = useState<number>(segment?.tollCost || 0)
  const [fuelPriceOverride, setFuelPriceOverride] = useState<number>(
    vehicle ? FUEL_PRICES[vehicle.fuelType] : FUEL_PRICES.regular
  )

  // Booking fields
  const [carrier, setCarrier] = useState(segment?.carrier || '')
  const [flightNumber, setFlightNumber] = useState(segment?.flightNumber || '')
  const [bookingRef, setBookingRef] = useState(segment?.bookingRef || '')
  const [departureTime, setDepartureTime] = useState(segment?.departureTime || '')
  const [arrivalTime, setArrivalTime] = useState(segment?.arrivalTime || '')
  const [confirmationText, setConfirmationText] = useState(segment?.confirmationText || '')
  const [notes, setNotes] = useState(segment?.notes || '')

  // Auto-calculate route when from/to set for drive mode
  useEffect(() => {
    if (from && to && mode === 'drive') {
      fetchRoute()
    }
  }, [from, to, mode])

  // Auto-recalc fuel when distance or price changes
  useEffect(() => {
    if (mode === 'drive' && distance > 0 && vehicle) {
      const { gallons, cost: fc } = calculateFuelCost(distance, vehicle.fuelEfficiency, fuelPriceOverride)
      setFuelGallons(gallons)
      setFuelCost(fc)
      const tolls = estimateTolls(distance)
      setTollCost(tolls)
      setCost(fc + tolls)
    }
  }, [distance, vehicle, fuelPriceOverride, mode])

  const fetchRoute = async () => {
    if (!from || !to) return
    setLoadingRoute(true)
    setRouteError('')
    try {
      const result = await getRoute(from.coords, to.coords)
      if (result) {
        setDistance(Math.round(result.distanceMiles * 10) / 10)
        setDuration(Math.round(result.durationMinutes))
        setRouteCoords(result.coords)
      } else {
        setRouteError('Could not get route. You can enter distance manually.')
      }
    } catch {
      setRouteError('Route fetch failed. Enter distance manually.')
    } finally {
      setLoadingRoute(false)
    }
  }

  const handleSave = () => {
    if (!from || !to) return
    const seg: Segment = {
      id: segment?.id || uuidv4(),
      from,
      to,
      mode,
      distance: distance || undefined,
      duration: duration || undefined,
      cost: cost || undefined,
      fuelCost: fuelCost || undefined,
      fuelGallons: fuelGallons || undefined,
      tollCost: tollCost || undefined,
      carrier: carrier || undefined,
      flightNumber: flightNumber || undefined,
      bookingRef: bookingRef || undefined,
      departureTime: departureTime || undefined,
      arrivalTime: arrivalTime || undefined,
      confirmationText: confirmationText || undefined,
      notes: notes || undefined,
      routeCoords: routeCoords.length > 0 ? routeCoords : undefined,
      stops: segment?.stops || [],
    }
    onSave(seg)
  }

  const isValid = from && to

  return (
    <div className="space-y-5">
      {/* Transport mode */}
      <div>
        <label className="tp-label">Mode of Transport</label>
        <div className="grid grid-cols-6 gap-1.5">
          {MODES.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all
                ${mode === m
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-[#111827] border-[#1e293b] text-[#64748b] hover:border-[#2d3f5a] hover:text-[#94a3b8]'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-2 gap-3">
        <LocationSearch
          label="From"
          value={from}
          onChange={setFrom}
          placeholder="Departure city…"
        />
        <LocationSearch
          label="To"
          value={to}
          onChange={setTo}
          placeholder="Destination city…"
        />
      </div>

      {/* Route info (drive mode) */}
      {mode === 'drive' && (
        <div className="bg-[#111827] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">Route Details</span>
            {from && to && (
              <button onClick={fetchRoute} disabled={loadingRoute}
                className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 disabled:opacity-50">
                {loadingRoute ? <Loader2 className="w-3 h-3 animate-spin" /> : <Route className="w-3 h-3" />}
                {loadingRoute ? 'Calculating…' : 'Recalculate'}
              </button>
            )}
          </div>
          {routeError && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {routeError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label">Distance (miles)</label>
              <input type="number" value={distance || ''} onChange={e => setDistance(parseFloat(e.target.value) || 0)}
                className="tp-input" placeholder="0" />
            </div>
            <div>
              <label className="tp-label">Drive Time (min)</label>
              <input type="number" value={duration || ''} onChange={e => setDuration(parseInt(e.target.value) || 0)}
                className="tp-input" placeholder="0" />
            </div>
          </div>

          {/* Fuel calculation */}
          {vehicle && (
            <div className="border-t border-[#1e293b] pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">Fuel Calculator</span>
                <span className="text-xs text-[#475569]">({vehicle.fuelEfficiency} mpg · {vehicle.fuelType})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="tp-label">Price/Gallon ($)</label>
                  <input type="number" step="0.01" value={fuelPriceOverride}
                    onChange={e => setFuelPriceOverride(parseFloat(e.target.value) || 0)}
                    className="tp-input" />
                </div>
                <div>
                  <label className="tp-label">Gallons</label>
                  <div className="tp-input text-emerald-400 font-medium">{fuelGallons.toFixed(2)}</div>
                </div>
                <div>
                  <label className="tp-label">Fuel Cost ($)</label>
                  <div className="tp-input text-emerald-400 font-medium">${fuelCost.toFixed(2)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="tp-label">Est. Tolls ($)</label>
                  <input type="number" step="0.01" value={tollCost}
                    onChange={e => setTollCost(parseFloat(e.target.value) || 0)}
                    className="tp-input" />
                  <div className="text-[10px] text-[#475569] mt-0.5">Auto-estimated • adjust as needed</div>
                </div>
                <div>
                  <label className="tp-label">Total Drive Cost ($)</label>
                  <div className="tp-input text-green-400 font-medium">${(fuelCost + tollCost).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flight / Train booking info */}
      {(mode === 'flight' || mode === 'train' || mode === 'bus' || mode === 'ferry') && (
        <div className="bg-[#111827] rounded-xl p-4 space-y-3">
          <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">Booking Details</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label">{mode === 'flight' ? 'Airline' : 'Operator'}</label>
              <input type="text" value={carrier} onChange={e => setCarrier(e.target.value)}
                className="tp-input" placeholder={mode === 'flight' ? 'Delta, United…' : 'Amtrak, Greyhound…'} />
            </div>
            {mode === 'flight' && (
              <div>
                <label className="tp-label">Flight Number</label>
                <input type="text" value={flightNumber} onChange={e => setFlightNumber(e.target.value)}
                  className="tp-input" placeholder="DL1234" />
              </div>
            )}
            <div>
              <label className="tp-label">Booking / Conf. Ref.</label>
              <input type="text" value={bookingRef} onChange={e => setBookingRef(e.target.value)}
                className="tp-input" placeholder="ABC123" />
            </div>
            <div>
              <label className="tp-label">Cost ($)</label>
              <input type="number" step="0.01" value={cost || ''} onChange={e => setCost(parseFloat(e.target.value) || 0)}
                className="tp-input" placeholder="0.00" />
            </div>
          </div>

          {/* FR24 flight lookup */}
          {mode === 'flight' && flightNumber && (
            <FlightLookup
              flightNumber={flightNumber}
              onFound={(data) => {
                if (data.airline) setCarrier(data.airline)
                if (data.departureScheduled) setDepartureTime(data.departureScheduled)
                if (data.arrivalScheduled) setArrivalTime(data.arrivalScheduled)
                if (data.durationMinutes) setDuration(data.durationMinutes)
                if (data.from?.coords?.lat && data.from?.coords?.lng) {
                  setFrom({
                    id: `airport_${data.from.iata}`,
                    name: `${data.from.iata} – ${data.from.name}`,
                    city: data.from.city,
                    coords: data.from.coords,
                  })
                }
                if (data.to?.coords?.lat && data.to?.coords?.lng) {
                  setTo({
                    id: `airport_${data.to.iata}`,
                    name: `${data.to.iata} – ${data.to.name}`,
                    city: data.to.city,
                    coords: data.to.coords,
                  })
                }
                // Use actual track points if available, else great-circle
                if (data.trackPoints?.length > 0) {
                  setRouteCoords(data.trackPoints)
                } else if (data.from?.coords && data.to?.coords) {
                  setRouteCoords(greatCircleArc(data.from.coords, data.to.coords))
                }
              }}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tp-label">Departure Time</label>
              <input type="datetime-local" value={departureTime} onChange={e => setDepartureTime(e.target.value)}
                className="tp-input" />
            </div>
            <div>
              <label className="tp-label">Arrival Time</label>
              <input type="datetime-local" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)}
                className="tp-input" />
            </div>
          </div>
          <div>
            <label className="tp-label">Confirmation Email (paste text)</label>
            <textarea
              value={confirmationText}
              onChange={e => setConfirmationText(e.target.value)}
              className="tp-input h-24 resize-none text-xs"
              placeholder="Paste confirmation details, booking numbers, gate info…"
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="tp-label">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="tp-input h-16 resize-none" placeholder="Any notes about this leg…" />
      </div>

      {/* Duration display */}
      {duration > 0 && (
        <div className="flex items-center gap-2 text-sm text-[#64748b]">
          <Clock className="w-4 h-4" />
          <span>Estimated: {Math.floor(duration / 60)}h {duration % 60}m</span>
          {distance > 0 && <span>· {distance} miles</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#1e293b]">
        <button onClick={onCancel} className="tp-btn-ghost">
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button onClick={handleSave} disabled={!isValid} className="tp-btn-primary">
          <Check className="w-4 h-4" />
          {segment ? 'Update Segment' : 'Add Segment'}
        </button>
      </div>
    </div>
  )
}

// ── Great-circle arc generator ──────────────────────────────────────────────
function greatCircleArc(from: { lat: number; lng: number }, to: { lat: number; lng: number }, steps = 60): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(from.lat), lon1 = toRad(from.lng)
  const lat2 = toRad(to.lat), lon2 = toRad(to.lng)

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ))

  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    return [toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))), toDeg(Math.atan2(y, x))] as [number, number]
  })
}

// ── Flight lookup sub-component ──────────────────────────────────────────────
function FlightLookup({ flightNumber, onFound }: { flightNumber: string; onFound: (data: any) => void }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState(false)

  const lookup = async () => {
    setLoading(true)
    setError('')
    setFound(false)
    try {
      const clean = flightNumber.replace(/\s/g, '').toUpperCase()
      const res = await fetch(`/api/flights?flight=${encodeURIComponent(clean)}&date=${date}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Flight not found')
        return
      }
      onFound(data)
      setFound(true)
    } catch {
      setError('Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-blue-500/20 rounded-xl p-3 bg-blue-500/5 space-y-2">
      <div className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
        ✈️ Auto-populate from OpenSky Network (free)
      </div>
      <div className="flex gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="tp-input flex-1 text-sm" />
        <button onClick={lookup} disabled={loading}
          className="px-3 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
          {loading ? <span className="animate-spin">⟳</span> : '🔍'} Look up
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {found && <div className="text-xs text-green-400">✓ Flight route populated! Arc drawn on map.</div>}
      <div className="text-xs text-white/30">Powered by OpenSky Network — no API key needed</div>
    </div>
  )
}
