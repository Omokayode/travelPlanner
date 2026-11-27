'use client'
// lib/useWeather.ts — one day's weather for a place (used by the day header strip and the Weather tab).
import { useCallback, useEffect, useState } from 'react'
import type { WeatherDay } from '@/lib/types'
import { api } from '@/lib/client'

export function useWeather(lat: number | undefined, lng: number | undefined, date: string) {
  const [weather, setWeather] = useState<WeatherDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (lat == null || lng == null || !date) return
    let alive = true
    setLoading(true)
    setError(null)
    const q = new URLSearchParams({ lat: String(lat), lng: String(lng), start: date, end: date })
    api<WeatherDay[]>(`/api/weather?${q}`)
      .then((days) => alive && setWeather(days[0] || null))
      .catch(() => alive && setError('Could not load weather'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [lat, lng, date, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { weather, loading, error, retry }
}
