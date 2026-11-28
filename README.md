# 🧭 Trip by JKBLabs — Travel Planner

A self-hosted trip planner for road trips, flights and trains. A trip is made of days; each day is
an ordered list of places (cities, sights, restaurants, hotels…), and the app works out how you get
from one place to the next (drive or walk routed on the map; flights and trains as entered). Around that sit fuel and toll costs,
lodging, a packing list, a budget with expenses, weather and photos from Immich.

## Features

- Trips made of days, legs (drive, flight, train…) and stops; fuel and toll estimates; lodging,
  packing list, budget and expenses with receipt photos; weather; photos from Immich.
- Dashboard with cover photos and trip status; a **world map** of every trip (`/map`) with places
  visited, states and countries; a day-by-day **timeline**.
- **Light and dark** themes (follows the device, or Settings → Appearance).
- Works on a phone: bottom tab bar, and a **quick add** button during a trip (expense, note, or
  "I'm here" stop from the phone's location).
- **Plan a new trip in a minute**: describe it in plain words (optional AI through your own
  Ollama) or pick the cities and nights; the days fill with real sights near each city
  (Wikipedia + OpenStreetMap), matched to your interests and pace, ready to edit.
- **Read-only share links** per trip (Share button on the trip page): route, map, days and
  where you stay — no costs, bookings, notes or photos. Can be replaced or turned off.

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
  itinerary/                       day sections, place cards, travel rows, editors, the trip map
  ui/                              Dialog (focus trap), Confirm, Lightbox, ThemeSwitch, skeletons
lib/
  domain/                          pure logic + tests: dates, fuel/tolls, distances, trip/day totals,
                                   trip status, what a share link may show
  theme.ts                         light/dark choice
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

A trip has days; a day has `Place`s in visiting order. Each place stores how you get there from
the previous place of the day (`travel*` columns: mode, miles, minutes, route line, fuel and tolls,
or a ticket and flight details). Lodging, packing items and expenses belong to the trip. Dates
without a time are Postgres `DATE` columns, money is `DECIMAL(12,2)`. `lib/server/store.ts` is the
only code that knows the tables; `lib/server/travel.ts` routes new or changed hops on save (OSRM,
cached; fuel from the trip's car and the saved gas prices — a hop that did not change keeps the
price it was costed at).

**Cities visited** are unique "City, State" labels from days marked done; a state on its own never
counts, and neither does the home city (Settings).

Expense receipts are files in `RECEIPTS_DIR` (`/app/data/receipts` in the image — mount a volume
there, as `docker-compose.yml` does) and are served at
`/api/trips/<trip>/expenses/<expense>/receipt`. Back that folder up along with the database.

History: before 1.5.0 a day was one JSON blob; 1.5.0 moved it to legs/stops tables, 1.6.1 dropped
the JSON, and 1.7.0 turned legs and stops into places (the old `Segment`/`Stop`/`Activity` tables
are kept, unused, until a later release removes them).

## AI planning (optional)

Set `OLLAMA_URL` (e.g. `http://ollama-host:11434`) and optionally `OLLAMA_MODEL` (default
`qwen2.5:3b`; Settings → AI picks another installed model). The model only turns a request
written in plain words into a route outline (start, cities and nights, interests, pace) using
Ollama's structured output; plain facts in the words ("from Milwaukee", "one-way", interest words)
override it. Places always come from Wikipedia (`nearcoord:` search per interest + geosearch,
classified by each article's short description) and OpenStreetMap — never from the model, so they
exist. Without `OLLAMA_URL`, “Plan by cities” works the same way minus the text box. Ollama has
no login: keep it on a private network.

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
