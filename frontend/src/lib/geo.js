// Pure geospatial helpers used in the browser.
//
// Concept: client-side preview vs server-side authority.
// The server NEVER trusts a client's claimed weight — it recalculates distance
// in PostGIS (verification_service.py). We duplicate the formula here purely so
// the UI can show "You are 120m away · 95% vote weight" BEFORE the user taps.

const EARTH_RADIUS_M = 6_371_000

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)))
}

// Mirrors calculate_vote_distance_weight() in backend/app/core/trust_math.py.
// At 0m -> 1.0, at 500m -> 0.5, at 2km -> ~0.06.
export function distanceDecayWeight(distanceMeters, halfWeightMeters = 500) {
  const d = Math.max(0, distanceMeters)
  const ratio = d / halfWeightMeters
  return 1 / (1 + ratio * ratio)
}

export function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// Default national camera showing all 36 States + FCT, River Niger & Benue, and Gulf of Guinea.
export const NIGERIA_CENTER = { lat: 9.08, lng: 8.68, zoom: 6 }

// Quick-jump areas for Core Feature #2 (area filter / navigation).
export const NIGERIA_AREAS = [
  { id: 'all_nigeria', label: '🇳🇬 All Nigeria (Atlas)', lat: 9.08, lng: 8.68, zoom: 6 },
  { id: 'lagos_mainland', label: 'Lagos Mainland', lat: 6.5244, lng: 3.3792, zoom: 12 },
  { id: 'lekki_vi', label: 'VI & Lekki', lat: 6.4428, lng: 3.455, zoom: 13 },
  { id: 'abuja', label: 'Abuja Central (FCT)', lat: 9.0765, lng: 7.3986, zoom: 12 },
  { id: 'kaduna_hwy', label: 'Kaduna–Abuja Hwy', lat: 9.8732, lng: 7.4321, zoom: 10 },
  { id: 'lokoja', label: 'Lokoja Confluence', lat: 7.8023, lng: 6.743, zoom: 10 },
  { id: 'port_harcourt', label: 'Port Harcourt', lat: 4.8156, lng: 7.0498, zoom: 12 },
  { id: 'kano', label: 'Kano Metro', lat: 12.0022, lng: 8.592, zoom: 11 },
  { id: 'ibadan', label: 'Ibadan', lat: 7.3775, lng: 3.947, zoom: 12 },
]

// Preset Nigerian commute corridors for Feature 2 (Route Safety Escort).
export const COMMUTE_PRESETS = [
  {
    id: 'lekki_vi',
    label: 'Lekki Phase 1 → Victoria Island',
    origin: { name: 'Lekki Phase 1 Gate', lat: 6.4478, lng: 3.4795 },
    destination: { name: 'Adeola Odeku, VI', lat: 6.4281, lng: 3.4219 },
  },
  {
    id: 'surulere_marina',
    label: 'Surulere → Marina / CMS',
    origin: { name: 'Bode Thomas, Surulere', lat: 6.4975, lng: 3.3578 },
    destination: { name: 'Marina / CMS Bus Stop', lat: 6.4531, lng: 3.3958 },
  },
  {
    id: 'berger_ikeja',
    label: 'Ojodu Berger → Ikeja Along',
    origin: { name: 'Ojodu Berger', lat: 6.647, lng: 3.3725 },
    destination: { name: 'Computer Village, Ikeja', lat: 6.5954, lng: 3.3431 },
  },
  {
    id: 'abuja_katari',
    label: 'Abuja Gate → Katari (Kaduna Hwy)',
    origin: { name: 'Zuba / Abuja Junction', lat: 9.1055, lng: 7.1965 },
    destination: { name: 'Katari Corridor', lat: 9.91, lng: 7.44 },
  },
]

// Queries free OpenStreetMap OSRM for actual street geometry between two points.
// Falls back to evenly interpolated waypoints if the user is offline or OSRM times out.
export async function fetchStreetRoute(origin, destination) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) throw new Error('OSRM unavailable')
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      // GeoJSON is [lng, lat]; our backend and Leaflet use [lat, lng].
      // Downsample long highway polylines to ~40 points so H3 corridor stays snappy.
      const step = Math.max(1, Math.floor(coords.length / 40))
      const sampled = coords.filter((_, idx) => idx % step === 0 || idx === coords.length - 1)
      return sampled.map(([lng, lat]) => [lat, lng])
    }
  } catch {
    // Graceful fallback: 16-step linear interpolation so Route Escort still works offline.
  }

  const steps = 16
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return [
      origin.lat + (destination.lat - origin.lat) * t,
      origin.lng + (destination.lng - origin.lng) * t,
    ]
  })
}
