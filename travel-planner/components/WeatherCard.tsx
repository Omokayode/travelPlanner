'use client'

import { useState, useEffect } from 'react'
import { Cloud, RefreshCw, MapPin, Thermometer, Droplets, Wind } from 'lucide-react'
import { WeatherDay } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  dayDate: string        // 'yyyy-MM-dd'
  locationName?: string
  lat?: number
  lng?: number
}

export default function WeatherCard({ dayDate, locationName, lat, lng }: Props) {
  const [weather, setWeather] = useState<WeatherDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async () => {
    if (!lat || !lng) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/weather?lat=${lat}&lng=${lng}&start=${dayDate}&end=${dayDate}`
      )
      if (!res.ok) throw new Error('Weather unavailable')
      const days: WeatherDay[] = await res.json()
      setWeather(days[0] || null)
    } catch (err) {
      setError('Could not load weather')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [lat, lng, dayDate])

  if (!lat || !lng) {
    return (
      <div className="tp-card p-4 text-center text-white/40 text-sm">
        <MapPin className="w-5 h-5 mx-auto mb-2 opacity-40" />
        Add a route segment to get weather for this day
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tp-card p-6 flex items-center justify-center gap-3 text-white/50">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
        <span className="text-sm">Fetching forecast…</span>
      </div>
    )
  }

  if (error || !weather) {
    return (
      <div className="tp-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-sm">{error || 'No weather data'}</span>
          <button onClick={fetchWeather} className="text-emerald-500 text-xs hover:text-emerald-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    )
  }

  const hot = weather.tempMax >= 90
  const cold = weather.tempMax <= 40
  const rainy = weather.precipitation > 0.2
  const tempColor = hot ? 'text-orange-400' : cold ? 'text-blue-400' : 'text-emerald-400'

  return (
    <div className="tp-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl mb-1">{weather.icon}</div>
            <div className="text-white/70 text-sm">{weather.description}</div>
            {locationName && (
              <div className="text-white/40 text-xs mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {locationName}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={clsx('text-4xl font-light', tempColor)}>{weather.tempMax}°</div>
            <div className="text-white/40 text-sm">Low {weather.tempMin}°F</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center gap-1">
          <Thermometer className="w-4 h-4 text-emerald-500/60" />
          <div className="text-white/80 text-sm font-medium">{weather.tempMax - weather.tempMin}°</div>
          <div className="text-white/40 text-xs">Range</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Droplets className={clsx('w-4 h-4', rainy ? 'text-blue-400' : 'text-white/20')} />
          <div className="text-white/80 text-sm font-medium">{weather.precipitation}"</div>
          <div className="text-white/40 text-xs">Precip</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Cloud className="w-4 h-4 text-white/30" />
          <div className="text-white/80 text-sm font-medium">{weather.weatherCode}</div>
          <div className="text-white/40 text-xs">WMO code</div>
        </div>
      </div>

      {/* Alerts */}
      {(hot || cold || rainy) && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {hot && <span className="text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">🌡️ Hot day — stay hydrated</span>}
          {cold && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">🧥 Cold — layer up</span>}
          {rainy && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">☔ Rain expected — pack umbrella</span>}
        </div>
      )}

      <div className="px-5 pb-3 text-right">
        <button onClick={fetchWeather} className="text-white/30 text-xs hover:text-white/60 flex items-center gap-1 ml-auto">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
    </div>
  )
}
