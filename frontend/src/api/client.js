import { getReporterToken } from '../lib/reporterToken'

// One small wrapper around fetch(). Every API file (incidents.js, monitors.js, ...)
// goes through it, so the device token header and error handling live in ONE place.
//
// Paths are relative ('/api/v1/...'); Vite's dev proxy forwards them to FastAPI.

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Reporter-Token': getReporterToken(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, data?.detail || response.statusText)
  }
  return data
}

// Concept: multipart file upload gotcha.
// When sending FormData (for photos), you must NOT set Content-Type yourself —
// the browser needs to attach the random boundary string automatically.
export async function apiUploadFile(path, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'X-Reporter-Token': getReporterToken(),
    },
    body: formData,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, data?.detail || response.statusText)
  }
  return data
}
