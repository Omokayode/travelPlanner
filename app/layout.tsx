// app/layout.tsx
import type { Metadata, Viewport } from 'next'
// Fonts are bundled (@fontsource) rather than fetched from Google at build time,
// which made builds fail intermittently. --font-display / --font-body are set in globals.css.
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-700.css'
import '@fontsource/dm-sans/latin-300.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import './globals.css'
import Toaster from '@/components/Toaster'

export const metadata: Metadata = {
  title: 'Trip by JKBLabs — Travel Planner',
  description: 'Plan road trips, flights, and train journeys with detailed itineraries, maps, and cost tracking.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0b1121',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
