// lib/domain/google.ts — reading Google Maps Platform answers (pure, so they can be tested).
import type { Coordinates } from '@/lib/types'
import { haversineMiles } from './geo'

/** Google's Money: whole units as a string plus billionths. */
export interface Money {
  currencyCode?: string
  units?: string | number
  nanos?: number
}

export const moneyToNumber = (m: Money) => Number(m.units || 0) + (m.nanos || 0) / 1e9

/**
 * Toll price from a Routes API route:
 * - no tollInfo at all → 0 (no tolls on the way)
 * - tollInfo without a price → null (there are tolls, Google doesn't know the price → estimate)
 * - otherwise the USD prices added up.
 */
export function tollFromRoute(route: { travelAdvisory?: { tollInfo?: { estimatedPrice?: Money[] } } } | undefined): number | null {
  const info = route?.travelAdvisory?.tollInfo
  if (!info) return 0
  const prices = (info.estimatedPrice || []).filter((p) => !p.currencyCode || p.currencyCode === 'USD')
  if (!prices.length) return null
  return Math.round(prices.reduce((n, p) => n + moneyToNumber(p), 0) * 100) / 100
}

export const TOLL_PASSES: { id: string; label: string }[] = [
  { id: 'US_IL_I_PASS', label: 'I-PASS (Illinois)' },
  { id: 'US_IN_E_ZPASS', label: 'E-ZPass (Indiana)' },
  { id: 'US_NY_EZPASS', label: 'E-ZPass (New York)' },
  { id: 'US_PA_E_ZPASS', label: 'E-ZPass (Pennsylvania)' },
  { id: 'US_OH_E_ZPASS', label: 'E-ZPass (Ohio)' },
  { id: 'US_MA_EZPASS_MA', label: 'E-ZPass (Massachusetts)' },
  { id: 'US_FL_SUNPASS', label: 'SunPass (Florida)' },
  { id: 'US_TX_TXTAG_TAG', label: 'TxTag (Texas)' },
  { id: 'US_CA_FASTRAK', label: 'FasTrak (California)' },
  { id: 'US_WA_GOOD_TO_GO', label: 'Good To Go (Washington)' },
]

export interface Hotel {
  name: string
  coords: Coordinates
  address?: string
  rating?: number
  reviews?: number
  /** 1 (cheap) … 4 (very expensive) */
  priceLevel?: number
  mapsUrl?: string
  source: 'google' | 'osm'
  /** miles from the centre it was looked up for */
  miles: number
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

export interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  location?: { latitude: number; longitude: number }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  googleMapsUri?: string
}

export function hotelFromGoogle(p: GooglePlace, centre: Coordinates): Hotel | null {
  if (!p.displayName?.text || !p.location) return null
  const coords = { lat: p.location.latitude, lng: p.location.longitude }
  return {
    name: p.displayName.text,
    coords,
    address: p.formattedAddress,
    rating: p.rating,
    reviews: p.userRatingCount,
    priceLevel: p.priceLevel ? PRICE_LEVELS[p.priceLevel] : undefined,
    mapsUrl: p.googleMapsUri,
    source: 'google',
    miles: Math.round(haversineMiles(centre, coords) * 10) / 10,
  }
}

/** Good, well-reviewed and close first: rating ≥ 4 with ≥ 50 reviews when ratings are known. */
export function pickHotels(list: Hotel[], max = 4): Hotel[] {
  const rated = list.filter((h) => h.rating != null)
  const pool = rated.length ? rated.filter((h) => (h.rating ?? 0) >= 4 && (h.reviews ?? 0) >= 50) : list
  const score = (h: Hotel) => (h.rating ?? 0) * 2 + Math.log10((h.reviews ?? 0) + 1) - h.miles * 0.3
  return [...(pool.length ? pool : list)].sort((a, b) => score(b) - score(a) || a.miles - b.miles).slice(0, max)
}

/** "Check prices" link with the dates filled in. */
export function bookingUrl(name: string, city: string | undefined, checkIn: string, checkOut: string, adults = 2): string {
  const q = new URLSearchParams({ ss: [name, city].filter(Boolean).join(', '), checkin: checkIn, checkout: checkOut, group_adults: String(adults), no_rooms: '1' })
  return `https://www.booking.com/searchresults.html?${q}`
}

const norm = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '')

/** Find the Google rating for a place by name (and within ~0.5 mi). */
export function matchRating(name: string, at: Coordinates, rated: { name: string; coords: Coordinates; rating?: number; reviews?: number }[]) {
  const n = norm(name)
  if (!n) return undefined
  return rated.find((r) => {
    const m = norm(r.name)
    return (m === n || (m.length > 5 && (m.includes(n) || n.includes(m)))) && haversineMiles(at, r.coords) < 0.5
  })
}
