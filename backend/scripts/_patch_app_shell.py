import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
p = r"C:\Users\samad\.gemini\antigravity\scratch\naija-pulse\frontend\src\App.jsx"
s = open(p, encoding="utf-8", newline="").read().replace("\r\n", "\n")

def rep(old, new):
    global s
    if old not in s:
        print("MISSING:", old[:70]); return
    s = s.replace(old, new, 1)
    print("ok:", old[:60].replace("\n", "\\n"))

# --- imports ---
rep("import { Bell, Bot, Map, MessageSquare, Plus, RefreshCw, Route, ShieldCheck } from 'lucide-react'",
    "import { Bell, Home, Map as MapIcon, Route as RouteIcon, ShieldCheck, Sparkles } from 'lucide-react'")
rep("import { useReporterToken } from './hooks/useReporterToken'",
    "import { useReporterToken } from './hooks/useReporterToken'\nimport { useTheme } from './hooks/useTheme'")
rep("import { apiRequest } from './api/client'",
    "import { NIGERIA_CENTER } from './lib/geo'\nimport { NIGERIA_STATES_META } from './lib/localPulseBrain'\nimport { apiRequest } from './api/client'")
rep("import OfflineNotice from './components/common/OfflineNotice'",
    "import OfflineNotice from './components/common/OfflineNotice'\nimport HomePage from './components/home/HomePage'\nimport { Sidebar, MobileHeader } from './components/layout/Chrome'\nimport BottomNav from './components/layout/BottomNav'")

# --- nav ---
start = s.index("const TABS = [")
end = s.index("]\n", start) + 2
s = s[:start] + """const NAV = [
  { id: 'home', label: 'Home', hint: 'National overview', Icon: Home },
  { id: 'map', label: 'Live Map', hint: 'Street-level incidents', Icon: MapIcon },
  { id: 'route', label: 'Route Escort', hint: 'Check your commute', Icon: RouteIcon },
  { id: 'agency', label: 'Agency HQ', hint: 'Triage & dispatch desk', Icon: ShieldCheck },
  { id: 'chat', label: 'Pulse AI', hint: 'Ask anything', Icon: Sparkles },
  { id: 'alerts', label: 'Alerts & Places', hint: 'Watch zones & inbox', Icon: Bell },
]
const MORE_IDS = ['route', 'agency', 'alerts']
""" + s[end:]

rep("  const [tab, setTab] = useState('map')",
    "  const { theme, toggleTheme } = useTheme()\n  const [tab, setTab] = useState('home')\n  const [mapMounted, setMapMounted] = useState(false)")

# lazy-mount the map once the user first needs it, then keep it alive across tabs
rep("  const isOfflineDemo = backend !== 'online'",
    """  const showMap = tab === 'map' || tab === 'route'
  useEffect(() => {
    if (showMap) setMapMounted(true)
  }, [showMap])

  const isOfflineDemo = backend !== 'online'""")

# after submitting a report, jump to the map so the new pin is visible
rep("""      setSelectedIncident(res.incident)
      setFlyTarget({ lat: res.incident.latitude, lng: res.incident.longitude, zoom: 14 })
      return
    }""", """      setSelectedIncident(res.incident)
      setTab('map')
      setFlyTarget({ lat: res.incident.latitude, lng: res.incident.longitude, zoom: 14, _ts: Date.now() })
      return
    }""")
rep("""    setSelectedIncident(incident)
    setFlyTarget({ lat: incident.latitude, lng: incident.longitude, zoom: 14 })

    // Trigger simulated alert""", """    setSelectedIncident(incident)
    setTab('map')
    setFlyTarget({ lat: incident.latitude, lng: incident.longitude, zoom: 14, _ts: Date.now() })

    // Trigger simulated alert""")

# --- replace the JSX return ---
ret = s.index("  return (\n    <div className=\"flex h-full w-full flex-col overflow-hidden text-slate-100\">")
s = s[:ret] + r"""  // --- Navigation helpers ---
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
    setSelectedHexInfo(null)
    setMapCenter({ lat: target.lat, lng: target.lng })
    setFlyTarget({ ...target, zoom: target.zoom || 12, _ts: Date.now() })
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

  const panelOpen = tab === 'route' || Boolean(selectedIncident) || Boolean(selectedHexInfo)
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
                flyTarget={flyTarget}
                zoomStepSignal={zoomStepSignal}
                mapCenter={mapCenter}
                onCenterChange={setMapCenter}
                showHexGrid={showHexGrid}
                mapLayers={mapLayers}
                hexStats={hexStats}
                selectedHex={selectedHexInfo?.h3Index || null}
                onSelectHex={(info) => {
                  setSelectedIncident(null)
                  setSelectedHexInfo(info)
                }}
                onSelectIncident={(inc) => {
                  setSelectedHexInfo(null)
                  setSelectedIncident(inc)
                }}
                pickMode={pickMode}
                pickedLocation={pickedLocation}
                onPickCoordinate={(coords) => {
                  setPickedLocation(coords)
                  setPickMode(false)
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
                  showHexGrid={showHexGrid}
                  onToggleHexGrid={() => setShowHexGrid((v) => !v)}
                  mapLayers={mapLayers}
                  onToggleMapLayer={handleToggleMapLayer}
                  onJumpToArea={(area) => {
                    setMapCenter({ lat: area.lat, lng: area.lng })
                    setFlyTarget({ ...area, _ts: Date.now() })
                  }}
                  onZoomStep={(delta) => setZoomStepSignal({ delta, _ts: Date.now() })}
                  onLocateUser={() => {
                    if (gpsPosition) {
                      setMapCenter(gpsPosition)
                      setFlyTarget({ ...gpsPosition, zoom: 14, _ts: Date.now() })
                    } else {
                      setMapCenter(LAGOS)
                      setFlyTarget({ ...LAGOS, zoom: 12, _ts: Date.now() })
                    }
                  }}
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

              {tab === 'map' && selectedHexInfo && !selectedIncident && (
                <HexRatingSheet
                  hexInfo={selectedHexInfo}
                  onSubmitRating={handleRateHex}
                  onClose={() => setSelectedHexInfo(null)}
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
"""
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("written", len(s))
