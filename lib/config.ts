// lib/config.ts — app-wide constants

export const APP_NAME = 'Trip by JKBLabs'

// Sent to OpenStreetMap services (Nominatim, Overpass). Their usage policy asks for an identifying UA.
// Note: browsers ignore a custom User-Agent, so this only takes effect for server-side calls.
export const USER_AGENT = 'TripByJKBLabs/1.0 (+https://github.com/Omokayode/travelPlanner)'
