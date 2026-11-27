// components/MapView.tsx — loads the Leaflet map on the client only (Leaflet needs `window`).
'use client'

import dynamic from 'next/dynamic'
import type { LeafletMapProps } from './LeafletMap'

export type { MapSegmentDisplay } from './LeafletMap'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-surface rounded-xl flex items-center justify-center border border-line animate-pulse"
      style={{ height: '400px' }}>
      <div className="text-center">
        <div className="text-2xl mb-2">🗺️</div>
        <div className="text-sm text-ink-4">Loading map…</div>
      </div>
    </div>
  ),
})

export default function MapView(props: LeafletMapProps) {
  return <LeafletMap {...props} />
}
