import { apiRequest } from './client'

export function fetchMonitors() {
  return apiRequest('/api/v1/monitors')
}

export function createMonitor(payload) {
  return apiRequest('/api/v1/monitors', {
    method: 'POST',
    body: payload,
  })
}

export function checkRouteSafety({ routeCoordinates, bufferRing = 1 }) {
  return apiRequest('/api/v1/monitors/route-check', {
    method: 'POST',
    body: {
      route_coordinates: routeCoordinates,
      buffer_ring: bufferRing,
    },
  })
}
