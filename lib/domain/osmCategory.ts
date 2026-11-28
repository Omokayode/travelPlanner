// lib/domain/osmCategory.ts — OpenStreetMap tags → place category, from the one shared table
// (lib/osmCategories.json, also read by scripts/poi-import.py). Pure functions.
import type { OverpassElement, PlaceCategory } from '@/lib/types'
import table from '@/lib/osmCategories.json'

export type PoiGroup = 'sights' | 'food'

interface Rule {
  key: string
  values: string[]
  category: PlaceCategory
  group: PoiGroup
}

const RULES = table.rules as Rule[]
export const KEEP_TAGS: string[] = table.keepTags

/** Category for a set of OSM tags, or null if it is nothing we list. */
export function osmCategory(tags: Record<string, string> | undefined): PlaceCategory | null {
  if (!tags) return null
  for (const r of RULES) {
    const v = tags[r.key]
    if (v && r.values.includes(v)) return r.category
  }
  return null
}

/** The few tags worth keeping with a cached place. */
export function keptTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of KEEP_TAGS) if (tags[k]) out[k] = tags[k]
  return out
}

/** Overpass QL selectors for one group inside a bbox ("s,w,n,e"); named places only. */
export function overpassSelectors(group: PoiGroup, bbox: string): string[] {
  const byKey = new Map<string, Set<string>>()
  for (const r of RULES) {
    if (r.group !== group) continue
    const set = byKey.get(r.key) ?? new Set<string>()
    r.values.forEach((v) => set.add(v))
    byKey.set(r.key, set)
  }
  return Array.from(byKey.entries()).map(([k, vals]) => `nwr["${k}"~"^(${Array.from(vals).join('|')})$"]["name"](${bbox});`)
}

/** Overpass query for one group of an area: ways/relations come back with their centre. */
export function overpassAreaQuery(group: PoiGroup, bbox: string): string {
  return `[out:json][timeout:180][maxsize:268435456];\n(\n  ${overpassSelectors(group, bbox).join('\n  ')}\n);\nout center tags;`
}

export interface PoiRow {
  id: string
  name: string
  category: PlaceCategory
  lat: number
  lng: number
  tags: Record<string, string>
}

/** Overpass elements → cache rows: named, a kind we list, with a position (ways/relations use their centre). */
export function elementsToPois(elements: OverpassElement[]): PoiRow[] {
  const rows = new Map<string, PoiRow>()
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    const name = el.tags?.name?.trim()
    const category = osmCategory(el.tags)
    if (lat == null || lng == null || !name || !category) continue
    const id = `${el.type || 'node'}/${el.id}`
    rows.set(id, { id, name: name.slice(0, 300), category, lat, lng, tags: keptTags(el.tags) })
  }
  return Array.from(rows.values())
}
