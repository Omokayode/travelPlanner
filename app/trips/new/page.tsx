// app/trips/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { addDays, format, differenceInDays } from 'date-fns'
import {
  Car, Plane, Train, Layers, ArrowRight, ArrowLeft,
  Check, Loader2, Calendar, DollarSign
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { Trip, TripType, Vehicle, FuelType, Day } from '@/lib/types'
import clsx from 'clsx'

const TRIP_TYPES: { type: TripType; icon: React.ComponentType<any>; label: string; desc: string; color: string }[] = [
  { type: 'road_trip', icon: Car, label: 'Road Trip', desc: 'Drive with fuel calcs, toll estimates & stop suggestions', color: 'amber' },
  { type: 'flight', icon: Plane, label: 'Flight', desc: 'Air travel with booking management', color: 'blue' },
  { type: 'train', icon: Train, label: 'Train', desc: 'Rail journey with schedule tracking', color: 'green' },
  { type: 'mixed', icon: Layers, label: 'Mixed', desc: 'Combine multiple transport modes', color: 'purple' },
]

const FUEL_TYPES: { type: FuelType; label: string }[] = [
  { type: 'regular', label: 'Regular (87)' },
  { type: 'premium', label: 'Premium (93)' },
  { type: 'diesel', label: 'Diesel' },
  { type: 'electric', label: 'Electric (EV)' },
]

export default function NewTripPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const [tripType, setTripType] = useState<TripType>('road_trip')
  const [budget, setBudget] = useState('')

  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [mpg, setMpg] = useState('28')
  const [fuelType, setFuelType] = useState<FuelType>('regular')
  const [tankSize, setTankSize] = useState('15')

  const numDays = Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1)
  const maxStep = tripType === 'road_trip' ? 3 : 2

  const createTrip = async () => {
    setSaving(true)
    const days: Day[] = Array.from({ length: numDays }, (_, i) => ({
      id: uuidv4(),
      date: format(addDays(new Date(startDate), i), 'yyyy-MM-dd'),
      dayNumber: i + 1,
      segments: [],
      activities: [],
      photos: [],
      visited: false,
    }))

    const vehicle: Vehicle | undefined = tripType === 'road_trip' ? {
      make: vehicleMake || 'My Vehicle',
      model: vehicleModel,
      year: vehicleYear ? parseInt(vehicleYear) : undefined,
      fuelEfficiency: parseFloat(mpg) || 28,
      fuelType,
      tankSize: parseFloat(tankSize) || 15,
    } : undefined

    const trip: Trip = {
      id: uuidv4(),
      name: name.trim() || 'New Trip',
      description: description || undefined,
      startDate,
      endDate,
      type: tripType,
      days,
      vehicle,
      visitedCities: [],
      totalBudget: budget ? parseFloat(budget) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    }

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip),
      })
      const created = await res.json()
      router.push(`/trips/${created.id}`)
    } catch (err) {
      console.error('Failed to create trip:', err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: maxStep }, (_, i) => i + 1).map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                step > s ? 'bg-emerald-500 text-white' :
                step === s ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500' :
                'bg-white/5 text-white/30'
              )}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < maxStep && <div className={clsx('flex-1 h-0.5', step > s ? 'bg-emerald-500' : 'bg-white/10')} style={{ width: 40 }} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Basics */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Trip basics</h2>
              <p className="text-white/40">Give your adventure a name and pick dates.</p>
            </div>

            <div className="space-y-3">
              <input
                className="tp-input w-full text-lg"
                placeholder="Trip name (e.g. Pacific Coast Highway)"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <textarea
                className="tp-input w-full resize-none"
                rows={2}
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Start date</label>
                  <input type="date" className="tp-input w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">End date</label>
                  <input type="date" className="tp-input w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Calendar className="w-4 h-4" />
                {numDays} day{numDays !== 1 ? 's' : ''}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  className="tp-input pl-9 w-full"
                  placeholder="Total budget (optional)"
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-white/50 text-xs">Trip type</label>
              <div className="grid grid-cols-2 gap-3">
                {TRIP_TYPES.map(({ type, icon: Icon, label, desc, color }) => (
                  <button
                    key={type}
                    onClick={() => setTripType(type)}
                    className={clsx(
                      'p-4 rounded-xl border text-left transition-all',
                      tripType === type
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-white/10 bg-white/3 hover:border-white/20'
                    )}
                  >
                    <Icon className={clsx('w-5 h-5 mb-2', tripType === type ? 'text-emerald-500' : 'text-white/40')} />
                    <div className="text-white text-sm font-medium">{label}</div>
                    <div className="text-white/40 text-xs mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)} className="tp-btn w-full flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 — Vehicle (road trip only) */}
        {step === 2 && tripType === 'road_trip' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Your vehicle</h2>
              <p className="text-white/40">Needed for fuel cost and range calculations.</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <input className="tp-input" placeholder="Make (Toyota)" value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} />
                <input className="tp-input" placeholder="Model (Camry)" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} />
                <input className="tp-input" placeholder="Year" type="number" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Fuel efficiency (MPG)</label>
                  <input className="tp-input w-full" type="number" value={mpg} onChange={e => setMpg(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Tank size (gallons)</label>
                  <input className="tp-input w-full" type="number" value={tankSize} onChange={e => setTankSize(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-2 block">Fuel type</label>
                <div className="grid grid-cols-2 gap-2">
                  {FUEL_TYPES.map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => setFuelType(type)}
                      className={clsx(
                        'px-3 py-2 rounded-xl text-sm border transition-all',
                        fuelType === type ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-white/50 hover:border-white/20'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(3)} className="tp-btn flex-1 flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Confirm step */}
        {((step === 2 && tripType !== 'road_trip') || step === 3) && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Ready to go!</h2>
              <p className="text-white/40">Here's a summary of your trip.</p>
            </div>

            <div className="tp-card p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Name</span>
                <span className="text-white font-medium">{name || 'New Trip'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Dates</span>
                <span className="text-white">{startDate} → {endDate} ({numDays} days)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Type</span>
                <span className="text-white">{tripType.replace('_', ' ')}</span>
              </div>
              {budget && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Budget</span>
                  <span className="text-emerald-400">${parseFloat(budget).toLocaleString()}</span>
                </div>
              )}
              {tripType === 'road_trip' && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Vehicle</span>
                  <span className="text-white">{vehicleMake} {vehicleModel} · {mpg} MPG</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(prev => prev - 1)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={createTrip}
                disabled={saving}
                className="tp-btn flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Creating…' : 'Create trip'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
