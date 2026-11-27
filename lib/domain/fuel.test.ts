import { describe, expect, it } from 'vitest'
import { DEFAULT_FUEL_PRICES, DEFAULT_MPG, calculateFuelCost, driveCosts, estimateTolls, fuelPrice } from './fuel'

describe('fuel', () => {
  it('uses the Settings price when one is saved, else the default', () => {
    expect(fuelPrice('regular')).toBe(DEFAULT_FUEL_PRICES.regular)
    expect(fuelPrice('regular', { gasPriceRegular: 2.99 })).toBe(2.99)
    expect(fuelPrice('premium', { gasPriceRegular: 2.99 })).toBe(DEFAULT_FUEL_PRICES.premium)
    expect(fuelPrice('diesel', { gasPriceDiesel: 4.1 })).toBe(4.1)
    expect(fuelPrice('regular', { gasPriceRegular: 0 })).toBe(DEFAULT_FUEL_PRICES.regular)
    expect(fuelPrice('regular', { gasPriceRegular: null })).toBe(DEFAULT_FUEL_PRICES.regular)
    expect(fuelPrice(undefined)).toBe(DEFAULT_FUEL_PRICES.regular)
    expect(fuelPrice('jet-fuel')).toBe(DEFAULT_FUEL_PRICES.regular)
  })

  it('calculates gallons and cost, rounded to cents', () => {
    expect(calculateFuelCost(280, 28, 3.5)).toEqual({ gallons: 10, cost: 35 })
    expect(calculateFuelCost(100, 30, 3.45)).toEqual({ gallons: 3.33, cost: 11.5 })
  })

  it('returns zero instead of NaN/Infinity for bad input', () => {
    expect(calculateFuelCost(100, 0, 3)).toEqual({ gallons: 0, cost: 0 })
    expect(calculateFuelCost(0, 28, 3)).toEqual({ gallons: 0, cost: 0 })
    expect(estimateTolls(-5)).toBe(0)
  })

  it('combines fuel and tolls, defaulting mpg without a vehicle', () => {
    const withCar = driveCosts(300, { fuelEfficiency: 30, fuelType: 'regular' }, 3)
    expect(withCar).toEqual({ fuelGallons: 10, fuelCost: 30, tollCost: 12, cost: 42 })
    const noCar = driveCosts(280, undefined, 3.5)
    expect(noCar.fuelGallons).toBe(280 / DEFAULT_MPG)
    expect(noCar.cost).toBe(noCar.fuelCost + noCar.tollCost)
  })
})
