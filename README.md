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
| `npm test` | unit tests (Vitest) for `lib/domain` — dates, fuel, totals |
| `npm run test:e2e` | browser smoke test (Playwright) against a running app — set `E2E_BASE_URL` (use `localhost`, not `127.0.0.1`) and `E2E_PASSWORD` |
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
  domain/                          pure logic + tests: dates, fuel/tolls, distances, trip/day totals
  types.ts                         shared types and constants
  api.ts                           browser helpers: place search, routing, map links (via /api/geo/*)
  osm.ts                           server-side OpenStreetMap access (cached, rate-limited)
  client.ts                        browser api() helper and error toasts
  schemas.ts, http.ts              request validation and API error handling
  server/store.ts                  database rows <-> the trip/day shapes the pages use
  server/receipts.ts               expense receipts as files (RECEIPTS_DIR)
  session.ts, password.ts          login
  immich.ts                        server-side Immich access
  config.ts                        app name, User-Agent
  db.ts                            Prisma client
e2e/                               Playwright smoke test
.github/workflows/ci.yml           lint, typecheck, unit tests, build, smoke test on every push
prisma/                            schema + migrations
scripts/start.sh                   container entrypoint
```

## Data

A trip has days; a day has legs (`Segment`, ordered), each leg has `Stop`s; a day also has
`Activity` rows. Lodgings, packing items and expenses belong to the trip. Dates without a time are
Postgres `DATE` columns, money is `DECIMAL(12,2)`. The API still sends and accepts the nested
shapes in `lib/types.ts`; `lib/server/store.ts` is the only code that knows about the tables, and
a day is saved in one transaction.

Expense receipts are files in `RECEIPTS_DIR` (`/app/data/receipts` in the image — mount a volume
there, as `docker-compose.yml` does) and are served at
`/api/trips/<trip>/expenses/<expense>/receipt`. Back that folder up along with the database.

Before 1.5.0 each day was one JSON blob (`Day.data`) and lodgings were JSON on the trip. The
1.5.0 migration copies them into the tables and leaves the old columns in place, unused, so the
move can be checked; a later migration removes them.

## Login

The whole app sits behind one household password. The server needs two settings (in `.env` for
Docker, or the environment):

| Setting | What |
|---|---|
| `SESSION_SECRET` | random string, 32+ characters — e.g. `openssl rand -hex 32` |
| `APP_PASSWORD_HASH` | made by `node scripts/hash-password.mjs` (asks for the password, prints the line) |

With the Docker image (from the folder holding `.env`):
`docker run --rm -it --user root -v "$PWD":/cfg <image> node scripts/hash-password.mjs --append /cfg/.env`
— it replaces any earlier `APP_PASSWORD_HASH` line and leaves the rest of the file alone.
If either is missing, sign-in is refused (the app fails closed). Sessions last 30 days; failed
sign-ins are limited to 10 per 15 minutes per address. For local development only you can set
`AUTH_DISABLED=true`.

## Immich

Set the Immich URL and an API key on the Settings page (or `IMMICH_URL` / `IMMICH_API_KEY` in the
environment, which take priority). The key stays on the server: photos are streamed through
`/api/immich/assets/...`, and the Settings page only shows whether a key is saved. Photos are
matched to days by the date they were taken; you can also pick an album per trip.

## Releasing

`./deploy.sh [patch|minor|major]` builds the image, tags it with the next version and `latest`, and
pushes it to Docker Hub (`omokayj/travelplanner`). The current version is kept in `.docker-version`
(not committed).

## Known limitations

- Toll estimates are rough (about $0.04/mile); accurate tolls need a paid API.
- The public OSRM and Overpass servers are rate-limited; if suggestions come back empty, try again.
- One shared password, no per-person accounts.
