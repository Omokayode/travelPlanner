// app/page.tsx — dashboard: trips grouped into on the road / coming up / past.
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Map, TrendingUp, Globe, Sparkles } from 'lucide-react'
import Navbar from '@/components/Navbar'
import TripCard, { TripCardSkeleton } from '@/components/TripCard'
import { Trip } from '@/lib/types'
import { overallStats, tripStats, tripStatus, type TripStatus } from '@/lib/domain/trip'
import { todayLocal } from '@/lib/domain/dates'
import { api, reportError } from '@/lib/client'
import { useAppSettings } from '@/lib/useAppSettings'

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const settings = useAppSettings()

  useEffect(() => {
    let alive = true
    api<Trip[]>('/api/trips')
      .then((data) => alive && setTrips(data))
      .catch((err) => alive && reportError(err, 'Could not load your trips'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/trips/${id}`, 'DELETE')
      setTrips((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      reportError(err, 'Could not delete the trip')
    }
  }

  const totalStats = overallStats(trips)
  const groups = useMemo(() => {
    const today = todayLocal()
    const withStatus = trips.map((t) => ({ trip: t, status: tripStatus(t.startDate, t.endDate, today) }))
    const of = (k: TripStatus['kind']) => withStatus.filter((x) => x.status.kind === k)
    return [
      { key: 'ongoing', title: 'On the road', items: of('ongoing') },
      { key: 'upcoming', title: 'Coming up', items: of('upcoming').sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)) },
      { key: 'past', title: 'Past trips', items: of('past').sort((a, b) => b.trip.startDate.localeCompare(a.trip.startDate)) },
    ].filter((g) => g.items.length)
  }, [trips])

  return (
    <div className="min-h-screen bg-page">
      <Navbar />

      {!loading && trips.length === 0 ? (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Globe className="w-10 h-10 text-accent" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-ink mb-3">Plan your next adventure</h1>
          <p className="text-ink-2 mb-8 max-w-md mx-auto">
            Map road trips, flights and trains — with routes, stops, weather, expenses and packing lists.
          </p>
          <Link href="/trips/new" className="tp-btn-primary px-6 py-3 rounded-xl text-base">
            <Plus className="w-5 h-5" />
            Plan a trip
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-ink">My trips</h1>
              <p className="text-ink-3 text-sm mt-1">
                {loading ? ' ' : `${trips.length} trip${trips.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Link href="/trips/new" className="hidden md:inline-flex tp-btn-primary rounded-xl">
              <Plus className="w-4 h-4" />
              New trip
            </Link>
          </div>

          {(totalStats.miles > 0 || totalStats.cities > 0) && (
            <Link href="/map" className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 group" aria-label="Open the map of all trips">
              {[
                { icon: Map, value: Math.round(totalStats.miles).toLocaleString(), label: 'miles' },
                { icon: Globe, value: totalStats.cities, label: 'cities' },
                { icon: TrendingUp, value: `$${Math.round(totalStats.cost).toLocaleString()}`, label: 'spent' },
              ].map((s) => (
                <div key={s.label} className="tp-card p-3 sm:p-4 text-center group-hover:border-emerald-500/30 transition-colors">
                  <s.icon className="w-5 h-5 text-accent mx-auto mb-1 sm:mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-ink">{s.value}</div>
                  <div className="text-ink-3 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </Link>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <TripCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`h-${g.key}`}>
                  <h2 id={`h-${g.key}`} className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-3">
                    {g.title}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {g.items.map(({ trip, status }) => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        stats={tripStats(trip)}
                        status={status}
                        autoCover={!!settings?.immichConfigured}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
