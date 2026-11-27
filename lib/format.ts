// lib/format.ts — small display helpers shared by pages.

/** 95 → "1h 35m", 40 → "40m", undefined/0 → "". */
export function formatMinutes(min?: number | null): string {
  if (!min || min <= 0) return ''
  const m = Math.round(min)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m - h * 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

/** 8.84 → "8.8 mi", 120.4 → "120 mi". */
export function formatMiles(mi?: number | null): string {
  if (!mi || mi <= 0) return ''
  return `${mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi).toLocaleString()} mi`
}

export const money = (n?: number | null) => (n ? `$${n.toFixed(2)}` : '')
