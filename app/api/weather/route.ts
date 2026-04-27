import { NextRequest, NextResponse } from 'next/server'
import { weatherCodeToInfo } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!lat || !lng || !startDate) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  try {
    const end = endDate || startDate
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Use archive API for past dates, forecast for future
    const isPast = end < today
    const baseUrl = isPast
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'

    // For mixed ranges (some past, some future) we may need two calls
    // Simplify: if start is past but end is future, split at yesterday/today
    let days: any[] = []

    if (!isPast && startDate < today) {
      // Split: fetch past portion from archive, future from forecast
      const [pastData, futureData] = await Promise.all([
        fetchWeather(baseUrl.replace('forecast', 'archive'), lat, lng, startDate, yesterday),
        fetchWeather('https://api.open-meteo.com/v1/forecast', lat, lng, today, end),
      ])
      days = [...pastData, ...futureData]
    } else {
      days = await fetchWeather(baseUrl, lat, lng, startDate, end)
    }

    return NextResponse.json(days)
  } catch (err) {
    console.error('Weather error:', err)
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 })
  }
}

async function fetchWeather(baseUrl: string, lat: string, lng: string, start: string, end: string) {
  const url = `${baseUrl}?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&start_date=${start}&end_date=${end}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Weather API ${res.status}: ${text.slice(0, 100)}`)
  }
  const data = await res.json()
  if (!data.daily?.time) return []
  return data.daily.time.map((date: string, i: number) => {
    const code = data.daily.weathercode[i]
    const info = weatherCodeToInfo(code)
    return {
      date,
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      precipitation: Math.round((data.daily.precipitation_sum[i] || 0) * 10) / 10,
      weatherCode: code,
      description: info.description,
      icon: info.icon,
    }
  })
}
