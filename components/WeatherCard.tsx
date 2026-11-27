'use client'

import { Cloud, RefreshCw, MapPin, Thermometer, Droplets } from 'lucide-react'
import { useWeather } from '@/lib/useWeather'
import clsx from 'clsx'

interface Props {
  dayDate: string        // 'yyyy-MM-dd'
  locationName?: string
  lat?: number
  lng?: number
}

export default function WeatherCard({ dayDate, locationName, lat, lng }: Props) {
  const { weather, loading, error, retry: fetchWeather } = useWeather(lat, lng, dayDate)

  if (!lat || !lng) {
    return (
      <div className="tp-card p-4 text-center text-ink/40 text-sm">
        <MapPin className="w-5 h-5 mx-auto mb-2 opacity-40" />
        Add a route segment to get weather for this day
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tp-card p-6 flex items-center justify-center gap-3 text-ink/50">
        <RefreshCw className="w-5 h-5 animate-spin text-accent" />
        <span className="text-sm">Fetching forecast…</span>
      </div>
    )
  }

  if (error || !weather) {
    return (
      <div className="tp-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-ink/40 text-sm">{error || 'No weather data'}</span>
          <button onClick={fetchWeather} className="text-accent text-xs hover:text-accent flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    )
  }

  const hot = weather.tempMax >= 90
  const cold = weather.tempMax <= 40
  const rainy = weather.precipitation > 0.2
  const tempColor = hot ? 'text-warn' : cold ? 'text-info' : 'text-accent'

  return (
    <div className="tp-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-ink/8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl mb-1">{weather.icon}</div>
            <div className="text-ink/70 text-sm">{weather.description}</div>
            {locationName && (
              <div className="text-ink/40 text-xs mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {locationName}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={clsx('text-4xl font-light', tempColor)}>{weather.tempMax}°</div>
            <div className="text-ink/40 text-sm">Low {weather.tempMin}°F</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center gap-1">
          <Thermometer className="w-4 h-4 text-accent/60" />
          <div className="text-ink/80 text-sm font-medium">{weather.tempMax - weather.tempMin}°</div>
          <div className="text-ink/40 text-xs">Range</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Droplets className={clsx('w-4 h-4', rainy ? 'text-info' : 'text-ink/20')} />
          <div className="text-ink/80 text-sm font-medium">{weather.precipitation}&quot;</div>
          <div className="text-ink/40 text-xs">Precip</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Cloud className="w-4 h-4 text-ink/30" />
          <div className="text-ink/80 text-sm font-medium">{weather.weatherCode}</div>
          <div className="text-ink/40 text-xs">WMO code</div>
        </div>
      </div>

      {/* Alerts */}
      {(hot || cold || rainy) && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {hot && <span className="text-xs px-2 py-1 rounded-full bg-orange-500/15 text-warn border border-orange-500/20">🌡️ Hot day — stay hydrated</span>}
          {cold && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-info border border-blue-500/20">🧥 Cold — layer up</span>}
          {rainy && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-info border border-blue-500/20">☔ Rain expected — pack umbrella</span>}
        </div>
      )}

      <div className="px-5 pb-3 text-right">
        <button onClick={fetchWeather} className="text-ink/30 text-xs hover:text-ink/60 flex items-center gap-1 ml-auto">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
    </div>
  )
}
