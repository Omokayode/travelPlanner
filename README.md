# 🧭 Trip by JKBLabs — Travel Planner

A feature-rich Next.js travel planner for road trips, flights, and trains with OpenStreetMap integration, fuel calculations, stop suggestions, and day-by-day itinerary management.

## Quick Start

```bash
cd travel-planner
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

### 🗺️ Maps & Routing
- **OpenStreetMap** via react-leaflet — dark-themed, fully interactive
- **OSRM routing** — auto-calculates distance and drive time between cities
- **Route polylines** — visualize every segment on the map with color-coded modes
- **Open in Google Maps / Apple Maps / Waze** from any day or trip view

### 🚗 Road Trip Mode
- **Fuel cost calculator** — enter MPG, fuel type, and price-per-gallon
- **Tank range estimator** — know when you'll need to stop
- **Toll estimation** — rough auto-estimate with manual override
- **Stop suggestions** via Overpass API (OSM):
  - Rest areas, gas stations, food, attractions, scenic viewpoints, national parks, Buc-ee's, historical markers
  - Filter by preference
  - Mark stops as visited
  - Add stops manually

### ✈️ Flights & Trains
- Carrier, flight number, booking reference
- Departure and arrival times
- Paste confirmation email text for reference
- Cost tracking per leg

### 📅 Day-by-Day Planning
- Auto-generates a day card for every day of your trip
- Multiple route segments per day (drive + fly + walk, etc.)
- Mark days as completed to track progress
- City-to-city breadcrumb trail

### 🎡 Activities & Places
- Add food, attractions, accommodation, outdoor activities
- **City attraction suggestions** via OpenStreetMap/Overpass
- Mark activities visited, rate them, add notes and websites
- Time, duration, and cost tracking

### 📷 Photos
- Upload photos per day (stored in localStorage as base64)
- Add captions
- 2MB limit per photo for browser storage

### 🏙️ City Tracking
- Automatically marks cities as visited when you complete a day
- Visual "Cities Visited" badge on trip card and overview

### 💾 Data Storage
- All data stored in **browser localStorage** — no backend needed
- Full CRUD for trips, days, segments, stops, activities, photos

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Maps | react-leaflet + OpenStreetMap |
| Routing | OSRM (open source, free) |
| Geocoding | Nominatim (OpenStreetMap) |
| Stop Search | Overpass API |
| Fonts | Cormorant Garamond + DM Sans |
| Storage | Browser localStorage |
| Icons | Lucide React |

---

## Architecture

```
travel-planner/
├── app/
│   ├── page.tsx                       # Dashboard — all trips
│   ├── trips/
│   │   ├── new/page.tsx               # 3-step trip creation wizard
│   │   └── [id]/
│   │       ├── page.tsx               # Trip overview + map
│   │       └── day/[dayId]/page.tsx   # Day planner
├── components/
│   ├── Navbar.tsx
│   ├── TripCard.tsx
│   ├── MapView.tsx                    # Dynamic import wrapper
│   ├── LeafletMap.tsx                 # Actual Leaflet (no SSR)
│   ├── LocationSearch.tsx             # Nominatim geocoding input
│   ├── SegmentEditor.tsx              # Add/edit route segments
│   ├── StopPanel.tsx                  # Stop management + suggestions
│   ├── ActivityPanel.tsx              # Activities + city suggestions
│   └── PhotoPanel.tsx                 # Photo upload/display
├── lib/
│   ├── types.ts                       # All TypeScript types
│   ├── storage.ts                     # localStorage CRUD
│   └── api.ts                         # OSRM, Nominatim, Overpass
```

---

## Known Limitations

- **Toll calculation**: Auto-estimate is very rough (~$0.04/mile). Real toll calculation requires a paid API like TollGuru or HERE.
- **Photos**: Stored as base64 in localStorage — large photos will fill storage quickly. For production, use S3/Cloudinary.
- **Overpass API**: Rate limited. Heavy use may return empty results — try again after a few seconds.
- **Immich integration**: Not yet implemented. Would require your Immich server URL and API key.

---

## Planned Enhancements

- [ ] Export trip to PDF
- [ ] Share trip via URL
- [ ] Immich photo tagging integration
- [ ] Weather forecast per day
- [ ] TollGuru integration for accurate tolls
- [ ] Offline mode with Service Worker
- [ ] Import from Google Maps saved routes
