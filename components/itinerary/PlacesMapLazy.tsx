'use client'
// Loads the Leaflet map in the browser only.
import dynamic from 'next/dynamic'

export type { MapDay, PlacesMapProps } from './PlacesMap'

const PlacesMapLazy = dynamic(() => import('./PlacesMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full skeleton rounded-none" />,
})
export default PlacesMapLazy
