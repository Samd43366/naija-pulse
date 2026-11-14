import { apiRequest, apiUploadFile } from './client'
import { normalizeIncident, normalizeIncidents } from '../lib/incidentModel'

// GET /api/v1/incidents: live, unexpired incidents.
// Sensitive categories already come back with blurred coordinates from the backend.
export function fetchIncidents({ category, withinHours } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (withinHours) params.set('within_hours', String(withinHours))
  const query = params.toString()
  return apiRequest(`/api/v1/incidents${query ? `?${query}` : ''}`).then(normalizeIncidents)
}

// GET /api/v1/incidents/{id}: full incident with merged citizen reports.
export function fetchIncidentDetail(incidentId) {
  return apiRequest(`/api/v1/incidents/${incidentId}`).then(normalizeIncident)
}

// POST /api/v1/incidents/report: zero-login report (auto-merges duplicates).
export function submitReport(payload) {
  return apiRequest('/api/v1/incidents/report', {
    method: 'POST',
    body: payload,
  }).then((response) => ({ ...response, incident: normalizeIncident(response?.incident) }))
}

// POST /api/v1/incidents/{id}/verify: Feature 1 One-Tap Community Ping (+1 / -1).
export function verifyIncident(incidentId, { vote, latitude, longitude }) {
  return apiRequest(`/api/v1/incidents/${incidentId}/verify`, {
    method: 'POST',
    body: { vote, latitude, longitude },
  })
}

// POST /api/v1/media/upload: Feature 5 photo upload with automatic EXIF/GPS stripping.
export function uploadSanitizedPhoto(file) {
  return apiUploadFile('/api/v1/media/upload', file)
}
