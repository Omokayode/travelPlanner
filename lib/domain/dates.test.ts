import { describe, expect, it } from 'vitest'
import { addDays, dateRange, daysInclusive, isIsoDate, todayLocal, toLocalDate } from './dates'

describe('dates', () => {
  it('validates YYYY-MM-DD', () => {
    expect(isIsoDate('2026-12-01')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('12/01/2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('does not shift across the US daylight-saving change', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('counts days inclusively', () => {
    expect(daysInclusive('2025-07-01', '2025-07-06')).toBe(6)
    expect(daysInclusive('2025-06-02', '2025-06-02')).toBe(1)
    expect(daysInclusive('2025-07-06', '2025-07-01')).toBe(1) // never below 1
  })

  it('lists a range starting on the start date (the old off-by-one bug)', () => {
    expect(dateRange('2025-07-01', '2025-07-03')).toEqual(['2025-07-01', '2025-07-02', '2025-07-03'])
  })

  it('throws on garbage instead of producing a wrong date', () => {
    expect(() => addDays('nope', 1)).toThrow()
  })

  it('formats today and local midnight from local fields', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    const d = toLocalDate('2025-07-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2025, 6, 1, 0])
  })
})
