'use client'

import { useWeather } from '@/lib/useWeather'

// ── Inline weather strip ────────────────────────────────────────────────────
export default function WeatherStrip({ dayDate, lat, lng, locationName }: {
  dayDate: string; lat: number; lng: number; locationName?: string
}) {
  const { weather, loading } = useWeather(lat, lng, dayDate)

  if (loading) return (
    <div className="tp-card px-4 py-3 flex items-center gap-2 text-ink/30 text-sm animate-pulse">
      🌡️ Loading weather…
    </div>
  )
  if (!weather) return null

  const hot = weather.tempMax >= 90
  const cold = weather.tempMax <= 40
  const rainy = weather.precipitation > 0.2

  return (
    <div className="tp-card px-4 py-3 flex items-center gap-4">
      <span className="text-3xl">{weather.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-ink font-semibold">{weather.tempMax}°F</span>
          <span className="text-ink/40 text-sm">/ {weather.tempMin}°F</span>
          <span className="text-ink/50 text-sm">{weather.description}</span>
          {locationName && <span className="text-ink/30 text-xs truncate">· {locationName}</span>}
        </div>
        <div className="flex gap-2 mt-0.5">
          {rainy && <span className="text-xs text-info">☔ {weather.precipitation}&quot; rain</span>}
          {hot && <span className="text-xs text-warn">🌡️ Hot day</span>}
          {cold && <span className="text-xs text-info">🧥 Cold</span>}
        </div>
      </div>
    </div>
  )
}
