# 🧭 Trip by JKBLabs — Travel Planner

A self-hosted trip planner for road trips, flights and trains. A trip is made of days; each day has
route segments (drive, fly, train…), and each segment has stops. Around that sit fuel and toll costs,
lodging, a packing list, a budget with expenses, weather and photos from Immich.

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 14 (App Router), React 18, TypeScript |
| Database | PostgreSQL 16 via Prisma 5 (`prisma/schema.prisma`, migrations in `prisma/migrations`) |
| Styling | Tailwind CSS, Lucide icons, Cormorant Garamond + DM Sans |
| Maps | Leaflet / react-leaflet with OpenStreetMap tiles |
| Outside services (free, no keys) | Nominatim (place search), OSRM (routing), Overpass (stop suggestions), Open-Meteo (weather), OpenSky (flights) |
| Photos | Immich (optional) |

## Run it with Docker (recommended)

```bash
cp .env.example .env        # then set POSTGRES_PASSWORD
docker compose up -d --build
```

Open <http://localhost:3000>. On start the container runs `prisma migrate deploy`, then the app
(`scripts/start.sh`).

## Local development

Needs Node 22 and a Postgres database.

```bash
npm ci
export DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DBNAME
npx prisma migrate deploy
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run build` | `prisma generate` + production build (standalone output) |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm run db:migrate` | create a new migration from schema changes (dev only) |
| `npm run db:studio` | Prisma Studio |

## Layout

```
app/
  page.tsx                         dashboard (all trips)
  trips/new/page.tsx               new-trip wizard
  trips/[id]/page.tsx              trip overview: itinerary, photos, lodging, packing, budget
  trips/[id]/day/[dayId]/page.tsx  day planner
  settings/page.tsx                Immich, gas prices, saved vehicles
  api/                             route handlers (trips, days, budget, expenses, packing, settings,
                                   immich, stops, flights, weather)
components/                        UI panels, map, search, cards
lib/
  types.ts                         shared types and constants
  api.ts                           Nominatim / OSRM / Overpass helpers, fuel + toll maths, map links
  stats.ts                         trip totals
  config.ts                        app name, User-Agent
  db.ts                            Prisma client
prisma/                            schema + migrations
scripts/start.sh                   container entrypoint
```

## Immich

Set the Immich URL and an API key on the Settings page. Photos are matched to days by the date they
were taken; you can also pick an album per trip.

## Releasing

`./deploy.sh [patch|minor|major]` builds the image, tags it with the next version and `latest`, and
pushes it to Docker Hub (`omokayj/travelplanner`). The current version is kept in `.docker-version`
(not committed).

## Known limitations

- Toll estimates are rough (about $0.04/mile); accurate tolls need a paid API.
- The public OSRM and Overpass servers are rate-limited; if suggestions come back empty, try again.
- There is no login yet — keep the app on a private network.
