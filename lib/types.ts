// lib/types.ts

export type TransportMode = 'drive' | 'flight' | 'train' | 'bus' | 'ferry' | 'walk'
export type TripType = 'road_trip' | 'flight' | 'train' | 'mixed'
export type FuelType = 'regular' | 'premium' | 'diesel' | 'electric'
/** What kind of place it is (icon, colour, how it counts). */
export type PlaceCategory =
  | 'city'
  | 'lodging'
  | 'airport'
  | 'station'
  | 'food'
  | 'coffee'
  | 'attraction'
  | 'museum'
  | 'historical'
  | 'park'
  | 'national_park'
  | 'scenic'
  | 'viewpoint'
  | 'shopping'
  | 'nightlife'
  | 'gas_station'
  | 'bucees'
  | 'rest_area'
  | 'state_line'
  | 'love_lock'
  | 'other'

export interface Coordinates {
  lat: number
  lng: number
}

export interface GeoLocation {
  id: string
  name: string
  address?: string
  coords: Coordinates
  city?: string
  state?: string
  country?: string
}


export interface Vehicle {
  make: string
  model: string
  year?: number
  fuelEfficiency: number // mpg
  fuelType: FuelType
  tankSize: number // gallons
}

/** How you get to a place from the one before it (same day). */
export interface Travel {
  mode: TransportMode
  /** true (default): routed by the app between the two places; false: typed in / looked up (flights) */
  auto?: boolean
  distance?: number // miles
  duration?: number // minutes
  routeCoords?: [number, number][] // [[lat, lng], ...]
  fuelCost?: number
  fuelGallons?: number
  tollCost?: number
  /** where tollCost came from: Google's Routes API, or the per-mile estimate */
  tollSource?: 'google' | 'estimate'
  /** fuel + tolls for a drive; the ticket for a flight/train… */
  cost?: number
  carrier?: string
  flightNumber?: string
  bookingRef?: string
  confirmationText?: string
  departureTime?: string // local "YYYY-MM-DDTHH:mm"
  arrivalTime?: string
}

/** A place on a day, in visiting order. */
export interface Place {
  id: string
  name: string
  category: PlaceCategory
  location: GeoLocation
  /** first place of a day has none */
  travel?: Travel
  arriveTime?: string // "HH:mm"
  stayMinutes?: number
  notes?: string
  cost?: number // spent at the place (tickets, meal…)
  website?: string
  phone?: string
  visited?: boolean
  osmId?: string
}


export interface Day {
  id: string
  date: string
  dayNumber: number
  title?: string
  places: Place[]
  notes?: string
  startCity?: string
  endCity?: string
  visited: boolean
}

export interface Lodging {
  id: string
  name: string           // e.g. "Hilton Nashville Downtown"
  location: GeoLocation
  checkIn: string        // yyyy-MM-dd
  checkOut: string       // yyyy-MM-dd
  confirmationText?: string
  notes?: string
  cost?: number
  bookingRef?: string
}

export interface Trip {
  id: string
  name: string
  description?: string
  startDate: string
  endDate: string
  type: TripType
  days: Day[]
  vehicle?: Vehicle
  visitedCities: string[]
  coverPhotoUrl?: string
  totalBudget?: number
  tags?: string[]
  createdAt: string
  updatedAt: string
  isActive?: boolean
  homeCoords?: Coordinates
  lodgings?: Lodging[]
  /** secret of the read-only share link, if shared */
  shareToken?: string | null
}

export interface TripStats {
  totalMiles: number
  totalDrivingHours: number
  totalCost: number
  totalFuelCost: number
  totalTollCost: number
  citiesCount: number
  daysCompleted: number
  totalDays: number
  stopsCount: number
}

export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
    road?: string
    postcode?: string
  }
  type: string
  importance: number
}

export interface OSRMRoute {
  distance: number // meters
  duration: number // seconds
  geometry: {
    coordinates: [number, number][] // [lng, lat]
  }
}

export interface OverpassElement {
  type?: 'node' | 'way' | 'relation'
  id: number
  lat: number
  lon: number
  /** ways/relations queried with "out center" */
  center?: { lat: number; lon: number }
  tags: Record<string, string>
}

export const TRANSPORT_ICONS: Record<TransportMode, string> = {
  drive: '🚗',
  flight: '✈️',
  train: '🚆',
  bus: '🚌',
  ferry: '⛴️',
  walk: '🚶',
}

export const TRANSPORT_COLORS: Record<TransportMode, string> = {
  drive: '#f59e0b',
  flight: '#3b82f6',
  train: '#10b981',
  bus: '#8b5cf6',
  ferry: '#06b6d4',
  walk: '#ec4899',
}

export const PLACE_ICONS: Record<PlaceCategory, string> = {
  city: '🏙️',
  lodging: '🏨',
  airport: '✈️',
  station: '🚉',
  food: '🍽️',
  coffee: '☕',
  attraction: '🎡',
  museum: '🏛️',
  historical: '🏰',
  park: '🌳',
  national_park: '🌲',
  scenic: '🏔️',
  viewpoint: '👁️',
  shopping: '🛍️',
  nightlife: '🍸',
  gas_station: '⛽',
  bucees: '🦫',
  rest_area: '🛑',
  state_line: '🗺️',
  love_lock: '🔒',
  other: '📍',
}

export const PLACE_LABELS: Record<PlaceCategory, string> = {
  city: 'City / town',
  lodging: 'Hotel / stay',
  airport: 'Airport',
  station: 'Station',
  food: 'Food',
  coffee: 'Coffee',
  attraction: 'Attraction',
  museum: 'Museum',
  historical: 'Historic site',
  park: 'Park',
  national_park: 'National park',
  scenic: 'Scenic spot',
  viewpoint: 'Viewpoint',
  shopping: 'Shopping',
  nightlife: 'Nightlife',
  gas_station: 'Gas',
  bucees: "Buc-ee's",
  rest_area: 'Rest area',
  state_line: 'State line',
  love_lock: 'Love lock',
  other: 'Other',
}

// Fuel prices: see lib/domain/fuel.ts (DEFAULT_FUEL_PRICES + the Settings page prices).

/** What /api/flights returns for a flight-number lookup. */
export interface FlightAirport {
  iata: string
  name: string
  city?: string
  coords: Coordinates
}
export interface FlightLookupResult {
  flightNumber: string
  date: string
  airline?: string
  departureScheduled?: string
  arrivalScheduled?: string
  from: FlightAirport | null
  to: FlightAirport | null
  trackPoints: [number, number][]
  durationMinutes: number | null
  source: string
}

// ─── New Feature Types ─────────────────────────────────────────────────────────

export type PackingCategory =
  | 'clothes'
  | 'toiletries'
  | 'electronics'
  | 'documents'
  | 'medications'
  | 'food_snacks'
  | 'gear'
  | 'entertainment'
  | 'misc'

export interface PackingItem {
  id: string
  tripId: string
  name: string
  category: PackingCategory
  packed: boolean
  quantity: number
  notes?: string
  essential?: boolean
}

export type ExpenseCategory =
  | 'fuel'
  | 'food'
  | 'accommodation'
  | 'activities'
  | 'transport'
  | 'shopping'
  | 'tolls'
  | 'misc'

export interface Expense {
  id: string
  tripId: string
  dayId?: string
  name: string
  amount: number
  category: ExpenseCategory
  date: string
  notes?: string
  receipt?: string | null
  paymentMethod?: string | null
}

export interface WeatherDay {
  date: string
  tempMax: number
  tempMin: number
  precipitation: number
  weatherCode: number
  description: string
  icon: string
}

export const PACKING_CATEGORY_ICONS: Record<PackingCategory, string> = {
  clothes: '👕',
  toiletries: '🧴',
  electronics: '🔌',
  documents: '📄',
  medications: '💊',
  food_snacks: '🍿',
  gear: '🎒',
  entertainment: '🎮',
  misc: '📦',
}

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  fuel: '⛽',
  food: '🍔',
  accommodation: '🏨',
  activities: '🎡',
  transport: '✈️',
  shopping: '🛍️',
  tolls: '🛣️',
  misc: '💰',
}

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  fuel: '#f59e0b',
  food: '#ef4444',
  accommodation: '#3b82f6',
  activities: '#8b5cf6',
  transport: '#06b6d4',
  shopping: '#ec4899',
  tolls: '#6b7280',
  misc: '#10b981',
}

// WMO Weather Code to description/icon
export function weatherCodeToInfo(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Clear sky', icon: '☀️' }
  if (code <= 2) return { description: 'Partly cloudy', icon: '⛅' }
  if (code === 3) return { description: 'Overcast', icon: '☁️' }
  if (code <= 49) return { description: 'Foggy', icon: '🌫️' }
  if (code <= 59) return { description: 'Drizzle', icon: '🌦️' }
  if (code <= 69) return { description: 'Rain', icon: '🌧️' }
  if (code <= 79) return { description: 'Snow', icon: '❄️' }
  if (code <= 82) return { description: 'Rain showers', icon: '🌦️' }
  if (code <= 86) return { description: 'Snow showers', icon: '🌨️' }
  if (code <= 99) return { description: 'Thunderstorm', icon: '⛈️' }
  return { description: 'Unknown', icon: '🌡️' }
}
