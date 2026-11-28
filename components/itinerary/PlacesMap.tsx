// components/itinerary/PlacesMap.tsx — a trip's places on a map: numbered pins per day (in the
// day's colour), the route between them, the day in focus fitted to the view and the others
// faded. Load through ./PlacesMapLazy (Leaflet needs the browser).
'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import MapTiles from '@/components/map/MapTiles'
import L from 'leaflet'
import type { Lodging, Place } from '@/lib/types'

export interface MapDay {
  dayNumber: number
  color: string
  places: Place[]
}

export interface PlacesMapProps {
  days: MapDay[]
  lodgings?: Lodging[]
  /** day to fit and highlight; null = whole trip */
  focusDay?: number | null
  /** place to emphasise (hovered / selected card) */
  activePlaceId?: string | null
  onPlaceClick?: (placeId: string, dayNumber: number) => void
  className?: string
}

function pin(n: number, color: string, active: boolean, faded: boolean) {
  const size = active ? 34 : 26
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;font:600 ${active ? 14 : 12}px/1 system-ui,sans-serif;
      border:2px solid #fff;box-shadow:0 1px 5px rgb(0 0 0/.45);opacity:${faded ? 0.45 : 1};
      ${active ? `outline:4px solid ${color}55;` : ''}">${n}</div>`,
  })
}

const LODGING_ICON = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: '<div style="width:24px;height:24px;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgb(0 0 0/.4)">🏨</div>',
})

function Fit({ days, focusDay }: { days: MapDay[]; focusDay?: number | null }) {
  const map = useMap()
  const key = `${focusDay ?? 'all'}|${days.map((d) => d.places.map((p) => p.id).join()).join('|')}`
  useEffect(() => {
    const size = map.getSize()
    if (!size.x || !size.y) return // hidden (display:none) — nothing to fit into
    const pick = focusDay == null ? days : days.filter((d) => d.dayNumber === focusDay)
    const pts = pick.flatMap((d) => d.places.map((p) => [p.location.coords.lat, p.location.coords.lng] as [number, number]))
    if (pts.length === 1) map.flyTo(pts[0], Math.max(map.getZoom(), 12), { duration: 0.6 })
    else if (pts.length > 1) map.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14, duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the day or its places change
  }, [map, key])
  return null
}

/** Keeps Leaflet's size right when its container changes (sidebar, phone sheet). */
function Resize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function PlacesMap({ days, lodgings = [], focusDay = null, activePlaceId, onPlaceClick, className }: PlacesMapProps) {
  const start = useMemo(() => {
    const p = days.flatMap((d) => d.places)[0]
    return p ? ([p.location.coords.lat, p.location.coords.lng] as [number, number]) : ([39.5, -98.35] as [number, number])
  }, [days])

  return (
    <MapContainer center={start} zoom={days.some((d) => d.places.length) ? 6 : 4} zoomControl={false} className={className}
      style={{ height: '100%', width: '100%' }}>
      <MapTiles />
      <ZoomControl position="bottomright" />
      <Fit days={days} focusDay={focusDay} />
      <Resize />

      {days.flatMap((d) => {
        const faded = focusDay != null && d.dayNumber !== focusDay
        return d.places.map((p, i) => {
          const prev = d.places[i - 1]
          if (!prev || !p.travel) return null
          const coords =
            p.travel.routeCoords && p.travel.routeCoords.length > 1
              ? p.travel.routeCoords
              : ([
                  [prev.location.coords.lat, prev.location.coords.lng],
                  [p.location.coords.lat, p.location.coords.lng],
                ] as [number, number][])
          const straight = !(p.travel.routeCoords && p.travel.routeCoords.length > 1)
          return (
            <Polyline
              key={`line-${p.id}`}
              positions={coords}
              pathOptions={{
                color: d.color,
                weight: faded ? 3 : 4,
                opacity: faded ? 0.3 : 0.85,
                dashArray: p.travel.mode === 'flight' || straight ? '7 7' : undefined,
              }}
            />
          )
        })
      })}

      {lodgings.map((l) => (
        <Marker key={`stay-${l.id}`} position={[l.location.coords.lat, l.location.coords.lng]} icon={LODGING_ICON}>
          <Tooltip direction="top" offset={[0, -10]}>{l.name}</Tooltip>
        </Marker>
      ))}

      {days.flatMap((d) => {
        const faded = focusDay != null && d.dayNumber !== focusDay
        return d.places.map((p, i) => (
          <Marker
            key={p.id}
            position={[p.location.coords.lat, p.location.coords.lng]}
            icon={pin(i + 1, d.color, p.id === activePlaceId, faded)}
            zIndexOffset={p.id === activePlaceId ? 1000 : faded ? -500 : 0}
            eventHandlers={{ click: () => onPlaceClick?.(p.id, d.dayNumber) }}
            title={`${p.name} (day ${d.dayNumber})`}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <strong>{p.name}</strong>
              <br />
              Day {d.dayNumber} · #{i + 1}
            </Tooltip>
          </Marker>
        ))
      })}
    </MapContainer>
  )
}
