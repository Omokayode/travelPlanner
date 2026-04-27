// components/MapView.tsx
'use client'

import dynamic from 'next/dynamic'
import { Segment, Stop } from '@/lib/types'

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

export interface MapSegmentDisplay {
  segment: Segment
  color?: string
}

interface MapViewProps {
  segments?: MapSegmentDisplay[]
  stops?: Stop[]
  height?: string
  interactive?: boolean
  onMapClick?: (lat: number, lng: number) => void
}

export default function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />
}
