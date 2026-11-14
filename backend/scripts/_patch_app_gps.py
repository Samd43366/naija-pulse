p = r'C:\Users\samad\.gemini\antigravity\scratch\naija-pulse\frontend\src\App.jsx'
s = open(p, encoding='utf-8').read()

# 1. Update useGeolocation destructuring
old_geo = 'const { position: gpsPosition } = useGeolocation()'
new_geo = '''const {
    position: gpsPosition,
    accuracy: gpsAccuracy,
    status: gpsStatus,
    error: gpsError,
    locate: requestGpsLocation,
  } = useGeolocation()'''
assert old_geo in s, 'old_geo not found'
s = s.replace(old_geo, new_geo, 1)

# 2. Remove showHexGrid state and selectedHexInfo state
s = s.replace('  const [showHexGrid, setShowHexGrid] = useState(true)\n', '')
s = s.replace('  const [selectedHexInfo, setSelectedHexInfo] = useState(null)\n', '')
s = s.replace("import HexRatingSheet from './components/map/HexRatingSheet'\n", '')

# 3. Update handleLocateUser and flyTo
old_fly = '''  function flyTo(target) {
    setTab('map')
    setSelectedIncident(null)
    setSelectedHexInfo(null)
    setMapCenter({ lat: target.lat, lng: target.lng })
    setFlyTarget({ ...target, zoom: target.zoom || 12, _ts: Date.now() })
  }'''
new_fly = '''  function flyTo(target) {
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
  }'''
assert old_fly in s, 'old_fly not found'
s = s.replace(old_fly, new_fly, 1)

# 4. Update panelOpen
old_panel = "const panelOpen = tab === 'route' || Boolean(selectedIncident) || Boolean(selectedHexInfo)"
new_panel = "const panelOpen = tab === 'route' || Boolean(selectedIncident)"
assert old_panel in s, 'old_panel not found'
s = s.replace(old_panel, new_panel, 1)

# 5. Update MapView and MapControls JSX
old_mapview = '''              <MapView
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
              />'''

new_mapview = '''              <MapView
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
              />'''
assert old_mapview in s, 'old_mapview not found'
s = s.replace(old_mapview, new_mapview, 1)

# 6. Update MapControls JSX
old_mapctrl = '''                <MapControls
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
                />'''

new_mapctrl = '''                <MapControls
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
                />'''
assert old_mapctrl in s, 'old_mapctrl not found'
s = s.replace(old_mapctrl, new_mapctrl, 1)

# 7. Remove HexRatingSheet JSX block
old_hexsheet = '''              {tab === 'map' && selectedHexInfo && !selectedIncident && (
                <HexRatingSheet
                  hexInfo={selectedHexInfo}
                  onSubmitRating={handleRateHex}
                  onClose={() => setSelectedHexInfo(null)}
                />
              )}\n\n'''
assert old_hexsheet in s, 'old_hexsheet not found'
s = s.replace(old_hexsheet, '')

open(p, 'w', encoding='utf-8').write(s)
print('Successfully patched App.jsx!')
