// lib/types.ts

export type TransportMode = 'drive' | 'flight' | 'train' | 'bus' | 'ferry' | 'walk'
export type TripType = 'road_trip' | 'flight' | 'train' | 'mixed'
export type FuelType = 'regular' | 'premium' | 'diesel' | 'electric'
export type StopType =
  | 'rest_area'
  | 'gas_station'
  | 'food'
  | 'attraction'
  | 'scenic'
  | 'bucees'
  | 'state_line'
  | 'historical'
  | 'national_park'
  | 'viewpoint'
  | 'love_lock'

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

export interface Stop {
  id: string
  location: GeoLocation
  type: StopType
  name: string
  description?: string
  rating?: number
  duration?: number // minutes planned
  notes?: string
  visited: boolean
  photo?: string
  isAutoSuggested?: boolean
  osmId?: string
}

export interface Vehicle {
  make: string
  model: string
  year?: number
  fuelEfficiency: number // mpg
  fuelType: FuelType
  tankSize: number // gallons
}

export interface Segment {
  id: string
  from: GeoLocation
  to: GeoLocation
  mode: TransportMode
  distance?: number // miles
  duration?: number // minutes
  cost?: number // total segment cost
  fuelCost?: number
  fuelGallons?: number
  tollCost?: number
  bookingRef?: string
  confirmationEmail?: string
  confirmationText?: string
  stops: Stop[]
  routeCoords?: [number, number][] // [[lat, lng], ...]
  departureTime?: string
  arrivalTime?: string
  carrier?: string // airline, train company etc
  flightNumber?: string
  notes?: string
}

export interface Activity {
  id: string
  name: string
  type: 'food' | 'attraction' | 'accommodation' | 'shopping' | 'outdoor' | 'nightlife' | 'other'
  location?: GeoLocation
  time?: string
  duration?: number // minutes
  cost?: number
  notes?: string
  website?: string
  phone?: string
  rating?: number
  visited: boolean
  isHighlight?: boolean
}

export interface Photo {
  id: string
  dataUrl: string // base64
  caption?: string
  location?: GeoLocation
  takenAt?: string
  uploadedAt: string
  segmentId?: string
  activityId?: string
}

export interface Day {
  id: string
  date: string
  dayNumber: number
  title?: string
  segments: Segment[]
  activities: Activity[]
  photos: Photo[]
  notes?: string
  startCity?: string
  endCity?: string
  visited: boolean
  weather?: string
  totalDistance?: number
  totalCost?: number
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
  id: number
  lat: number
  lon: number
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

export const STOP_TYPE_ICONS: Record<StopType, string> = {
  rest_area: '🛑',
  gas_station: '⛽',
  food: '🍔',
  attraction: '🎡',
  scenic: '🏔️',
  bucees: '🦫',
  state_line: '🗺️',
  historical: '🏛️',
  national_park: '🌲',
  viewpoint: '👁️',
  love_lock: '🔒',
}

export const FUEL_PRICES: Record<FuelType, number> = {
  regular: 3.45,
  premium: 3.85,
  diesel: 3.65,
  electric: 0.15, // per kWh, handled differently
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
