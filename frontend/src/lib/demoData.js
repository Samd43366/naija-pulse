import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js'
import { distanceDecayWeight, haversineMeters } from './geo'
import { safeUUID } from './reporterToken'
import researchedNewsSeed from '../data/researchedNewsSeed.json'

// Researched Nigerian News & Agency Intelligence Seed + Offline Simulation Engine.
// Loads all researched real-world Nigerian news incidents (and any newly RSS-scraped items)
// from `src/data/researchedNewsSeed.json` so the live map is immediately populated nationwide.
// When FastAPI + PostGIS comes online (/health returns 200), App.jsx switches seamlessly to live DB queries.

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function hoursAheadIso(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString()
}

const DEFAULT_UNITS_BY_CAT = {
  power_outage: 'TCN / DisCo Line Crew',
  flood: 'NEMA / SEMA Flood Response',
  kidnapping_security: 'Police / JTF Tactical Patrol',
  road_condition: 'FRSC / Highway Works Unit',
  disaster_fire: 'State Fire & LASEMA Strike Unit',
  other: 'NCDC / Municipal Field Team',
}

export function makeSeededIncident(item, idx = 0) {
  const {
    external_id,
    category_code,
    title,
    summary,
    news_outlet,
    state_name,
    lga_name,
    lat,
    lng,
    trust_score,
    status,
    report_count,
    confirm_count,
    dispute_count,
    source,
    hours_ago = 1.5,
    ttl_hours = 12,
    witness_notes = [],
  } = item

  const h3_res7 = latLngToCell(lat, lng, 7)
  const h3_res8 = latLngToCell(lat, lng, 8)
  const sensitive = category_code === 'kidnapping_security'
  const [pubLat, pubLng] = sensitive ? cellToLatLng(h3_res7) : [lat, lng]

  const notes = witness_notes.length > 0 ? witness_notes : [summary]

  // Deterministic initial agency triage state so Agency Command HQ shows realistic operational readiness
  const isOfficial = source === 'official' || source === 'nema' || source === 'acled'
  const agency_status =
    status === 'resolved'
      ? 'resolved'
      : isOfficial && trust_score >= 0.87 && idx % 3 === 0
        ? 'dispatched'
        : 'pending'
  const assigned_unit =
    agency_status === 'dispatched'
      ? `${state_name || 'National'} · ${DEFAULT_UNITS_BY_CAT[category_code] || 'Rapid Response'}`
      : null

  return {
    id: external_id,
    external_id,
    category_code,
    title,
    summary,
    news_outlet,
    state_name: state_name || 'Lagos',
    lga_name: lga_name || 'Local Zone',
    h3_res7,
    h3_res8,
    latitude: pubLat,
    longitude: pubLng,
    status,
    agency_status,
    assigned_unit,
    trust_score,
    report_count,
    confirm_count,
    dispute_count,
    first_reported_at: hoursAgoIso(hours_ago),
    last_activity_at: hoursAgoIso(hours_ago * 0.55),
    expires_at: hoursAheadIso(ttl_hours),
    source,
    reports: notes.map((note, rIdx) => ({
      id: `${external_id}-r${rIdx + 1}`,
      incident_id: external_id,
      h3_index: h3_res8,
      description: note,
      media_url: null,
      observed_at: hoursAgoIso(Math.max(0.1, hours_ago - rIdx * 0.2)),
      created_at: hoursAgoIso(Math.max(0.1, hours_ago - rIdx * 0.2)),
    })),
  }
}

export function buildInitialDemoIncidents() {
  return researchedNewsSeed.map((item, idx) => makeSeededIncident(item, idx))
}

// Loads the full 836-incident nationwide dataset (all 36 Nigerian States + FCT, >= 21 cases/state)
// from our self-hosted public geo asset. Zero external API or network dependencies!
export async function loadNationwideSeedIncidents() {
  const response = await fetch('/geo/nigeria_incidents_seed.json')
  if (!response.ok) {
    throw new Error(`Failed to fetch nationwide seed: ${response.status}`)
  }
  const rawList = await response.json()
  return rawList.map((item, idx) => makeSeededIncident(item, idx))
}

export function buildInitialDemoHexStats(incidents) {
  const byHex = {}
  for (const inc of incidents) {
    const h = inc.h3_res8
    const isSec = inc.category_code === 'kidnapping_security'
    const isFlood = inc.category_code === 'flood'
    const isFire = inc.category_code === 'disaster_fire'
    const isPower = inc.category_code === 'power_outage'

    const prev = byHex[h]
    byHex[h] = {
      h3_index: h,
      lga_name: inc.lga_name || prev?.lga_name || 'Local Zone',
      state_name: inc.state_name || prev?.state_name || 'Nigeria',
      historical_security_risk: Math.max(
        prev?.historical_security_risk || 0,
        isSec ? 0.72 : isFire ? 0.36 : 0.16,
      ),
      historical_flood_risk: Math.max(
        prev?.historical_flood_risk || 0,
        isFlood ? 0.78 : 0.2,
      ),
      community_safety_score: isSec ? 2.0 : isFire ? 2.7 : prev?.community_safety_score || 3.8,
      community_power_score: isPower ? 1.9 : prev?.community_power_score || 3.4,
      community_livability_score: prev?.community_livability_score || 3.6,
      active_incident_count: (prev?.active_incident_count || 0) + 1,
      total_historical_reports: (prev?.total_historical_reports || 8) + (inc.report_count || 1),
    }
  }
  return Object.values(byHex)
}

// Local simulation of backend deduplication + privacy blurring when offline.
export function simulateOfflineReport(incidents, reportIn) {
  const h3_res8 = latLngToCell(reportIn.latitude, reportIn.longitude, 8)
  const h3_res7 = latLngToCell(reportIn.latitude, reportIn.longitude, 7)

  const matchIdx = incidents.findIndex(
    (inc) =>
      inc.category_code === reportIn.category_code &&
      haversineMeters(inc.latitude, inc.longitude, reportIn.latitude, reportIn.longitude) <= 800,
  )

  const newReport = {
    id: safeUUID(),
    incident_id: matchIdx >= 0 ? incidents[matchIdx].id : safeUUID(),
    h3_index: h3_res8,
    description: reportIn.description,
    media_url: reportIn.media_url || null,
    observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }

  if (matchIdx >= 0) {
    const target = incidents[matchIdx]
    const nextTrust = Math.min(1, Number((target.trust_score + 0.1).toFixed(2)))
    const merged = {
      ...target,
      report_count: target.report_count + 1,
      trust_score: nextTrust,
      status: nextTrust >= 0.65 ? 'active' : target.status,
      last_activity_at: new Date().toISOString(),
      reports: [newReport, ...(target.reports || [])],
    }
    const nextList = [...incidents]
    nextList[matchIdx] = merged
    return { nextList, incident: merged, merged: true }
  }

  const sensitive = reportIn.category_code === 'kidnapping_security'
  const [pubLat, pubLng] = sensitive
    ? cellToLatLng(h3_res7)
    : [reportIn.latitude, reportIn.longitude]

  const created = {
    id: newReport.incident_id,
    category_code: reportIn.category_code,
    title:
      reportIn.description.length > 60
        ? `${reportIn.description.slice(0, 60)}...`
        : reportIn.description,
    summary: reportIn.description,
    news_outlet: 'Citizen Live Report',
    state_name: reportIn.state_name || 'Lagos',
    lga_name: reportIn.lga_name || 'Local Zone',
    h3_res7,
    h3_res8,
    latitude: pubLat,
    longitude: pubLng,
    status: 'unconfirmed',
    agency_status: 'pending',
    assigned_unit: null,
    trust_score: 0.35,
    report_count: 1,
    confirm_count: 0,
    dispute_count: 0,
    first_reported_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    expires_at: hoursAheadIso(6),
    source: 'crowd',
    reports: [newReport],
  }

  return { nextList: [created, ...incidents], incident: created, merged: false }
}

// Local simulation of Bayesian distance-weighted voting when offline.
export function simulateOfflineVerify(incident, { vote, latitude, longitude }) {
  const distance_m = haversineMeters(incident.latitude, incident.longitude, latitude, longitude)
  const weight = Number((distanceDecayWeight(distance_m) * 0.5).toFixed(3))
  const confirm_count = incident.confirm_count + (vote === 1 ? 1 : 0)
  const dispute_count = incident.dispute_count + (vote === -1 ? 1 : 0)

  const delta = vote === 1 ? weight * 0.28 : -weight * 0.28
  const new_trust_score = Number(Math.min(1, Math.max(0.05, incident.trust_score + delta)).toFixed(3))
  const incident_status =
    new_trust_score >= 0.65
      ? 'active'
      : new_trust_score < 0.2 && dispute_count >= 3
        ? 'resolved'
        : incident.status

  return {
    incident_id: incident.id,
    vote,
    weight,
    distance_m,
    new_trust_score,
    incident_status,
    confirm_count,
    dispute_count,
  }
}

// Local simulation of Route Safety Escort when offline.
export function simulateOfflineRouteCheck(routeCoords, incidents, hexStats, bufferRing = 1) {
  const hexSet = new Set()
  for (const [lat, lng] of routeCoords) {
    const center = latLngToCell(lat, lng, 8)
    for (const h of gridDisk(center, bufferRing)) hexSet.add(h)
  }
  const route_hexes = Array.from(hexSet)
  const active_incidents = incidents.filter((inc) => hexSet.has(inc.h3_res8))
  const matchingStats = hexStats.filter((s) => hexSet.has(s.h3_index))
  const avgRisk = matchingStats.length
    ? Number(
        (
          matchingStats.reduce((sum, s) => sum + s.historical_security_risk, 0) /
          matchingStats.length
        ).toFixed(3),
      )
    : 0.14

  const hasSecurity = active_incidents.some(
    (i) => i.category_code === 'kidnapping_security' && i.trust_score >= 0.4,
  )
  const hasFlood = active_incidents.some(
    (i) => i.category_code === 'flood' && i.trust_score >= 0.5,
  )

  let overall_safety_rating = 'CLEAR'
  let safety_advisory = 'Route appears clear. No active hazards or elevated historical risk cells.'

  if (hasSecurity) {
    overall_safety_rating = 'HIGH_ALERT'
    safety_advisory =
      'CRITICAL: Security incident reported along this corridor. Consider alternative routes or daytime convoy travel.'
  } else if (hasFlood) {
    overall_safety_rating = 'MODERATE_RISK'
    safety_advisory =
      'CAUTION: Active flooding reported in an H3 cell on your path. Low-clearance vehicles should reroute.'
  } else if (active_incidents.length > 0) {
    overall_safety_rating = 'MODERATE_RISK'
    safety_advisory = `NOTICE: ${active_incidents.length} active incident(s) intersect your commute corridor.`
  }

  return {
    route_hexes,
    overall_safety_rating,
    average_historical_risk: avgRisk,
    active_incidents_count: active_incidents.length,
    active_incidents,
    safety_advisory,
  }
}
