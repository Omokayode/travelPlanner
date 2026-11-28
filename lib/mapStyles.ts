// lib/mapStyles.ts — the map looks you can switch between (pure; used by components/map/MapTiles).
export type MapStyleId = 'auto' | 'streets' | 'light' | 'dark' | 'satellite' | 'terrain' | 'osm' | 'google-roadmap' | 'google-satellite' | 'google-terrain'

export interface MapStyle {
  id: MapStyleId
  label: string
  /** tile URL template (Google ones get session/key filled in at runtime) */
  url: string
  /** labels drawn on top (Esri canvas and imagery maps have none of their own) */
  overlay?: string
  attribution: string
  /** zoom the tiles exist up to (Leaflet scales them beyond) */
  maxNativeZoom: number
  subdomains?: string
  /** dim these tiles in dark mode (light street/terrain maps only) */
  dimInDark: boolean
  google?: 'roadmap' | 'satellite' | 'terrain'
}

// Esri's basemap tile services need no key (attribution required). CARTO's free tiles now ask
// for an API key, so they are not used.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const esri = (path: string) => `${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`
const ESRI_ATTR = 'Tiles &copy; Esri — Esri, HERE, Garmin, USGS, NGA, &copy; OpenStreetMap contributors'

export const MAP_STYLES: MapStyle[] = [
  { id: 'streets', label: 'Streets', url: esri('World_Street_Map'), attribution: ESRI_ATTR, maxNativeZoom: 19, dimInDark: true },
  { id: 'light', label: 'Light', url: esri('Canvas/World_Light_Gray_Base'), overlay: esri('Canvas/World_Light_Gray_Reference'), attribution: ESRI_ATTR, maxNativeZoom: 16, dimInDark: true },
  { id: 'dark', label: 'Dark', url: esri('Canvas/World_Dark_Gray_Base'), overlay: esri('Canvas/World_Dark_Gray_Reference'), attribution: ESRI_ATTR, maxNativeZoom: 16, dimInDark: false },
  {
    id: 'satellite',
    label: 'Satellite',
    url: esri('World_Imagery'),
    overlay: esri('Reference/World_Boundaries_and_Places'),
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, USDA, USGS',
    maxNativeZoom: 19,
    dimInDark: false,
  },
  { id: 'terrain', label: 'Terrain', url: esri('World_Topo_Map'), attribution: ESRI_ATTR, maxNativeZoom: 19, dimInDark: true },
  { id: 'osm', label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxNativeZoom: 19, subdomains: 'abc', dimInDark: true },
  { id: 'google-roadmap', label: 'Google', url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}', attribution: 'Map data &copy; Google', maxNativeZoom: 22, dimInDark: false, google: 'roadmap' },
  { id: 'google-satellite', label: 'Google satellite', url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}', attribution: 'Imagery &copy; Google', maxNativeZoom: 22, dimInDark: false, google: 'satellite' },
  { id: 'google-terrain', label: 'Google terrain', url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}', attribution: 'Map data &copy; Google', maxNativeZoom: 20, dimInDark: false, google: 'terrain' },
]

export const MAP_STYLE_IDS = ['auto', ...MAP_STYLES.map((s) => s.id)] as const

/** Styles to offer: the Google ones only when Google maps is set up. */
export function availableStyles(google: boolean): MapStyle[] {
  return MAP_STYLES.filter((s) => google || !s.google)
}

/** What a choice means right now ("auto" = Streets by day, Dark at night; Google falls back when not set up). */
export function resolveStyle(id: string | null | undefined, opts: { dark: boolean; google: boolean }): MapStyle {
  const list = availableStyles(opts.google)
  const pick = (x: MapStyleId) => list.find((s) => s.id === x)!
  if (!id || id === 'auto') return pick(opts.dark ? 'dark' : 'streets')
  return list.find((s) => s.id === id) ?? pick(opts.dark ? 'dark' : 'streets')
}
