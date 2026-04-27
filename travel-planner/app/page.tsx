// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Map, TrendingUp, Globe, Sparkles, Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import TripCard from '@/components/TripCard'
import { Trip } from '@/lib/types'
import { getTripStats } from '@/lib/storage'

function calcStats(trips: Trip[]) {
  return trips.reduce((acc, trip) => {
    const miles = trip.days?.reduce((s, d) =>
      s + (d.segments?.reduce((ss, seg) => ss + (seg.distance || 0), 0) || 0), 0) || 0
    const cost = trip.days?.reduce((s, d) =>
      s + (d.segments?.reduce((ss, seg) => ss + (seg.cost || 0), 0) || 0), 0) || 0
    return {
      miles: acc.miles + miles,
      cities: acc.cities + (trip.visitedCities?.length || 0),
      cost: acc.cost + cost,
    }
  }, { miles: 0, cities: 0, cost: 0 })
}

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/trips')
      const data = await res.json()
      setTrips(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    await fetch(`/api/trips/${id}`, { method: 'DELETE' })
    setTrips(prev => prev.filter(t => t.id !== id))
  }

  const totalStats = calcStats(trips)

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

  return (
    <div className="min-h-screen bg-[#0b1121]">
      <Navbar />

      {trips.length === 0 ? (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Globe className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-[#0b1121]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Plan your next adventure</h1>
          <p className="text-white/50 mb-8 max-w-md mx-auto">
            Trip by JKBLabs maps your road trips, flights & trains — with routes, stops, weather, expenses and packing lists.
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Plan a trip
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">My Trips</h1>
              <p className="text-white/40 text-sm mt-1">{trips.length} trip{trips.length !== 1 ? 's' : ''} planned</p>
            </div>
            <Link
              href="/trips/new"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-400 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New trip
            </Link>
          </div>

          {(totalStats.miles > 0 || totalStats.cities > 0) && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="tp-card p-4 text-center">
                <Map className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{Math.round(totalStats.miles).toLocaleString()}</div>
                <div className="text-white/40 text-xs mt-0.5">total miles</div>
              </div>
              <div className="tp-card p-4 text-center">
                <Globe className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{totalStats.cities}</div>
                <div className="text-white/40 text-xs mt-0.5">cities visited</div>
              </div>
              <div className="tp-card p-4 text-center">
                <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">${Math.round(totalStats.cost).toLocaleString()}</div>
                <div className="text-white/40 text-xs mt-0.5">total spent</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip} stats={getTripStats(trip)} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
