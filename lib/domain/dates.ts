// lib/domain/dates.ts — calendar-date helpers for "YYYY-MM-DD" strings.
//
// Trip and day dates are plain calendar dates with no time zone. Never pass them to
// `new Date('YYYY-MM-DD')`: that is midnight UTC, which is the previous evening in the
// Americas and shifted every generated day back by one. These helpers do the arithmetic
// in UTC on purpose and only ever hand back date strings.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function toUtc(s: string): Date {
  if (!isIsoDate(s)) throw new Error(`Not a YYYY-MM-DD date: ${s}`)
  return new Date(`${s}T00:00:00Z`)
}

/** "2026-12-31" + 1 -> "2027-01-01" */
export function addDays(date: string, days: number): string {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Number of calendar days from start to end, counting both (min 1). */
export function daysInclusive(start: string, end: string): number {
  const diff = Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / 86_400_000)
  return Math.max(1, diff + 1)
}

/** Every date from start to end, inclusive. */
export function dateRange(start: string, end: string): string[] {
  return Array.from({ length: daysInclusive(start, end) }, (_, i) => addDays(start, i))
}

/** Today's date where the browser/server is, as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** A Date at local midnight of that calendar day — only for display formatting (date-fns format). */
export function toLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}
