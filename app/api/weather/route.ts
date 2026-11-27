import { NextRequest, NextResponse } from 'next/server'
import { WeatherDay, weatherCodeToInfo } from '@/lib/types'
import { addDays, isIsoDate, todayLocal } from '@/lib/domain/dates'

// Daily weather from Open-Meteo (free, no key): archive API for past days, forecast for the rest.
//   GET /api/weather?lat=..&lng=..&start=YYYY-MM-DD[&end=YYYY-MM-DD]

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'

interface OpenMeteoDaily {
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: (number | null)[]
    weathercode: number[]
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || start

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat/lng must be numbers' }, { status: 400 })
  }
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) {
    return NextResponse.json({ error: 'start/end must be YYYY-MM-DD dates' }, { status: 400 })
  }

  try {
    const today = todayLocal()
    let days: WeatherDay[]
    if (end < today) {
      days = await fetchWeather(ARCHIVE, lat, lng, start, end)
    } else if (start < today) {
      // range spans today: past part from the archive, the rest from the forecast
      const [past, future] = await Promise.all([
        fetchWeather(ARCHIVE, lat, lng, start, addDays(today, -1)),
        fetchWeather(FORECAST, lat, lng, today, end),
      ])
      days = [...past, ...future]
    } else {
      days = await fetchWeather(FORECAST, lat, lng, start, end)
    }
    return NextResponse.json(days)
  } catch (err) {
    console.error('Weather error:', err)
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 })
  }
}

async function fetchWeather(baseUrl: string, lat: number, lng: number, start: string, end: string): Promise<WeatherDay[]> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
    temperature_unit: 'fahrenheit',
    precipitation_unit: 'inch',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  })
  const res = await fetch(`${baseUrl}?${q}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Weather API ${res.status}`)
  const data = (await res.json()) as OpenMeteoDaily
  const d = data.daily
  if (!d?.time) return []
  return d.time.map((date, i) => {
    const code = d.weathercode[i]
    const info = weatherCodeToInfo(code)
    return {
      date,
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      precipitation: Math.round((d.precipitation_sum[i] || 0) * 10) / 10,
      weatherCode: code,
      description: info.description,
      icon: info.icon,
    }
  })
}
