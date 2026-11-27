// lib/stats.ts — trip totals shown on the dashboard and trip page
import { Trip, TripStats } from './types'

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
