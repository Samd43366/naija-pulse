import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../api/client'
import { fetchHexStats, rateHexArea } from '../api/hexStats'
import { fetchIncidents } from '../api/incidents'
import { buildInitialDemoHexStats, buildInitialDemoIncidents, loadNationwideSeedIncidents } from '../lib/demoData'
import { normalizeIncident, normalizeIncidents } from '../lib/incidentModel'

export function useIncidentFeed({ category, withinHours, mapCenter, onBackendChange }) {
  const [incidents, setIncidents] = useState([])
  const [hexStats, setHexStats] = useState([])
  const demoLoadedRef = useRef(false)

  const loadDemoData = useCallback(async () => {
    if (demoLoadedRef.current) return
    demoLoadedRef.current = true
    const initial = normalizeIncidents(buildInitialDemoIncidents())
    setIncidents(initial)
    setHexStats(buildInitialDemoHexStats(initial))
    try {
      const fullList = await loadNationwideSeedIncidents()
      const normalized = normalizeIncidents(fullList)
      setIncidents(normalized)
      setHexStats(buildInitialDemoHexStats(normalized))
    } catch {
      // The smaller bundled set remains available in development mode.
    }
  }, [])

  const syncFromBackend = useCallback(async () => {
    try {
      const health = await apiRequest('/health')
      if (!health?.db_connected) {
        if (health?.live_mode) {
          setIncidents([])
          setHexStats([])
          onBackendChange?.('unavailable')
        } else {
          await loadDemoData()
          onBackendChange?.('api_ready')
        }
        return
      }
      const [liveIncidents, liveStats] = await Promise.all([
        fetchIncidents({ category, withinHours }),
        fetchHexStats({ lat: mapCenter.lat, lng: mapCenter.lng, ringK: 3 }),
      ])
      if (liveIncidents?.length) setIncidents(normalizeIncidents(liveIncidents))
      if (liveStats) setHexStats(liveStats)
      onBackendChange?.('online')
    } catch {
      onBackendChange?.('offline')
    }
  }, [category, withinHours, mapCenter.lat, mapCenter.lng, onBackendChange, loadDemoData])

  useEffect(() => {
    syncFromBackend()
    const timer = setInterval(syncFromBackend, 30_000)
    return () => clearInterval(timer)
  }, [syncFromBackend])

  const visibleIncidents = useMemo(() => incidents.filter((inc) => {
    if (category && inc.category_code !== category) return false
    if (withinHours) {
      const ageHours = (Date.now() - new Date(inc.last_activity_at).getTime()) / 3_600_000
      if (ageHours > withinHours) return false
    }
    return true
  }), [incidents, category, withinHours])

  const applyIncident = useCallback((incident) => {
    const normalized = normalizeIncident(incident)
    setIncidents((prev) => prev.map((item) => item.id === normalized.id ? normalized : item))
    return normalized
  }, [])

  const rateHex = useCallback(async (h3Index, payload, isOfflineDemo) => {
    if (!isOfflineDemo) {
      const updated = await rateHexArea(h3Index, payload)
      setHexStats((prev) => [updated, ...prev.filter((item) => item.h3_index !== h3Index)])
      return updated
    }
    return null
  }, [])

  return { incidents, setIncidents, visibleIncidents, hexStats, setHexStats, syncFromBackend, applyIncident, rateHex }
}

