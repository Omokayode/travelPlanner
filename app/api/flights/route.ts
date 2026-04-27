import { NextRequest, NextResponse } from 'next/server'

// OpenSky Network - completely free, no API key required
// https://openskynetwork.github.io/opensky-api/rest.html

const AIRPORT_COORDS: Record<string, { lat: number; lng: number; name: string; city: string }> = {}

async function getAirportCoords(icao: string): Promise<{ lat: number; lng: number; name: string; city: string } | null> {
  if (AIRPORT_COORDS[icao]) return AIRPORT_COORDS[icao]
  try {
    // Use Nominatim to geocode the airport ICAO code
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${icao}+airport&format=json&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'TripByJKBLabs/1.0' } }
    )
    const data = await res.json()
    if (!data.length) return null
    const r = data[0]
    const result = {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      name: r.display_name.split(',')[0],
      city: r.address?.city || r.address?.town || r.address?.county || icao,
    }
    AIRPORT_COORDS[icao] = result
    return result
  } catch { return null }
}

function greatCircleArc(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps = 60
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const lat1 = toRad(from.lat), lon1 = toRad(from.lng)
  const lat2 = toRad(to.lat), lon2 = toRad(to.lng)
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ))
  if (d === 0) return [[from.lat, from.lng], [to.lat, to.lng]]
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    return [toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))), toDeg(Math.atan2(y, x))] as [number, number]
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const flightNumber = searchParams.get('flight')?.replace(/\s/g, '').toUpperCase()
  const date = searchParams.get('date') // yyyy-MM-dd

  if (!flightNumber || !date) {
    return NextResponse.json({ error: 'flight and date required' }, { status: 400 })
  }

  try {
    // OpenSky routes API - returns origin/destination for a callsign (no auth needed)
    const routeRes = await fetch(
      `https://opensky-network.org/api/routes?callsign=${flightNumber}`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!routeRes.ok) {
      return NextResponse.json({
        error: 'Flight not found in OpenSky. Try entering airports manually.',
        notFound: true,
      }, { status: 404 })
    }

    const routeData = await routeRes.json()
    const route: string[] = routeData.route || []

    if (route.length < 2) {
      return NextResponse.json({ error: 'No route data found for this flight number', notFound: true }, { status: 404 })
    }

    const [originIcao, destIcao] = route

    // Get airport coordinates via Nominatim
    const [origin, dest] = await Promise.all([
      getAirportCoords(originIcao),
      getAirportCoords(destIcao),
    ])

    // Parse the carrier from flight number (e.g. DL1234 → Delta)
    const airlineCode = flightNumber.replace(/\d+/, '')

    // Build great-circle arc
    const trackPoints = origin && dest ? greatCircleArc(origin, dest) : []

    // Estimate duration from distance (rough: ~500mph cruise)
    let durationMinutes = null
    if (origin && dest) {
      const R = 3958.8
      const dLat = (dest.lat - origin.lat) * Math.PI / 180
      const dLon = (dest.lng - origin.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      const distMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      durationMinutes = Math.round(distMiles / 500 * 60)
    }

    return NextResponse.json({
      flightNumber,
      date,
      airline: airlineCode,
      from: origin ? {
        iata: originIcao,
        name: origin.name,
        city: origin.city,
        coords: { lat: origin.lat, lng: origin.lng },
      } : null,
      to: dest ? {
        iata: destIcao,
        name: dest.name,
        city: dest.city,
        coords: { lat: dest.lat, lng: dest.lng },
      } : null,
      trackPoints,
      durationMinutes,
      source: 'opensky',
    })
  } catch (err) {
    console.error('Flight lookup error:', err)
    return NextResponse.json({ error: 'Flight lookup failed' }, { status: 500 })
  }
}
