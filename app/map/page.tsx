'use client'

// World map: every trip's route, the places you have been (sized by how often), stops and
// lodgings, with totals. Trips can be switched on and off.
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Globe2, MapPin, Route, Flag, Landmark } from 'lucide-react'
import clsx from 'clsx'
import Navbar from '@/components/Navbar'
import { api, reportError } from '@/lib/client'
import type { Layers, MapPlace, MapTrip } from '@/components/WorldMap'

const WorldMap = dynamic(() => import('@/components/WorldMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full skeleton rounded-none" />,
})

interface MapData {
  trips: (MapTrip & { miles: number; days: number; daysVisited: number })[]
  places: MapPlace[]
  totals: { trips: number; miles: number; places: number; states: number; countries: number }
}

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [layers, setLayers] = useState<Layers>({ places: true, stops: false, lodgings: false })

  useEffect(() => {
    api<MapData>('/api/map').then(setData).catch((e) => reportError(e, 'Could not load the map'))
  }, [])

  const trips = useMemo(() => (data?.trips || []).filter((t) => !hidden.has(t.id)), [data, hidden])
  const places = useMemo(
    () => (data?.places || []).filter((p) => p.trips.some((t) => !hidden.has(t.id))),
    [data, hidden],
  )
  const toggleTrip = (id: string) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const stats = data?.totals
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Side panel (below the map on phones) */}
        <aside className="order-2 lg:order-1 lg:w-80 lg:shrink-0 lg:border-r border-line p-4 space-y-5 lg:overflow-y-auto lg:h-[calc(100vh-3.5rem)]">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-accent" /> Where I&apos;ve been
            </h1>
            <p className="text-xs text-ink-3 mt-1">Counts use days marked as done.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Route, label: 'miles', value: stats?.miles.toLocaleString() },
              { icon: MapPin, label: 'places', value: stats?.places },
              { icon: Landmark, label: 'states', value: stats?.states },
              { icon: Flag, label: stats?.countries === 1 ? 'country' : 'countries', value: stats?.countries },
            ].map((s) => (
              <div key={s.label} className="tp-card p-3">
                <s.icon className="w-4 h-4 text-accent mb-1" />
                <div className="text-lg font-semibold text-ink">{s.value ?? <span className="skeleton inline-block w-10 h-5" />}</div>
                <div className="text-xs text-ink-3">{s.label}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="tp-label">Show</div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['places', 'Places'],
                  ['stops', 'Stops'],
                  ['lodgings', 'Lodging'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={layers[k]}
                  onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs border transition-colors',
                    layers[k] ? 'bg-emerald-500 text-white border-emerald-500' : 'border-line text-ink-2 hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="tp-label">Trips</div>
            <ul className="space-y-1">
              {data?.trips
                .slice()
                .reverse()
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={!hidden.has(t.id)}
                      aria-label={`Show ${t.name} on the map`}
                      onClick={() => toggleTrip(t.id)}
                      className="w-4 h-4 rounded border-2 shrink-0 transition-colors"
                      style={{ borderColor: t.color, background: hidden.has(t.id) ? 'transparent' : t.color }}
                    />
                    <Link href={`/trips/${t.id}`} className={clsx('flex-1 min-w-0 text-sm hover:text-accent', hidden.has(t.id) ? 'text-ink-4' : 'text-ink')}>
                      <span className="truncate block">{t.name}</span>
                      <span className="text-xs text-ink-3">
                        {format(parseISO(t.startDate), 'MMM yyyy')} · {t.miles.toLocaleString()} mi
                      </span>
                    </Link>
                  </li>
                ))}
              {!data && [0, 1, 2].map((i) => <li key={i} className="skeleton h-9" />)}
            </ul>
          </div>

          {places.length > 0 && (
            <div>
              <div className="tp-label">Most visited</div>
              <ul className="text-sm space-y-1">
                {places.slice(0, 8).map((p) => (
                  <li key={`${p.name}|${p.state}`} className="flex justify-between gap-2 text-ink-2">
                    <span className="truncate">
                      {p.name}
                      {p.state && <span className="text-ink-4">, {p.state}</span>}
                    </span>
                    <span className="text-ink-3 tabular-nums">{p.visits}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="order-1 lg:order-2 shrink-0 lg:shrink lg:flex-1 h-[60vh] lg:h-[calc(100vh-3.5rem)] relative">
          {data && data.trips.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Globe2 className="w-10 h-10 text-ink-4 mb-3" />
              <p className="text-ink-2">No trips yet — your routes will show up here.</p>
              <Link href="/trips/new" className="tp-btn-primary mt-4">Plan a trip</Link>
            </div>
          ) : data ? (
            <WorldMap trips={trips} places={places} layers={layers} />
          ) : (
            <div className="w-full h-full skeleton rounded-none" />
          )}
        </div>
      </div>
    </div>
  )
}
