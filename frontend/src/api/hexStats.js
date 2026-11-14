import { apiRequest } from './client'

export function fetchHexStats({ lat, lng, ringK = 3 } = {}) {
  const params = new URLSearchParams()
  if (lat !== undefined && lng !== undefined) {
    params.set('lat', String(lat))
    params.set('lng', String(lng))
    params.set('ring_k', String(ringK))
  }
  const query = params.toString()
  return apiRequest(`/api/v1/hex-stats${query ? `?${query}` : ''}`)
}

export function rateHexArea(h3Index, payload) {
  return apiRequest(`/api/v1/hex-stats/${h3Index}/rate`, {
    method: 'POST',
    body: payload,
  })
}
