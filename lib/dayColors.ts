// One colour per day (pins, lines, day badges) — readable on light and dark backgrounds.
export const DAY_COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#ec4899', '#eab308', '#ef4444', '#14b8a6', '#6366f1', '#84cc16']
export const dayColor = (dayNumber: number) => DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length]
