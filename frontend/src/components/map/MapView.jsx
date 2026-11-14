import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  CircleMarker,
  Marker,
  ScaleControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import NigeriaVectorBasemap from './NigeriaVectorBasemap'
import IncidentMarker from './IncidentMarker'
import UserLocationMarker from './UserLocationMarker'
import RouteCorridorLayer from './RouteCorridorLayer'
import { getCategory } from '../../lib/categories'
import { LAGOS } from '../../hooks/useGeolocation'

// Fixes the classic Leaflet mobile viewport bug where half the map stays blank/cut off
// when iOS Safari or Android Chrome resizes its address/navigation bars.
function MobileViewportFix() {
  const map = useMap()
  useEffect(() => {
    const refresh = () => map.invalidateSize()
    const t1 = setTimeout(refresh, 100)
    const t2 = setTimeout(refresh, 400)
    const container = map.getContainer()
    let observer = null
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(() => map.invalidateSize())
      observer.observe(container)
    }
    window.addEventListener('orientationchange', refresh)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      observer?.disconnect()
      window.removeEventListener('orientationchange', refresh)
    }
  }, [map])
  return null
}

// Imperatively flies or zooms the Leaflet camera whenever `flyTarget` or `zoomStepSignal` changes.
function CameraController({ flyTarget, zoomStepSignal }) {
  const map = useMap()
  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lng], flyTarget.zoom || 12, { duration: 0.85 })
    }
  }, [flyTarget, map])

  useEffect(() => {
    if (zoomStepSignal) {
      map.setZoom(map.getZoom() + zoomStepSignal.delta)
    }
  }, [zoomStepSignal, map])

  return null
}

// Listens for map movement and clicks (e.g. when dropping a custom pin for a report)
function MapEventsBridge({ onCenterChange, pickMode, onPickCoordinate }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter()
      onCenterChange?.({ lat: c.lat, lng: c.lng })
    },
    click(e) {
      if (pickMode && onPickCoordinate) {
        onPickCoordinate({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
  })
  return null
}

function buildStateClusterIcon(cluster) {
  const { shortLabel, count, accentColor } = cluster
  return L.divIcon({
    className: '',
    html: `
      <div style="display:inline-flex;align-items:center;gap:5px;background:var(--surface);border:1.5px solid ${accentColor};box-shadow:0 3px 12px rgba(0,0,0,0.25);border-radius:999px;padding:3px 8px;white-space:nowrap;font-family:system-ui,sans-serif;cursor:pointer;transition:transform 0.15s ease;">
        <span style="width:7px;height:7px;border-radius:50%;background:${accentColor};display:inline-block;box-shadow:0 0 6px ${accentColor};"></span>
        <span style="color:var(--ink);font-size:11px;font-weight:700;letter-spacing:0.01em;">${shortLabel}</span>
        <span style="background:${accentColor}25;color:${accentColor};font-size:10px;font-weight:800;border-radius:999px;padding:1px 5px;line-height:12px;">${count}</span>
      </div>
    `,
    iconSize: [82, 24],
    iconAnchor: [41, 12],
  })
}

function buildPickedPinIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="background:#10b981;color:#ffffff;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.35);border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800;display:flex;align-items:center;gap:4px;">
          <span>📌</span> Incident Location
        </div>
        <div style="width:2px;height:10px;background:#10b981;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
        <div style="width:6px;height:6px;border-radius:50%;background:#10b981;"></div>
      </div>
    `,
    iconSize: [120, 36],
    iconAnchor: [60, 36],
  })
}

const PICKED_PIN_ICON = buildPickedPinIcon()

// Concept: Zoom-Adaptive Spatial Rendering (LOD — Level of Detail).
// With 836+ nationwide incidents across all 36 States + FCT, rendering 836 DOM pins at once
// at national zoom (< 9) crowds the map and slows down phones.
// - At zoom < 9: renders fast canvas/SVG micro-dots for all incidents + 37 interactive State Cluster Pills.
// - At zoom >= 9: viewport-culls incidents to visible bounds (+0.22° buffer) and renders full interactive pins.
function ZoomAdaptiveIncidentLayer({ incidents, onSelectIncident }) {
  const map = useMap()
  const [viewState, setViewState] = useState(() => {
    const b = map.getBounds()
    return {
      zoom: map.getZoom(),
      south: b.getSouth(),
      north: b.getNorth(),
      west: b.getWest(),
      east: b.getEast(),
    }
  })

  useMapEvents({
    moveend(e) {
      const m = e.target
      const b = m.getBounds()
      setViewState({
        zoom: m.getZoom(),
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      })
    },
    zoomend(e) {
      const m = e.target
      const b = m.getBounds()
      setViewState({
        zoom: m.getZoom(),
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      })
    },
  })

  const isMacroNationalView = viewState.zoom < 9

  const stateClusters = useMemo(() => {
    if (!isMacroNationalView) return []
    const byState = new Map()
    for (const inc of incidents) {
      const st = inc.state_name || 'Nigeria'
      let entry = byState.get(st)
      if (!entry) {
        entry = {
          stateName: st,
          shortLabel:
            st === 'FCT Abuja'
              ? 'FCT'
              : st === 'Cross River'
                ? 'C.River'
                : st === 'Akwa Ibom'
                  ? 'A.Ibom'
                  : st,
          count: 0,
          latSum: 0,
          lngSum: 0,
          secCount: 0,
          fireCount: 0,
          floodCount: 0,
        }
        byState.set(st, entry)
      }
      entry.count += 1
      entry.latSum += inc.latitude
      entry.lngSum += inc.longitude
      if (inc.category_code === 'kidnapping_security') entry.secCount += 1
      else if (inc.category_code === 'disaster_fire') entry.fireCount += 1
      else if (inc.category_code === 'flood') entry.floodCount += 1
    }

    return Array.from(byState.values()).map((g) => {
      const accentColor =
        g.secCount >= 4 || g.fireCount >= 4
          ? '#ef4444'
          : g.floodCount >= 6
            ? '#3b82f6'
            : '#f59e0b'
      return {
        ...g,
        lat: g.latSum / g.count,
        lng: g.lngSum / g.count,
        accentColor,
      }
    })
  }, [incidents, isMacroNationalView])

  const viewportIncidents = useMemo(() => {
    if (isMacroNationalView) return []
    const pad = 0.22
    const inBounds = incidents.filter(
      (inc) =>
        inc.latitude >= viewState.south - pad &&
        inc.latitude <= viewState.north + pad &&
        inc.longitude >= viewState.west - pad &&
        inc.longitude <= viewState.east + pad,
    )
    if (inBounds.length <= 120) return inBounds
    return [...inBounds].sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0)).slice(0, 120)
  }, [incidents, isMacroNationalView, viewState])

  if (isMacroNationalView) {
    return (
      <>
        {incidents.map((inc) => {
          const { color } = getCategory(inc.category_code)
          return (
            <CircleMarker
              key={`dot-${inc.id}`}
              center={[inc.latitude, inc.longitude]}
              radius={3}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: color,
                fillOpacity: 0.75,
              }}
            />
          )
        })}
        {stateClusters.map((cluster) => (
          <Marker
            key={`state-cluster-${cluster.stateName}`}
            position={[cluster.lat, cluster.lng]}
            icon={buildStateClusterIcon(cluster)}
            eventHandlers={{
              click: () => map.flyTo([cluster.lat, cluster.lng], 9.5, { duration: 0.75 }),
            }}
          />
        ))}
      </>
    )
  }

  return (
    <>
      {viewportIncidents.map((incident) => (
        <IncidentMarker key={incident.id} incident={incident} onSelect={onSelectIncident} />
      ))}
    </>
  )
}

export default function MapView({
  incidents,
  position,
  accuracy,
  flyTarget,
  zoomStepSignal,
  mapCenter,
  onCenterChange,
  mapLayers,
  onSelectIncident,
  pickMode,
  pickedLocation,
  onPickCoordinate,
  onReportHere,
  routeCoords,
  routeResult,
  theme = 'dark',
}) {
  return (
    <MapContainer
      center={[LAGOS.lat, LAGOS.lng]}
      zoom={12}
      minZoom={5}
      maxZoom={16}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 h-full w-full"
    >
      <NigeriaVectorBasemap key={theme} layers={mapLayers} pickMode={pickMode} theme={theme} />
      <ScaleControl position="bottomleft" imperial={false} />

      <MobileViewportFix />
      <CameraController flyTarget={flyTarget} zoomStepSignal={zoomStepSignal} />
      <MapEventsBridge
        onCenterChange={onCenterChange}
        pickMode={pickMode}
        onPickCoordinate={onPickCoordinate}
      />

      <RouteCorridorLayer routeCoords={routeCoords} routeResult={routeResult} />

      {/* User real-time GPS location beacon with accuracy circle */}
      {position && (
        <UserLocationMarker
          position={position}
          accuracy={accuracy}
          onReportHere={onReportHere}
        />
      )}

      {/* Tapped custom pin */}
      {pickedLocation && (
        <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={PICKED_PIN_ICON} />
      )}

      {/* Level-of-Detail incident rendering */}
      <ZoomAdaptiveIncidentLayer incidents={incidents} onSelectIncident={onSelectIncident} />
    </MapContainer>
  )
}
