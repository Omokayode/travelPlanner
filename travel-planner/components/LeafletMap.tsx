// components/LeafletMap.tsx
'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { Segment, Stop, TRANSPORT_COLORS, STOP_TYPE_ICONS } from '@/lib/types'

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function createCustomIcon(emoji: string, color = '#10b981') {
  return L.divIcon({
    html: `<div style="
      background: ${color};
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      font-size: 14px;
    ">
      <span style="transform: rotate(45deg); display: block; line-height: 1;">${emoji}</span>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function createStopIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="
      background: #1a2235;
      border: 1.5px solid #10b981;
      border-radius: 6px;
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      font-size: 12px;
    ">${emoji}</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  })
}

// Auto-fit bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 })
      } catch {}
    }
  }, [map, bounds])
  return null
}

export interface MapSegmentDisplay {
  segment: Segment
  color?: string
}

interface LeafletMapProps {
  segments?: MapSegmentDisplay[]
  stops?: Stop[]
  height?: string
  interactive?: boolean
  onMapClick?: (lat: number, lng: number) => void
}

export default function LeafletMap({
  segments = [],
  stops = [],
  height = '400px',
  interactive = true,
  onMapClick,
}: LeafletMapProps) {
  const allCoords: [number, number][] = []

  // Collect all coords for bounds
  for (const { segment } of segments) {
    allCoords.push([segment.from.coords.lat, segment.from.coords.lng])
    allCoords.push([segment.to.coords.lat, segment.to.coords.lng])
    if (segment.routeCoords) allCoords.push(...segment.routeCoords)
  }
  for (const stop of stops) {
    allCoords.push([stop.location.coords.lat, stop.location.coords.lng])
  }

  const bounds = allCoords.length > 1
    ? L.latLngBounds(allCoords)
    : null

  const defaultCenter: [number, number] = allCoords.length > 0
    ? [allCoords[0][0], allCoords[0][1]]
    : [39.5, -98.35]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={allCoords.length === 0 ? 4 : 10}
      style={{ height, width: '100%', borderRadius: '12px' }}
      zoomControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      {bounds && <FitBounds bounds={bounds} />}

      {/* Route polylines */}
      {segments.map(({ segment, color }) => {
        const routeColor = color || TRANSPORT_COLORS[segment.mode] || '#10b981'
        const coords = segment.routeCoords && segment.routeCoords.length > 1
          ? segment.routeCoords
          : [[segment.from.coords.lat, segment.from.coords.lng], [segment.to.coords.lat, segment.to.coords.lng]] as [number, number][]

        return (
          <Polyline
            key={segment.id}
            positions={coords}
            pathOptions={{ color: routeColor, weight: 4, opacity: 0.85, dashArray: segment.mode === 'flight' ? '8 6' : undefined }}
          />
        )
      })}

      {/* Start/End markers */}
      {segments.map(({ segment }, i) => (
        <div key={`marker_${segment.id}`}>
          {i === 0 && (
            <Marker
              position={[segment.from.coords.lat, segment.from.coords.lng]}
              icon={createCustomIcon('🏁', '#10b981')}
            >
              <Popup>
                <div className="text-sm font-medium">{segment.from.name}</div>
                <div className="text-xs text-gray-400">Start</div>
              </Popup>
            </Marker>
          )}
          {i === segments.length - 1 && (
            <Marker
              position={[segment.to.coords.lat, segment.to.coords.lng]}
              icon={createCustomIcon('📍', '#ef4444')}
            >
              <Popup>
                <div className="text-sm font-medium">{segment.to.name}</div>
                <div className="text-xs text-gray-400">End</div>
              </Popup>
            </Marker>
          )}
          {i > 0 && i < segments.length && (
            <Marker
              position={[segment.from.coords.lat, segment.from.coords.lng]}
              icon={createCustomIcon('🔵', '#0ea5e9')}
            >
              <Popup>
                <div className="text-sm font-medium">{segment.from.name}</div>
              </Popup>
            </Marker>
          )}
        </div>
      ))}

      {/* Stop markers */}
      {stops.map(stop => (
        <Marker
          key={stop.id}
          position={[stop.location.coords.lat, stop.location.coords.lng]}
          icon={createStopIcon(STOP_TYPE_ICONS[stop.type] || '📍')}
        >
          <Popup>
            <div>
              <div className="font-semibold text-sm">{stop.name}</div>
              <div className="text-xs opacity-70 capitalize">{stop.type.replace('_', ' ')}</div>
              {stop.description && <div className="text-xs mt-1">{stop.description}</div>}
              {stop.notes && <div className="text-xs mt-1 italic">{stop.notes}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
