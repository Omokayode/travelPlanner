// lib/storage.ts
'use client'

import { Trip, Day, Segment, Stop, Activity, Photo, TripStats } from './types'

const TRIPS_KEY = 'wanderlog_trips'
const VERSION_KEY = 'wanderlog_version'
const CURRENT_VERSION = '1.0.0'

export function initStorage(): void {
  if (typeof window === 'undefined') return
  const version = localStorage.getItem(VERSION_KEY)
  if (!version) {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION)
    localStorage.setItem(TRIPS_KEY, JSON.stringify([]))
  }
}

export function getAllTrips(): Trip[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRIPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getTripById(id: string): Trip | null {
  const trips = getAllTrips()
  return trips.find(t => t.id === id) || null
}

export function saveTrip(trip: Trip): void {
  const trips = getAllTrips()
  const idx = trips.findIndex(t => t.id === trip.id)
  const updated = { ...trip, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    trips[idx] = updated
  } else {
    trips.push(updated)
  }
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips))
}

export function deleteTrip(id: string): void {
  const trips = getAllTrips().filter(t => t.id !== id)
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips))
}

export function getDayById(tripId: string, dayId: string): Day | null {
  const trip = getTripById(tripId)
  if (!trip) return null
  return trip.days.find(d => d.id === dayId) || null
}

export function updateDay(tripId: string, day: Day): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const idx = trip.days.findIndex(d => d.id === day.id)
  if (idx >= 0) {
    trip.days[idx] = day
  } else {
    trip.days.push(day)
  }
  saveTrip(trip)
}

export function addSegmentToDay(tripId: string, dayId: string, segment: Segment): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.segments.push(segment)
  // Update city names
  if (day.segments.length === 1) {
    day.startCity = segment.from.city || segment.from.name
  }
  day.endCity = segment.to.city || segment.to.name
  saveTrip(trip)
}

export function updateSegment(tripId: string, dayId: string, segment: Segment): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  const idx = day.segments.findIndex(s => s.id === segment.id)
  if (idx >= 0) day.segments[idx] = segment
  saveTrip(trip)
}

export function deleteSegment(tripId: string, dayId: string, segmentId: string): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.segments = day.segments.filter(s => s.id !== segmentId)
  saveTrip(trip)
}

export function addActivityToDay(tripId: string, dayId: string, activity: Activity): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.activities.push(activity)
  saveTrip(trip)
}

export function updateActivity(tripId: string, dayId: string, activity: Activity): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  const idx = day.activities.findIndex(a => a.id === activity.id)
  if (idx >= 0) day.activities[idx] = activity
  saveTrip(trip)
}

export function deleteActivity(tripId: string, dayId: string, activityId: string): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.activities = day.activities.filter(a => a.id !== activityId)
  saveTrip(trip)
}

export function addPhotoToDay(tripId: string, dayId: string, photo: Photo): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.photos.push(photo)
  saveTrip(trip)
}

export function deletePhoto(tripId: string, dayId: string, photoId: string): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (!day) return
  day.photos = day.photos.filter(p => p.id !== photoId)
  saveTrip(trip)
}

export function markCityVisited(tripId: string, city: string): void {
  const trip = getTripById(tripId)
  if (!trip) return
  if (!trip.visitedCities.includes(city)) {
    trip.visitedCities.push(city)
    saveTrip(trip)
  }
}

export function markDayVisited(tripId: string, dayId: string): void {
  const trip = getTripById(tripId)
  if (!trip) return
  const day = trip.days.find(d => d.id === dayId)
  if (day) {
    day.visited = true
    if (day.endCity) markCityVisited(tripId, day.endCity)
    saveTrip(trip)
  }
}

export function getTripStats(trip: Trip): TripStats {
  let totalMiles = 0
  let totalDrivingHours = 0
  let totalFuelCost = 0
  let totalTollCost = 0
  let totalCost = 0
  let stopsCount = 0
  let daysCompleted = 0

  for (const day of (trip.days || [])) {
    if (day.visited) daysCompleted++
    for (const seg of (day.segments || [])) {
      totalMiles += seg.distance || 0
      totalDrivingHours += (seg.duration || 0) / 60
      totalFuelCost += seg.fuelCost || 0
      totalTollCost += seg.tollCost || 0
      totalCost += seg.cost || 0
      stopsCount += (seg.stops || []).length
    }
    for (const act of (day.activities || [])) {
      totalCost += act.cost || 0
    }
  }

  return {
    totalMiles: Math.round(totalMiles),
    totalDrivingHours: Math.round(totalDrivingHours * 10) / 10,
    totalCost: Math.round(totalCost * 100) / 100,
    totalFuelCost: Math.round(totalFuelCost * 100) / 100,
    totalTollCost: Math.round(totalTollCost * 100) / 100,
    citiesCount: (trip.visitedCities || []).length,
    daysCompleted,
    totalDays: (trip.days || []).length,
    stopsCount,
  }
}

export function generateSampleTrip(): Trip {
  const id = `trip_sample_${Date.now()}`
  return {
    id,
    name: 'Route 66 Adventure',
    description: 'The classic American road trip from Chicago to Santa Monica',
    startDate: '2024-06-15',
    endDate: '2024-06-22',
    type: 'road_trip',
    days: [],
    vehicle: {
      make: 'Jeep',
      model: 'Wrangler',
      year: 2022,
      fuelEfficiency: 22,
      fuelType: 'regular',
      tankSize: 18.5,
    },
    visitedCities: [],
    totalBudget: 3000,
    tags: ['road trip', 'route 66', 'americana'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: false,
  }
}
