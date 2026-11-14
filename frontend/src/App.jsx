import { useCallback, useEffect, useState } from 'react'
import { Bell, Home, Map as MapIcon, Route as RouteIcon, ShieldCheck, Sparkles } from 'lucide-react'
import { gridDisk, latLngToCell } from 'h3-js'

import { useReporterToken } from './hooks/useReporterToken'
import { useTheme } from './hooks/useTheme'
import { safeUUID } from './lib/reporterToken'
import { LAGOS, useGeolocation } from './hooks/useGeolocation'
import { NIGERIA_CENTER } from './lib/geo'
import { NIGERIA_STATES_META } from './lib/localPulseBrain'
import { normalizeIncident } from './lib/incidentModel'
import { submitReport, verifyIncident } from './api/incidents'
import { rateHexArea } from './api/hexStats'
import { checkRouteSafety, createMonitor, fetchMonitors } from './api/monitors'
import { fetchAlerts, markAlertRead } from './api/alerts'
import {
  simulateOfflineReport,
  simulateOfflineRouteCheck,
  simulateOfflineVerify,
} from './lib/demoData'

import MapView from './components/map/MapView'
import MapSearchBox from './components/map/MapSearchBox'
import FilterBar from './components/map/FilterBar'
import MapControls from './components/map/MapControls'
import IncidentDetailSheet from './components/incidents/IncidentDetailSheet'
import QuickReportModal from './components/incidents/QuickReportModal'
import RouteEscortDrawer from './components/route/RouteEscortDrawer'
import AlertsAndMonitorsPanel from './components/alerts/AlertsAndMonitorsPanel'
import AgencyDashboardPanel from './components/agency/AgencyDashboardPanel'
import PulseChatbotPanel from './components/chat/PulseChatbotPanel'
import OfflineNotice from './components/common/OfflineNotice'
import HomePage from './components/home/HomePage'
import { Sidebar, MobileHeader } from './components/layout/Chrome'
import BottomNav from './components/layout/BottomNav'
import { useIncidentFeed } from './hooks/useIncidentFeed'

const NAV = [
  { id: 'home', label: 'Home', hint: 'National overview', Icon: Home },
  { id: 'map', label: 'Live Map', hint: 'Street-level incidents', Icon: MapIcon },
  { id: 'route', label: 'Route Escort', hint: 'Check your commute', Icon: RouteIcon },
  { id: 'agency', label: 'Agency HQ', hint: 'Triage & dispatch desk', Icon: ShieldCheck },
  { id: 'chat', label: 'Pulse AI', hint: 'Ask anything', Icon: Sparkles },
  { id: 'alerts', label: 'Alerts & Places', hint: 'Watch zones & inbox', Icon: Bell },
]
const MORE_IDS = ['route', 'agency', 'alerts']

export default function App() {
  useReporterToken() // ensures persistent zero-login UUID exists in localStorage
  const {
    position: gpsPosition,
    accuracy: gpsAccuracy,
    status: gpsStatus,
    error: gpsError,
    locate: requestGpsLocation,
  } = useGeolocation()

  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState('home')
  const [mapMounted, setMapMounted] = useState(false)
  const [backend, setBackend] = useState('checking') // 'checking' | 'online' | 'api_ready' | 'offline'
  const [showSmsBanner, setShowSmsBanner] = useState(false)

  // Map & filter state (opens on Lagos street/district layout; 1-tap Compass zooms out to All Nigeria)
  const [category, setCategory] = useState(null)
  const [withinHours, setWithinHours] = useState(null)
  const [mapLayers, setMapLayers] = useState({
    topography: true,
    rivers: true,
    states: true,
    areas: true,
    roads: true,
    places: true,
  })
  const [mapCenter, setMapCenter] = useState(LAGOS)
  const [flyTarget, setFlyTarget] = useState(null)
  const [zoomStepSignal, setZoomStepSignal] = useState(null)

  const handleToggleMapLayer = useCallback((layerKey) => {
    setMapLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }))
  }, [])

  const { incidents, setIncidents, visibleIncidents, hexStats, setHexStats, syncFromBackend } = useIncidentFeed({
    category,
    withinHours,
    mapCenter,
    onBackendChange: setBackend,
  })
  const [monitors, setMonitors] = useState([])
  const [alerts, setAlerts] = useState([])

  // Active modals / sheets
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [pickedLocation, setPickedLocation] = useState(null)

  // Route Safety Escort state
  const [routeCoords, setRouteCoords] = useState(null)
  const [routeResult, setRouteResult] = useState(null)

  const showMap = tab === 'map' || tab === 'route'
  useEffect(() => {
    if (showMap) setMapMounted(true)
  }, [showMap])

  const isOfflineDemo = backend !== 'online'
  const voterCoords = gpsPosition || mapCenter

  useEffect(() => {
    if (backend !== 'online') return
    let cancelled = false
    const refreshUserData = async () => {
      try {
        const [liveMonitors, liveAlerts] = await Promise.all([fetchMonitors(), fetchAlerts()])
        if (cancelled) return
        setMonitors(liveMonitors || [])
        setAlerts(liveAlerts?.alerts || [])
      } catch {
        // Retry on the next interval; incident feed owns backend status.
      }
    }
    refreshUserData()
    const timer = setInterval(refreshUserData, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [backend])

  const unreadAlerts = alerts.filter((a) => !a.read_at).length

  // --- Handlers (talk to FastAPI when online, or mirror logic locally in demo mode) ---

  async function handleSubmitReport(reportPayload) {
    if (!isOfflineDemo) {
      const res = await submitReport(reportPayload)
      await syncFromBackend()
      setSelectedIncident(res.incident)
      setTab('map')
      setFlyTarget({ lat: res.incident.latitude, lng: res.incident.longitude, zoom: 14, _ts: Date.now() })
      return
    }
    const { nextList, incident } = simulateOfflineReport(incidents, reportPayload)
    const normalizedIncident = normalizeIncident(incident)
    setIncidents(normalizeIncidents(nextList))
    setSelectedIncident(normalizedIncident)
    setTab('map')
    setFlyTarget({ lat: normalizedIncident.latitude, lng: normalizedIncident.longitude, zoom: 14, _ts: Date.now() })

    // Trigger simulated alert if any saved monitor watches this H3 cell
    for (const m of monitors) {
      if (m.monitored_hexes?.includes(incident.h3_res8)) {
        setAlerts((prev) => [
          {
            id: safeUUID(),
            title: `Alert (${m.label}): ${incident.title}`,
            message: `New report inside your watched zone.`,
            created_at: new Date().toISOString(),
            read_at: null,
          },
          ...prev,
        ])
      }
    }
  }

  async function handleVote(incident, votePayload) {
    const res = !isOfflineDemo
      ? await verifyIncident(incident.id, votePayload)
      : simulateOfflineVerify(incident, votePayload)

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incident.id
          ? {
              ...inc,
              trust_score: res.new_trust_score,
              status: res.incident_status,
              confirm_count: res.confirm_count,
              dispute_count: res.dispute_count,
              last_activity_at: new Date().toISOString(),
            }
          : inc,
      ),
    )
    setSelectedIncident((prev) =>
      prev && prev.id === incident.id
        ? {
            ...prev,
            trust_score: res.new_trust_score,
            status: res.incident_status,
            confirm_count: res.confirm_count,
            dispute_count: res.dispute_count,
          }
        : prev,
    )
    return res
  }

  async function handleRateHex(h3Index, ratingPayload) {
    if (!isOfflineDemo) {
      const updated = await rateHexArea(h3Index, ratingPayload)
      setHexStats((prev) => {
        const filtered = prev.filter((s) => s.h3_index !== h3Index)
        return [updated, ...filtered]
      })
      setSelectedHexInfo((prev) => (prev ? { ...prev, stat: updated } : null))
      return
    }
    const updated = {
      h3_index: h3Index,
      lga_name: selectedHexInfo?.stat?.lga_name || 'Community Rated Zone',
      state_name: selectedHexInfo?.stat?.state_name || 'Nigeria',
      historical_security_risk: selectedHexInfo?.stat?.historical_security_risk ?? 0.14,
      historical_flood_risk: selectedHexInfo?.stat?.historical_flood_risk ?? 0.16,
      community_safety_score: ratingPayload.safety_rating,
      community_power_score: ratingPayload.power_rating,
      community_livability_score: ratingPayload.livability_rating,
      active_incident_count: selectedHexInfo?.cellIncidents?.length || 0,
      total_historical_reports: 1,
    }
    setHexStats((prev) => [updated, ...prev.filter((s) => s.h3_index !== h3Index)])
    setSelectedHexInfo((prev) => (prev ? { ...prev, stat: updated } : null))
  }

  async function handleRunRouteCheck(coords, preset) {
    setRouteCoords(coords)
    if (preset) {
      const midLat = (preset.origin.lat + preset.destination.lat) / 2
      const midLng = (preset.origin.lng + preset.destination.lng) / 2
      setFlyTarget({ lat: midLat, lng: midLng, zoom: 11 })
    }
    const res = !isOfflineDemo
      ? await checkRouteSafety({ routeCoordinates: coords, bufferRing: 1 })
      : simulateOfflineRouteCheck(coords, incidents, hexStats, 1)
    setRouteResult(res)
  }

  async function handleCreateMonitor(monitorPayload) {
    if (!isOfflineDemo) {
      const created = await createMonitor(monitorPayload)
      setMonitors((prev) => [created, ...prev])
      return
    }
    let hexes = []
    if (monitorPayload.monitor_type === 'point') {
      const c = latLngToCell(monitorPayload.latitude, monitorPayload.longitude, 8)
      hexes = gridDisk(c, (monitorPayload.radius_m || 1500) > 1000 ? 2 : 1)
    } else if (monitorPayload.route_coordinates) {
      const set = new Set()
      for (const [lat, lng] of monitorPayload.route_coordinates) {
        for (const h of gridDisk(latLngToCell(lat, lng, 8), 1)) set.add(h)
      }
      hexes = Array.from(set)
    }
    setMonitors((prev) => [
      {
        id: safeUUID(),
        label: monitorPayload.label,
        monitor_type: monitorPayload.monitor_type,
        monitored_hex_count: hexes.length,
        monitored_hexes: hexes,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  async function handleMarkAlertRead(alertId) {
    if (!isOfflineDemo) await markAlertRead(alertId)
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a)),
    )
  }

  function handleDispatchIncident(incidentId, unitLabel) {
    const now = new Date().toISOString()
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc
        const logEntry = {
          id: safeUUID(),
          incident_id: inc.id,
          h3_index: inc.h3_res8,
          description: `[AGENCY DISPATCH] ${unitLabel} mobilized to ${inc.lga_name}, ${inc.state_name}.`,
          media_url: null,
          observed_at: now,
          created_at: now,
        }
        return {
          ...inc,
          agency_status: 'dispatched',
          assigned_unit: unitLabel,
          last_activity_at: now,
          reports: [logEntry, ...(inc.reports || [])],
        }
      }),
    )
    setSelectedIncident((prev) =>
      prev && prev.id === incidentId
        ? { ...prev, agency_status: 'dispatched', assigned_unit: unitLabel }
        : prev,
    )
  }

  function handleResolveIncident(incidentId) {
    const now = new Date().toISOString()
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc
        const logEntry = {
          id: safeUUID(),
          incident_id: inc.id,
          h3_index: inc.h3_res8,
          description: `[AGENCY RESOLVED] Incident cleared & verified safe in ${inc.lga_name}, ${inc.state_name}.`,
          media_url: null,
          observed_at: now,
          created_at: now,
        }
        return {
          ...inc,
          status: 'resolved',
          agency_status: 'resolved',
          last_activity_at: now,
          reports: [logEntry, ...(inc.reports || [])],
        }
      }),
    )
    setSelectedIncident((prev) =>
      prev && prev.id === incidentId
        ? { ...prev, status: 'resolved', agency_status: 'resolved' }
        : prev,
    )
  }

  // --- Navigation helpers ---
  function navigate(id) {
    if (id !== 'map') setPickMode(false)
    setTab(id)
  }

  function openReport() {
    setReportModalOpen(true)
  }

  function flyTo(target) {
    setTab('map')
    setSelectedIncident(null)
    setMapCenter({ lat: target.lat, lng: target.lng })
    setFlyTarget({ ...target, zoom: target.zoom || 12, _ts: Date.now() })
  }

  function handleLocateUser() {
    requestGpsLocation((coords) => {
      setMapCenter({ lat: coords.lat, lng: coords.lng })
      setFlyTarget({ lat: coords.lat, lng: coords.lng, zoom: 15, _ts: Date.now() })
    })
    if (gpsPosition) {
      setMapCenter(gpsPosition)
      setFlyTarget({ ...gpsPosition, zoom: 15, _ts: Date.now() })
    }
  }

  function focusIncident(inc) {
    setTab('map')
    setSelectedHexInfo(null)
    setSelectedIncident(inc)
    setMapCenter({ lat: inc.latitude, lng: inc.longitude })
    setFlyTarget({ lat: inc.latitude, lng: inc.longitude, zoom: 13, _ts: Date.now() })
  }

  function openMapFromHome(opts) {
    if (opts && 'category' in opts) setCategory(opts.category)
    setTab('map')
    setSelectedIncident(null)
    setFlyTarget({ ...NIGERIA_CENTER, _ts: Date.now() })
  }

  const panelOpen = tab === 'route' || Boolean(selectedIncident)
  const moreItems = NAV.filter((n) => MORE_IDS.includes(n.id))

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-ink">
      <Sidebar
        items={NAV}
        activeId={tab}
        onNavigate={navigate}
        onReport={openReport}
        backend={backend}
        onRecheck={syncFromBackend}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSms={() => setShowSmsBanner((v) => !v)}
        incidentCount={incidents.length}
        unreadAlerts={unreadAlerts}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader
          backend={backend}
          onRecheck={syncFromBackend}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <OfflineNotice forceShow={showSmsBanner} />

        {/* Main content (min-h-0 prevents flex overflow on mobile Safari/Chrome) */}
        <main className="relative min-h-0 flex-1 overflow-hidden bg-bg">
          {tab === 'home' && (
            <HomePage
              incidents={incidents}
              onReport={openReport}
              onOpenMap={openMapFromHome}
              onNavigate={navigate}
              onFocusIncident={focusIncident}
              onFlyToState={(t) => flyTo({ ...t, zoom: 9 })}
              stateCentroids={NIGERIA_STATES_META}
            />
          )}

          {tab === 'alerts' && (
            <AlertsAndMonitorsPanel
              monitors={monitors}
              alerts={alerts}
              defaultCoords={gpsPosition || mapCenter}
              onCreatePointMonitor={handleCreateMonitor}
              onMarkAlertRead={handleMarkAlertRead}
            />
          )}

          {tab === 'agency' && (
            <AgencyDashboardPanel
              incidents={incidents}
              onDispatchIncident={handleDispatchIncident}
              onResolveIncident={handleResolveIncident}
              onInspectOnMap={focusIncident}
              onFlyToState={flyTo}
            />
          )}

          {tab === 'chat' && <PulseChatbotPanel incidents={incidents} onFlyToPlace={flyTo} />}

          {/* The map stays mounted once opened, so your camera position survives tab switches */}
          {mapMounted && (
            <div className={showMap ? 'absolute inset-0' : 'hidden'}>
              <MapView
                theme={theme}
                incidents={visibleIncidents}
                position={gpsPosition}
                accuracy={gpsAccuracy}
                flyTarget={flyTarget}
                zoomStepSignal={zoomStepSignal}
                mapCenter={mapCenter}
                onCenterChange={setMapCenter}
                mapLayers={mapLayers}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc)
                }}
                pickMode={pickMode}
                pickedLocation={pickedLocation}
                onPickCoordinate={(coords) => {
                  setPickedLocation(coords)
                  setPickMode(false)
                  setReportModalOpen(true)
                }}
                onReportHere={(coords) => {
                  setPickedLocation(coords)
                  setReportModalOpen(true)
                }}
                routeCoords={tab === 'route' ? routeCoords : null}
                routeResult={tab === 'route' ? routeResult : null}
              />

              {/* Top search + filters (map tab only) */}
              {tab === 'map' && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 lg:p-5">
                  <div className="pointer-events-auto w-full lg:max-w-md">
                    <MapSearchBox onSelectPlace={flyTo} />
                    <FilterBar
                      selectedCategory={category}
                      onCategoryChange={setCategory}
                      withinHours={withinHours}
                      onRecencyChange={setWithinHours}
                      totalShown={visibleIncidents.length}
                    />
                  </div>
                  {pickMode && (
                    <p className="glass pointer-events-auto mt-3 w-full rounded-2xl px-4 py-2.5 text-center text-sm font-semibold text-brand lg:max-w-md">
                      📌 Tap anywhere on the map to drop your incident pin
                    </p>
                  )}
                </div>
              )}

              {/* Legend (desktop) */}
              {tab === 'map' && !panelOpen && (
                <div className="glass pointer-events-none absolute bottom-6 left-5 z-[900] hidden rounded-2xl px-3.5 py-3 text-[11px] text-ink-2 lg:block">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
                    Map key
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1 w-4 rounded bg-warn" /> Bridge
                      <span className="ml-1 h-1 w-4 rounded bg-[#f59e0b]" /> Expressway
                      <span className="ml-1 h-1 w-4 rounded bg-ink-3" /> Street
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full ring-2 ring-info" /> Dispatched
                      <span className="ml-1 h-2.5 w-2.5 rounded-full ring-2 ring-ok" /> Resolved
                      <span className="ml-1 h-2.5 w-2.5 rounded-full border-2 border-dashed border-ink-3" /> Unconfirmed
                    </span>
                  </div>
                </div>
              )}

              {/* Floating map controls */}
              <div
                className={`absolute bottom-4 right-3 z-[900] flex-col items-end lg:bottom-6 lg:right-5 ${
                  panelOpen ? 'hidden lg:flex lg:!right-[26rem]' : 'flex'
                }`}
              >
                <MapControls
                  mapLayers={mapLayers}
                  onToggleMapLayer={handleToggleMapLayer}
                  onJumpToArea={(area) => {
                    setMapCenter({ lat: area.lat, lng: area.lng })
                    setFlyTarget({ ...area, _ts: Date.now() })
                  }}
                  onZoomStep={(delta) => setZoomStepSignal({ delta, _ts: Date.now() })}
                  onLocateUser={handleLocateUser}
                  gpsStatus={gpsStatus}
                  gpsError={gpsError}
                  hasGps={Boolean(gpsPosition)}
                />
              </div>

              {/* Side panels / bottom sheets */}
              {tab === 'map' && selectedIncident && (
                <IncidentDetailSheet
                  incident={selectedIncident}
                  voterCoords={voterCoords}
                  isOfflineDemo={isOfflineDemo}
                  onVote={handleVote}
                  onClose={() => setSelectedIncident(null)}
                />
              )}

              {tab === 'route' && (
                <RouteEscortDrawer
                  routeCoords={routeCoords}
                  routeResult={routeResult}
                  onRunRouteCheck={handleRunRouteCheck}
                  onSaveCorridorMonitor={handleCreateMonitor}
                  onFocusIncident={focusIncident}
                  onClose={() => setTab('home')}
                />
              )}
            </div>
          )}
        </main>

        <BottomNav
          activeId={tab}
          onNavigate={navigate}
          onReport={openReport}
          moreItems={moreItems}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSms={() => setShowSmsBanner((v) => !v)}
          unreadAlerts={unreadAlerts}
        />
      </div>

      {reportModalOpen && (
        <QuickReportModal
          gpsPosition={gpsPosition}
          mapCenter={mapCenter}
          pickedLocation={pickedLocation}
          onRequestMapPick={() => {
            setReportModalOpen(false)
            setTab('map')
            setPickMode(true)
          }}
          isOfflineDemo={isOfflineDemo}
          onSubmitReport={handleSubmitReport}
          onClose={() => {
            setReportModalOpen(false)
            setPickedLocation(null)
          }}
        />
      )}
    </div>
  )
}
