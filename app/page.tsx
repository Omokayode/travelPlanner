// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Map, TrendingUp, Globe, Sparkles, Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import TripCard from '@/components/TripCard'
import { Trip } from '@/lib/types'
import { overallStats, tripStats } from '@/lib/domain/trip'
import { api, reportError } from '@/lib/client'

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api<Trip[]>('/api/trips')
      .then(data => alive && setTrips(data))
      .catch(err => alive && reportError(err, 'Could not load your trips'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/trips/${id}`, 'DELETE')
      setTrips(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      reportError(err, 'Could not delete the trip')
    }
  }

  const totalStats = overallStats(trips)

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

  return (
    <div className="min-h-screen bg-base">
      <Navbar />

      {trips.length === 0 ? (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Globe className="w-10 h-10 text-accent" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-base" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-ink mb-3">Plan your next adventure</h1>
          <p className="text-ink/50 mb-8 max-w-md mx-auto">
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
              <h1 className="text-2xl font-bold text-ink">My Trips</h1>
              <p className="text-ink/40 text-sm mt-1">{trips.length} trip{trips.length !== 1 ? 's' : ''} planned</p>
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
                <Map className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold text-ink">{Math.round(totalStats.miles).toLocaleString()}</div>
                <div className="text-ink/40 text-xs mt-0.5">total miles</div>
              </div>
              <div className="tp-card p-4 text-center">
                <Globe className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold text-ink">{totalStats.cities}</div>
                <div className="text-ink/40 text-xs mt-0.5">cities visited</div>
              </div>
              <div className="tp-card p-4 text-center">
                <TrendingUp className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold text-ink">${Math.round(totalStats.cost).toLocaleString()}</div>
                <div className="text-ink/40 text-xs mt-0.5">total spent</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip} stats={tripStats(trip)} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
