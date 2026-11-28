// lib/wiki.ts — notable places near a point from Wikipedia's geosearch (fast and reliable;
// the free Overpass servers often are not). Each article's short description says what it is
// (lib/domain/wikiKind.ts); article length is used as a rough "how well known".
import 'server-only'
import { USER_AGENT } from '@/lib/config'
import type { Coordinates, PlaceCategory } from '@/lib/types'
import { haversineMiles } from '@/lib/domain/geo'
import { wikiKind } from '@/lib/domain/wikiKind'

const API = process.env.WIKIPEDIA_API || 'https://en.wikipedia.org/w/api.php'

export interface WikiPlace {
  pageId: number
  name: string
  description: string
  category: PlaceCategory
  coords: Coordinates
  length: number
  url: string
}

interface Page {
  pageid: number
  index?: number
  title: string
  description?: string
  length?: number
  coordinates?: { lat: number; lon: number }[]
}

const cache = new Map<string, { until: number; value: WikiPlace[] }>()

const around = (at: Coordinates, radiusM: number) =>
  query({ generator: 'geosearch', ggscoord: `${at.lat}|${at.lng}`, ggsradius: String(Math.min(10000, Math.max(100, Math.round(radiusM)))), ggslimit: '50' })

async function query(params: Record<string, string>): Promise<Page[]> {
  const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'description|coordinates|info', origin: '*', ...params })
  let res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500)) // asked to slow down: one more try
    res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  }
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`)
  const data = (await res.json()) as { query?: { pages?: Record<string, Page> } }
  return Object.values(data.query?.pages || {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
}

/** Articles matching `words` within radiusKm, most relevant first (e.g. "museum" near Phoenix). */
const searchNear = (at: Coordinates, radiusKm: number, words: string) =>
  query({ generator: 'search', gsrsearch: `${words} nearcoord:${Math.round(radiusKm)}km,${at.lat},${at.lng}`, gsrlimit: '20' })

/** "Heard Museum (Phoenix, Arizona)" → "Heard Museum" */
const cleanTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, '').trim()

/**
 * Places to visit within about `radiusM` of a point: the centre plus eight points around it are
 * searched, three at a time (one search only returns the 50 nearest articles — in a downtown
 * that is mostly office buildings).
 */
export async function wikiNearby(at: Coordinates, radiusM = 15000, searches: string[] = []): Promise<WikiPlace[]> {
  const key = `${at.lat.toFixed(3)},${at.lng.toFixed(3)},${radiusM},${searches.join('|')}`
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value

  const off = (radiusM * 0.55) / 111_000 // degrees latitude
  const offLng = off / Math.max(0.2, Math.cos((at.lat * Math.PI) / 180))
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return { lat: at.lat + off * Math.cos(a), lng: at.lng + offLng * Math.sin(a) }
  })
  const points = radiusM > 5000 ? [at, ...ring] : [at]
  // targeted searches first (most relevant), then what is simply nearby
  const jobs: (() => Promise<Page[]>)[] = [
    ...searches.map((w) => () => searchNear(at, (radiusM * 1.3) / 1000, w)),
    ...points.map((p) => () => around(p, Math.min(10_000, radiusM * 0.6))),
  ]
  const results: PromiseSettledResult<Page[]>[] = []
  for (let i = 0; i < jobs.length; i += 3) {
    results.push(...(await Promise.allSettled(jobs.slice(i, i + 3).map((j) => j()))))
  }
  if (results.every((r) => r.status === 'rejected')) throw new Error('Wikipedia is not answering')

  const seen = new Set<number>()
  const out: WikiPlace[] = []
  let firstNearby = 0
  for (let n = 0; n < results.length; n++) {
    const r = results[n]
    if (n === searches.length) firstNearby = out.length
    if (r.status !== 'fulfilled') continue
    for (const p of r.value) {
      const c = p.coordinates?.[0]
      if (!c || seen.has(p.pageid)) continue
      seen.add(p.pageid)
      const coords = { lat: c.lat, lng: c.lon }
      if (haversineMiles(at, coords) > (radiusM * 1.6) / 1609) continue
      const category = wikiKind(p.title, p.description)
      if (!category) continue
      out.push({
        pageId: p.pageid,
        name: cleanTitle(p.title),
        description: p.description || '',
        category,
        coords,
        length: p.length || 0,
        url: `https://en.wikipedia.org/?curid=${p.pageid}`,
      })
    }
  }
  // searched results keep their relevance order; the nearby-only ones follow, longest article first
  const searched = out.slice(0, firstNearby)
  const nearby = out.slice(firstNearby).sort((a, b) => b.length - a.length)
  out.splice(0, out.length, ...searched, ...nearby)
  cache.set(key, { until: Date.now() + 24 * 3600_000, value: out })
  if (cache.size > 300) cache.delete(cache.keys().next().value as string)
  return out
}
