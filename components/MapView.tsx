// components/MapView.tsx — loads the Leaflet map on the client only (Leaflet needs `window`).
'use client'

import dynamic from 'next/dynamic'
import type { LeafletMapProps } from './LeafletMap'

export type { MapSegmentDisplay } from './LeafletMap'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-[#111827] rounded-xl flex items-center justify-center border border-[#1e293b] animate-pulse"
      style={{ height: '400px' }}>
      <div className="text-center">
        <div className="text-2xl mb-2">🗺️</div>
        <div className="text-sm text-[#475569]">Loading map…</div>
      </div>
    </div>
  ),
})

export default function MapView(props: LeafletMapProps) {
  return <LeafletMap {...props} />
}
