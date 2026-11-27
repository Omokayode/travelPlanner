// lib/domain/fuel.ts — fuel and toll estimates for driving legs (one place for all of it).
import type { FuelType, Vehicle } from '@/lib/types'

/** Used when Settings has no price for that fuel type. $/gallon ($/kWh for electric). */
export const DEFAULT_FUEL_PRICES: Record<FuelType, number> = {
  regular: 3.45,
  premium: 3.95,
  diesel: 3.65,
  electric: 0.15,
}

/** Used when a trip has no vehicle. */
export const DEFAULT_MPG = 28

/** Rough toll estimate per mile; real tolls need a paid API (TollGuru, HERE). */
export const TOLL_PER_MILE = 0.04

/** The gas-price fields saved on the Settings page. */
export interface GasPrices {
  gasPriceRegular?: number | null
  gasPricePremium?: number | null
  gasPriceDiesel?: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Price per gallon for a fuel type: the saved Settings price, else the default. */
export function fuelPrice(fuelType: FuelType | string | undefined, saved?: GasPrices | null): number {
  const type: FuelType = fuelType && fuelType in DEFAULT_FUEL_PRICES ? (fuelType as FuelType) : 'regular'
  const fromSettings =
    type === 'regular'
      ? saved?.gasPriceRegular
      : type === 'premium'
        ? saved?.gasPricePremium
        : type === 'diesel'
          ? saved?.gasPriceDiesel
          : null
  return typeof fromSettings === 'number' && fromSettings > 0 ? fromSettings : DEFAULT_FUEL_PRICES[type]
}

export function calculateFuelCost(
  distanceMiles: number,
  mpg: number,
  pricePerGallon: number,
): { gallons: number; cost: number } {
  if (!(distanceMiles > 0) || !(mpg > 0)) return { gallons: 0, cost: 0 }
  const gallons = distanceMiles / mpg
  return { gallons: round2(gallons), cost: round2(gallons * pricePerGallon) }
}

export function estimateTolls(distanceMiles: number): number {
  return distanceMiles > 0 ? round2(distanceMiles * TOLL_PER_MILE) : 0
}

export interface DriveCosts {
  fuelGallons: number
  fuelCost: number
  tollCost: number
  /** fuel + tolls */
  cost: number
}

/** Fuel + toll estimate for a driving leg. */
export function driveCosts(
  distanceMiles: number,
  vehicle: Pick<Vehicle, 'fuelEfficiency' | 'fuelType'> | undefined | null,
  pricePerGallon: number,
): DriveCosts {
  const mpg = vehicle?.fuelEfficiency && vehicle.fuelEfficiency > 0 ? vehicle.fuelEfficiency : DEFAULT_MPG
  const { gallons, cost } = calculateFuelCost(distanceMiles, mpg, pricePerGallon)
  const tollCost = estimateTolls(distanceMiles)
  return { fuelGallons: gallons, fuelCost: cost, tollCost, cost: round2(cost + tollCost) }
}
