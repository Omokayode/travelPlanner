// components/WorldMap.tsx — all trips on one map (loaded client-side only; see app/map/page.tsx).
'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { PLACE_ICONS, type PlaceCategory, type TransportMode } from '@/lib/types'

export interface MapTrip {
  id: string
  name: string
  color: string
  startDate: string
  endDate: string
  legs: { id: string; dayId: string; dayNumber: number; mode: TransportMode; label: string; coords: [number, number][] }[]
  stops: { id: string; dayId: string; name: string; type: string; lat: number; lng: number }[]
  lodgings: { id: string; name: string; city: string | null; lat: number; lng: number; checkIn: string }[]
}
export interface MapPlace {
  name: string
  state?: string
  country?: string
  lat: number
  lng: number
  visits: number
  trips: { id: string; name: string }[]
}
export interface Layers {
  places: boolean
  stops: boolean
  lodgings: boolean
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const PIN = 'display:flex;align-items:center;justify-content:center;border-radius:9999px;font-size:13px;'

/** Markers for places/stops/lodgings in one clustered layer, rebuilt when the data changes. */
function ClusterLayer({ trips, places, layers }: { trips: MapTrip[]; places: MapPlace[]; layers: Layers }) {
  const map = useMap()
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      iconCreateFunction: (c) =>
        L.divIcon({
          html: `<div style="${PIN}width:36px;height:36px;background:rgb(16 185 129 / .9);color:#fff;font-weight:600;border:3px solid rgb(16 185 129 / .35);background-clip:padding-box">${c.getChildCount()}</div>`,
          className: '',
          iconSize: [36, 36],
        }),
    })
    if (layers.places) {
      for (const p of places) {
        const size = Math.min(30, 18 + p.visits * 2)
        const m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            html: `<div style="${PIN}width:${size}px;height:${size}px;background:#10b981;color:#fff;font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.4)">${p.visits > 1 ? p.visits : ''}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          title: p.name,
        })
        m.bindPopup(
          `<div style="min-width:160px"><strong>${esc(p.name)}</strong>${p.state ? `, ${esc(p.state)}` : ''}<br>` +
            `<span style="opacity:.7">${p.visits} visit${p.visits === 1 ? '' : 's'}</span><br>` +
            p.trips.map((t) => `<a href="/trips/${encodeURIComponent(t.id)}" style="color:#10b981">${esc(t.name)}</a>`).join('<br>') +
            '</div>',
        )
        group.addLayer(m)
      }
    }
    for (const t of trips) {
      if (layers.stops) {
        for (const s of t.stops) {
          const m = L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              html: `<div style="${PIN}width:26px;height:26px;background:rgb(var(--card));border:2px solid ${t.color}">${PLACE_ICONS[s.type as PlaceCategory] || '📍'}</div>`,
              className: '',
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            title: s.name,
          })
          m.bindPopup(`<strong>${esc(s.name)}</strong><br><a href="/trips/${encodeURIComponent(t.id)}/day/${encodeURIComponent(s.dayId)}" style="color:#10b981">${esc(t.name)}</a>`)
          group.addLayer(m)
        }
      }
      if (layers.lodgings) {
        for (const l of t.lodgings) {
          const m = L.marker([l.lat, l.lng], {
            icon: L.divIcon({
              html: `<div style="${PIN}width:26px;height:26px;background:rgb(var(--card));border:2px solid #3b82f6">🏨</div>`,
              className: '',
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            title: l.name,
          })
          m.bindPopup(`<strong>${esc(l.name)}</strong>${l.city ? `<br>${esc(l.city)}` : ''}<br><a href="/trips/${encodeURIComponent(t.id)}" style="color:#10b981">${esc(t.name)}</a>`)
          group.addLayer(m)
        }
      }
    }
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, trips, places, layers])
  return null
}

function FitAll({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 9 })
  }, [map, bounds])
  return null
}

export default function WorldMap({ trips, places, layers }: { trips: MapTrip[]; places: MapPlace[]; layers: Layers }) {
  const bounds = useMemo(() => {
    const pts: [number, number][] = trips.flatMap((t) => t.legs.flatMap((l) => [l.coords[0], l.coords[l.coords.length - 1]]))
    return pts.length ? L.latLngBounds(pts) : null
  }, [trips])

  return (
    <MapContainer center={[39.5, -95]} zoom={4} zoomControl={false} worldCopyJump style={{ height: '100%', width: '100%', borderRadius: 0 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <FitAll bounds={bounds} />
      {trips.flatMap((t) =>
        t.legs.map((l) => (
          <Polyline
            key={l.id}
            positions={l.coords}
            pathOptions={{ color: t.color, weight: 3, opacity: 0.85, dashArray: l.mode === 'flight' ? '6 6' : undefined }}
          >
            <Popup>
              <strong>{t.name}</strong>
              <br />
              <a href={`/trips/${t.id}/day/${l.dayId}`} style={{ color: '#10b981' }}>
                Day {l.dayNumber}: {l.label}
              </a>
            </Popup>
          </Polyline>
        )),
      )}
      <ClusterLayer trips={trips} places={places} layers={layers} />
    </MapContainer>
  )
}
