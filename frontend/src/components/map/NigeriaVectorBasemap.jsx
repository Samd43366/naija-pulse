import { useCallback, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, Marker, Pane, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'

// Hypsometric (elevation) color scale — dark-mode physical cartography palette
const TOPO_STYLES = {
  lowland_delta: { fillColor: '#0d9488', color: '#14b8a6', fillOpacity: 0.19 }, // 0–50m Niger Delta & Coast
  basin: { fillColor: '#4d7c0f', color: '#65a30d', fillOpacity: 0.14 },         // 240–320m Chad Basin
  upland: { fillColor: '#b45309', color: '#d97706', fillOpacity: 0.18 },        // 300–650m Yoruba / Udi Hills
  high_plain: { fillColor: '#c2410c', color: '#ea580c', fillOpacity: 0.20 },    // 500–900m Hausaland High Plains
  plateau: { fillColor: '#ea580c', color: '#fb923c', fillOpacity: 0.28 },       // 900–1,829m Jos / Adamawa / Obudu
  montane_peak: { fillColor: '#dc2626', color: '#f87171', fillOpacity: 0.36 },  // 1,500–2,419m Mambilla / Chappal Waddi
}

// Theme palettes: the atlas is drawn in a dark "night atlas" style for the dark theme and
// a clean cream / sky-blue "daylight atlas" style for the light theme.
const PALETTES = {
  dark: {
    zoneFill: {
      'North-West': '#152536',
      'North-East': '#182434',
      'North-Central': '#142836',
      'South-West': '#132a34',
      'South-East': '#172738',
      'South-South': '#112b33',
    },
    zoneDefault: '#152636',
    graticule: '#1e3a5f',
    graticuleOpacity: 0.32,
    bight: '#38bdf866',
    neighborFill: '#0b1522',
    neighborLine: '#22334a',
    neighborLabel: '#475569',
    stateLine: '#5b85aa',
    stateLineOff: '#263c52',
    urbanFill: '#223549',
    urbanLine: '#334e68',
    parkFill: '#115e59',
    parkLine: '#14b8a6',
    lgaLine: '#466a8a',
    gridLine: '#475f78',
    trunkMajor: '#94a3b8',
    trunkMinor: '#64748b',
    casing: '#09111e',
    rail: '#38bdf8',
    bridge: '#fde047',
    expressway: '#f59e0b',
    street: '#e2e8f0',
    lakeFill: '#0369a1',
    lakeLine: '#38bdf8',
    urbanWaterFill: '#07192e',
    urbanWaterLine: '#0ea5e9',
    riverMajor: '#38bdf8',
    riverMinor: '#0ea5e9',
    frontier: '#10b981',
    stateLabel: '#cbd5e1',
    lgaLabel: '#7dd3fc',
    areaMajor: '#f1f5f9',
    area: '#cbd5e1',
    halo: '0 1px 3px #020617,0 0 6px #020617',
    haloStrong: '0 1px 4px #000,0 0 5px #000',
    streetBadgeBg: '#020617cc',
    streetBadgeBorder: '#33415599',
    streetBridge: '#fde047',
    streetExpy: '#fcd34d',
    streetPlain: '#94a3b8',
    place: '#a7f3d0',
    peak: '#fdba74',
    confluence: '#7dd3fc',
    capital: '#fde047',
    city: '#f8fafc',
  },
  light: {
    zoneFill: {
      'North-West': '#f3efe3',
      'North-East': '#f1ecdd',
      'North-Central': '#eef0df',
      'South-West': '#e9f0df',
      'South-East': '#f0eedf',
      'South-South': '#e5efe0',
    },
    zoneDefault: '#f0eee2',
    graticule: '#8fb0c8',
    graticuleOpacity: 0.5,
    bight: '#2b7fb0aa',
    neighborFill: '#e9e6dc',
    neighborLine: '#c4bfae',
    neighborLabel: '#8a8f87',
    stateLine: '#8ea597',
    stateLineOff: '#cbd3c9',
    urbanFill: '#e3dccb',
    urbanLine: '#cdc4ae',
    parkFill: '#b6dfbd',
    parkLine: '#4fa66f',
    lgaLine: '#7b95a8',
    gridLine: '#b9b3a3',
    trunkMajor: '#8a8d84',
    trunkMinor: '#acaea4',
    casing: '#b8b2a0',
    rail: '#0b6fb8',
    bridge: '#e3a800',
    expressway: '#ec8a10',
    street: '#ffffff',
    lakeFill: '#7cc3ea',
    lakeLine: '#2b8cc4',
    urbanWaterFill: '#a6d4ee',
    urbanWaterLine: '#3c9ad1',
    riverMajor: '#2b8cc4',
    riverMinor: '#4ea9dc',
    frontier: '#008751',
    stateLabel: '#2c4638',
    lgaLabel: '#2b6a93',
    areaMajor: '#10231a',
    area: '#3a4f43',
    halo: '0 0 3px #fff,0 0 5px #fff,0 0 8px #fff',
    haloStrong: '0 0 3px #fff,0 0 5px #fff,0 0 8px #fff',
    streetBadgeBg: '#ffffffd9',
    streetBadgeBorder: '#c8cfc5',
    streetBridge: '#8a5a00',
    streetExpy: '#9a5400',
    streetPlain: '#55665c',
    place: '#0b6b43',
    peak: '#a8480a',
    confluence: '#1f78ad',
    capital: '#9a5b00',
    city: '#10231a',
  },
}

const PLACE_ICONS = {
  airport: '✈️',
  university: '🎓',
  market: '🏪',
  hospital: '🏥',
  terminal: '🚌',
  civic: '🏛️',
  stadium: '🏟️',
}

const DEFAULT_LAYERS = {
  topography: true,
  rivers: true,
  states: true,
  areas: true,
  roads: true,
  places: true,
}

function makeTextIcon(html, width = 130, height = 20) {
  return L.divIcon({
    className: '',
    html,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  })
}

function inBounds(bounds, lat, lng) {
  if (!bounds) return true
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  )
}

// Multi-Scale Self-Hosted Vector Atlas of Nigeria:
// - Zoom 5–8:   36 States + FCT, Elevation Topography, Rivers/Lakes, Federal Trunk Highways
// - Zoom 8–11:  All 774 Local Government Areas (LGAs), State Capitals & Regional Towns
// - Zoom 11–16: Urban Built-up Footprints, Green Parks/Campuses, Lagoons & Creeks,
//               Local Street-Block Grids, Dual-Cased Expressways, Bridges, Named Streets,
//               Neighborhoods/Estates & Landmarks/Places (Airports, Universities, Markets, Hospitals)
export default function NigeriaVectorBasemap({
  layers = DEFAULT_LAYERS,
  pickMode = false,
  theme = 'dark',
}) {
  const map = useMap()
  const P = PALETTES[theme] || PALETTES.dark
  const [atlas, setAtlas] = useState(null)
  const [lgas, setLgas] = useState(null)
  const [detail, setDetail] = useState(null)
  const [zoom, setZoom] = useState(() => map.getZoom() || 6)
  const [bounds, setBounds] = useState(() => {
    const b = map.getBounds()
    return {
      south: b.getSouth() - 0.15,
      north: b.getNorth() + 0.15,
      west: b.getWest() - 0.15,
      east: b.getEast() + 0.15,
    }
  })

  const syncViewport = useCallback((m) => {
    setZoom(m.getZoom())
    const b = m.getBounds()
    setBounds({
      south: b.getSouth() - 0.12,
      north: b.getNorth() + 0.12,
      west: b.getWest() - 0.12,
      east: b.getEast() + 0.12,
    })
  }, [])

  useMapEvents({
    zoomend(e) {
      syncViewport(e.target)
    },
    moveend(e) {
      syncViewport(e.target)
    },
  })

  useEffect(() => {
    fetch('/geo/nigeria_atlas.json')
      .then((res) => res.json())
      .then(setAtlas)
      .catch((err) => console.error('Failed to load Nigeria base atlas:', err))

    fetch('/geo/nigeria_lgas.json')
      .then((res) => res.json())
      .then(setLgas)
      .catch(() => {})

    fetch('/geo/nigeria_cities_detail.json')
      .then((res) => res.json())
      .then(setDetail)
      .catch(() => {})
  }, [])

  const graticuleLines = useMemo(() => {
    const lines = []
    for (let lat = 4; lat <= 14; lat += 2) lines.push([[lat, 1.5], [lat, 15.5]])
    for (let lng = 2; lng <= 15; lng += 2) lines.push([[3.5, lng], [14.5, lng]])
    return lines
  }, [])

  if (!atlas) return null

  const allowHover = !pickMode
  const showLgaPolygons = layers.areas && lgas && zoom >= 8
  const showLgaLabels = layers.areas && lgas && zoom >= 9.5 && zoom < 13
  const showUrbanLayout = detail && zoom >= 9.5
  const showStreetGrids = layers.roads && detail && zoom >= 11
  const showCityStreets = layers.roads && detail && zoom >= 9.5
  const showStreetNames = layers.roads && detail && zoom >= 12.5
  const showNeighborhoods = layers.areas && detail && zoom >= 8
  const showPlaces = layers.places && detail && zoom >= 9.5

  // Viewport-culled labels keep mobile 60fps smooth even with 1,000+ features!
  const visibleLgaLabels = showLgaLabels
    ? lgas.features
        .filter((f) => inBounds(bounds, f.properties.lat, f.properties.lng))
        .slice(0, 40)
    : []

  const visibleAreas = showNeighborhoods
    ? detail.areas.filter((a) => {
        if (!inBounds(bounds, a.lat, a.lng)) return false
        if (a.kind === 'Capital' || a.kind === 'City') return zoom >= 7.5
        if (a.kind === 'Town' || a.kind === 'District') return zoom >= 10.5
        return zoom >= 12
      })
    : []

  const visiblePlaces = showPlaces
    ? detail.places.filter((p) => {
        if (!inBounds(bounds, p.lat, p.lng)) return false
        if (p.kind === 'airport') return zoom >= 9.5
        if (p.kind === 'university' || p.kind === 'stadium' || p.kind === 'civic') return zoom >= 11.5
        return zoom >= 12.5
      })
    : []

  const visibleStreetLabels = showStreetNames
    ? detail.streets.features.filter((f) => {
        const { lat, lng, kind } = f.properties
        if (!inBounds(bounds, lat, lng)) return false
        if (kind === 'bridge' || kind === 'expressway') return zoom >= 12
        return zoom >= 13
      })
    : []

  return (
    <>
      {/* 1. Lat/Lng Graticule & Gulf of Guinea Labels */}
      <Pane name="ng-graticule" style={{ zIndex: 205, pointerEvents: 'none' }}>
        {graticuleLines.map((pts, idx) => (
          <Polyline
            key={`grat-${idx}`}
            positions={pts}
            interactive={false}
            pathOptions={{ color: P.graticule, weight: 0.6, opacity: P.graticuleOpacity, dashArray: '3 5' }}
          />
        ))}
        <Marker
          position={[4.02, 4.25]}
          interactive={false}
          icon={makeTextIcon(
            `<div style="color:${P.bight};font-size:10px;font-style:italic;letter-spacing:0.18em;text-align:center;">BIGHT OF BENIN</div>`,
            150,
            18,
          )}
        />
        <Marker
          position={[3.95, 7.65]}
          interactive={false}
          icon={makeTextIcon(
            `<div style="color:${P.bight};font-size:10px;font-style:italic;letter-spacing:0.18em;text-align:center;">BIGHT OF BONNY</div>`,
            150,
            18,
          )}
        />
      </Pane>

      {/* 2. Neighboring West & Central African Countries */}
      <Pane name="ng-neighbors" style={{ zIndex: 208, pointerEvents: 'none' }}>
        <GeoJSON
          key="neighbors"
          data={atlas.neighbors}
          interactive={false}
          style={() => ({
            fillColor: P.neighborFill,
            fillOpacity: 0.96,
            color: P.neighborLine,
            weight: 1,
            dashArray: '4 4',
          })}
        />
        {zoom <= 8 &&
          atlas.neighbors.features.map((f) => {
            const { name, label_lat, label_lng } = f.properties
            if (!name) return null
            return (
              <Marker
                key={`nb-${name}`}
                position={[label_lat, label_lng]}
                interactive={false}
                icon={makeTextIcon(
                  `<div style="color:${P.neighborLabel};font-size:9px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;">${name}</div>`,
                  110,
                  16,
                )}
              />
            )
          })}
      </Pane>

      {/* 3. All 36 Nigerian States + FCT Base Land */}
      <Pane name="ng-states" style={{ zIndex: 212 }}>
        <GeoJSON
          key={`states-${layers.states}-${allowHover}-${zoom >= 10}`}
          data={atlas.states}
          interactive={allowHover && zoom < 9}
          style={(feature) => ({
            fillColor: P.zoneFill[feature.properties.zone] || P.zoneDefault,
            fillOpacity: 0.98,
            color: layers.states ? P.stateLine : P.stateLineOff,
            weight: layers.states ? (zoom >= 8 ? 1.8 : 1.15) : 0.45,
          })}
          onEachFeature={(feature, layer) => {
            if (!allowHover || zoom >= 9) return
            const { name, zone } = feature.properties
            layer.bindTooltip(
              `<div style="font-size:11px"><strong>${name}</strong><br/><span style="opacity:0.75">${zone} Zone</span></div>`,
              { sticky: true, direction: 'top', opacity: 0.92 },
            )
          }}
        />
      </Pane>

      {/* 4. Built-Up Metropolitan Footprints & Green Parks/Campuses (City Layout Layer) */}
      {showUrbanLayout && (
        <Pane name="ng-urban-landuse" style={{ zIndex: 215 }}>
          <GeoJSON
            key="urban-footprints"
            data={detail.urban_footprints}
            interactive={false}
            style={() => ({
              fillColor: P.urbanFill,
              fillOpacity: 0.72,
              color: P.urbanLine,
              weight: 0.7,
            })}
          />
          <GeoJSON
            key={`parks-${allowHover}`}
            data={detail.parks}
            interactive={allowHover}
            style={() => ({
              fillColor: P.parkFill,
              fillOpacity: 0.42,
              color: P.parkLine,
              weight: 0.9,
            })}
            onEachFeature={(f, l) => {
              if (allowHover && f.properties.name) {
                l.bindTooltip(`🌳 ${f.properties.name}`, { sticky: true })
              }
            }}
          />
        </Pane>
      )}

      {/* 5. Topographic & Hypsometric Relief Zones */}
      {layers.topography && (
        <Pane name="ng-topography" style={{ zIndex: 218 }}>
          <GeoJSON
            key={`topography-${allowHover}-${zoom >= 11}`}
            data={atlas.topography}
            interactive={allowHover && zoom < 9}
            style={(feature) => {
              const s = TOPO_STYLES[feature.properties.tier] || TOPO_STYLES.upland
              return {
                fillColor: s.fillColor,
                fillOpacity: zoom >= 11 ? s.fillOpacity * 0.45 : s.fillOpacity,
                color: s.color,
                weight: 0.85,
                dashArray: '2 3',
              }
            }}
            onEachFeature={(feature, layer) => {
              if (!allowHover || zoom >= 9) return
              const { name, elev_m } = feature.properties
              layer.bindTooltip(
                `<div style="font-size:11px">⛰️ <strong>${name}</strong> (${elev_m})</div>`,
                { sticky: true, opacity: 0.92 },
              )
            }}
          />
        </Pane>
      )}

      {/* 6. All 774 Nigerian Local Government Areas (LGAs) Subdivision Borders */}
      {showLgaPolygons && (
        <Pane name="ng-lgas" style={{ zIndex: 221 }}>
          <GeoJSON
            key={`lgas-${allowHover}`}
            data={lgas}
            interactive={allowHover}
            style={() => ({
              fillOpacity: 0,
              color: P.lgaLine,
              weight: zoom >= 11 ? 1.1 : 0.75,
              opacity: zoom >= 10 ? 0.78 : 0.55,
              dashArray: '3 3',
            })}
            onEachFeature={(feature, layer) => {
              if (!allowHover) return
              const { name, state } = feature.properties
              layer.bindTooltip(
                `<div style="font-size:11px"><strong>${name} LGA</strong><br/><span style="opacity:0.75">${state}</span></div>`,
                { sticky: true, opacity: 0.92 },
              )
            }}
          />
        </Pane>
      )}

      {/* 7. Local Urban Street-Block Grids (Street Layout inside Cities) */}
      {showStreetGrids && (
        <Pane name="ng-street-grids" style={{ zIndex: 225, pointerEvents: 'none' }}>
          <GeoJSON
            key="street-grids"
            data={detail.street_grids}
            interactive={false}
            style={() => ({
              color: P.gridLine,
              weight: zoom >= 14 ? 1.35 : zoom >= 12.5 ? 0.95 : 0.65,
              opacity: zoom >= 13 ? 0.62 : 0.42,
            })}
          />
        </Pane>
      )}

      {/* 8. National Trunk Highways + Detailed City Expressways, Bridges, Arterials & Rail */}
      {layers.roads && (
        <Pane name="ng-roads" style={{ zIndex: 229 }}>
          <GeoJSON
            key={`trunk-roads-${allowHover}`}
            data={atlas.roads}
            interactive={allowHover}
            style={(feature) => ({
              color: feature.properties.major ? P.trunkMajor : P.trunkMinor,
              weight: feature.properties.major ? (zoom >= 9 ? 2.0 : 1.35) : 0.95,
              opacity: zoom >= 11 ? 0.35 : zoom >= 8 ? 0.62 : 0.38,
              dashArray: feature.properties.major ? undefined : '4 3',
            })}
            onEachFeature={(feature, layer) => {
              if (allowHover && feature.properties.ref) {
                layer.bindTooltip(`🛣️ ${feature.properties.ref}`, { sticky: true })
              }
            }}
          />

          {showCityStreets && (
            <>
              {/* Dark outer road casing for crisp street visibility */}
              <GeoJSON
                key="city-streets-casing"
                data={detail.streets}
                interactive={false}
                style={(f) => {
                  const k = f.properties.kind
                  if (k === 'rail') return { opacity: 0, weight: 0 }
                  const w = k === 'bridge' ? 5.2 : k === 'expressway' ? 4.4 : 3.2
                  return {
                    color: P.casing,
                    weight: zoom >= 13 ? w : w * 0.68,
                    opacity: 0.85,
                  }
                }}
              />
              {/* Bright inner carriageway */}
              <GeoJSON
                key={`city-streets-fill-${allowHover}`}
                data={detail.streets}
                interactive={allowHover}
                style={(f) => {
                  const k = f.properties.kind
                  if (k === 'rail') {
                    return {
                      color: P.rail,
                      weight: zoom >= 12 ? 1.8 : 1.2,
                      opacity: 0.72,
                      dashArray: '5 5',
                    }
                  }
                  if (k === 'bridge') {
                    return {
                      color: P.bridge,
                      weight: zoom >= 13 ? 3.4 : 2.3,
                      opacity: 0.98,
                    }
                  }
                  if (k === 'expressway') {
                    return {
                      color: P.expressway,
                      weight: zoom >= 13 ? 2.8 : 1.9,
                      opacity: 0.92,
                    }
                  }
                  return {
                    color: P.street,
                    weight: zoom >= 13 ? 2.0 : 1.3,
                    opacity: 0.88,
                  }
                }}
                onEachFeature={(f, layer) => {
                  if (allowHover && f.properties.name) {
                    const icon =
                      f.properties.kind === 'bridge'
                        ? '🌉'
                        : f.properties.kind === 'rail'
                          ? '🚆'
                          : '🛣️'
                    layer.bindTooltip(`${icon} <strong>${f.properties.name}</strong>`, {
                      sticky: true,
                    })
                  }
                }}
              />
            </>
          )}
        </Pane>
      )}

      {/* 9. Rivers, Lakes, Lagoons & Urban Creeks */}
      {layers.rivers && (
        <Pane name="ng-water" style={{ zIndex: 234 }}>
          <GeoJSON
            key={`lakes-${allowHover}`}
            data={atlas.lakes}
            interactive={allowHover}
            style={() => ({
              fillColor: P.lakeFill,
              fillOpacity: 0.82,
              color: P.lakeLine,
              weight: 1,
            })}
            onEachFeature={(feature, layer) => {
              if (allowHover && feature.properties.name) {
                layer.bindTooltip(`💧 ${feature.properties.name}`, { sticky: true })
              }
            }}
          />
          {detail && zoom >= 9.5 && (
            <GeoJSON
              key={`urban-water-${allowHover}`}
              data={detail.urban_water}
              interactive={allowHover}
              style={() => ({
                fillColor: P.urbanWaterFill,
                fillOpacity: 0.94,
                color: P.urbanWaterLine,
                weight: 1.15,
              })}
              onEachFeature={(f, layer) => {
                if (allowHover && f.properties.name) {
                  layer.bindTooltip(`🌊 ${f.properties.name}`, { sticky: true })
                }
              }}
            />
          )}
          <GeoJSON
            key={`rivers-${allowHover}`}
            data={atlas.rivers}
            interactive={allowHover}
            style={(feature) => {
              const major = feature.properties.major
              return {
                color: major ? P.riverMajor : P.riverMinor,
                weight: major ? (zoom >= 8 ? 3.4 : 2.3) : zoom >= 8 ? 1.5 : 1.1,
                opacity: major ? 0.94 : 0.72,
              }
            }}
            onEachFeature={(feature, layer) => {
              if (allowHover && feature.properties.name) {
                layer.bindTooltip(`🌊 River ${feature.properties.name}`, { sticky: true })
              }
            }}
          />
        </Pane>
      )}

      {/* 10. Re-draw Bridges ABOVE Lagoons & Creeks so Third Mainland / Eko / Lekki-Ikoyi span cleanly over water! */}
      {showCityStreets && layers.roads && (
        <Pane name="ng-bridges-top" style={{ zIndex: 238 }}>
          <GeoJSON
            key={`bridges-top-${allowHover}`}
            data={{
              type: 'FeatureCollection',
              features: detail.streets.features.filter((f) => f.properties.kind === 'bridge'),
            }}
            interactive={allowHover}
            style={() => ({
              color: P.bridge,
              weight: zoom >= 13 ? 3.5 : 2.4,
              opacity: 0.98,
            })}
            onEachFeature={(f, l) => {
              if (allowHover) l.bindTooltip(`🌉 <strong>${f.properties.name}</strong>`, { sticky: true })
            }}
          />
        </Pane>
      )}

      {/* 11. Bold National Frontier of Nigeria */}
      <Pane name="ng-frontier" style={{ zIndex: 242, pointerEvents: 'none' }}>
        <GeoJSON
          key="nigeria-outline"
          data={atlas.nigeria_outline}
          interactive={false}
          style={() => ({
            fillOpacity: 0,
            color: P.frontier,
            weight: 2.2,
            opacity: 0.82,
          })}
        />
      </Pane>

      {/* 12. Multi-Scale Cartographic Labels (States, LGAs, Neighborhoods, Streets, Peaks & Places) */}
      <Pane name="ng-labels" style={{ zIndex: 250, pointerEvents: 'none' }}>
        {/* State Names (zoom 5.5 .. 10.5) */}
        {layers.states &&
          zoom >= 5.5 &&
          zoom < 11 &&
          atlas.states.features
            .filter((f) => inBounds(bounds, f.properties.label_lat, f.properties.label_lng))
            .map((f) => {
              const { name, label_lat, label_lng } = f.properties
              const fontSize = zoom >= 8 ? 11.5 : zoom >= 7 ? 9.5 : 8.5
              return (
                <Marker
                  key={`st-lbl-${name}`}
                  position={[label_lat, label_lng]}
                  interactive={false}
                  icon={makeTextIcon(
                    `<div style="color:${P.stateLabel};font-size:${fontSize}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-shadow:${P.halo};text-align:center;white-space:nowrap;opacity:0.88;">${name}</div>`,
                    120,
                    16,
                  )}
                />
              )
            })}

        {/* 774 LGA Names (zoom 9.5 .. 12.9) */}
        {visibleLgaLabels.map((f, idx) => (
          <Marker
            key={`lga-lbl-${f.properties.name}-${idx}`}
            position={[f.properties.lat, f.properties.lng]}
            interactive={false}
            icon={makeTextIcon(
              `<div style="color:${P.lgaLabel};font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-shadow:${P.halo};text-align:center;white-space:nowrap;opacity:0.78;">${f.properties.name}</div>`,
              120,
              14,
            )}
          />
        ))}

        {/* Neighborhoods, Districts, Estates & State Capitals */}
        {visibleAreas.map((a) => {
          const isMajor = a.kind === 'District' || a.kind === 'Capital' || a.kind === 'City'
          return (
            <Marker
              key={`area-${a.name}-${a.state}`}
              position={[a.lat, a.lng]}
              interactive={false}
              icon={makeTextIcon(
                `<div style="color:${isMajor ? P.areaMajor : P.area};font-size:${
                  isMajor ? 10.5 : 9.5
                }px;font-weight:${
                  isMajor ? 700 : 600
                };text-shadow:${P.halo};text-align:center;white-space:nowrap;">${a.name}</div>`,
                135,
                16,
              )}
            />
          )
        })}

        {/* Street & Bridge Name Badges */}
        {visibleStreetLabels.map((f) => {
          const { name, lat, lng, kind } = f.properties
          const tone =
            kind === 'bridge' ? P.streetBridge : kind === 'expressway' ? P.streetExpy : P.streetPlain
          return (
            <Marker
              key={`str-lbl-${name}`}
              position={[lat, lng]}
              interactive={false}
              icon={makeTextIcon(
                `<div style="color:${tone};font-size:8.5px;font-weight:600;background:${P.streetBadgeBg};border:1px solid ${P.streetBadgeBorder};border-radius:4px;padding:1px 4px;display:inline-block;white-space:nowrap;">${name}</div>`,
                160,
                16,
              )}
            />
          )
        })}

        {/* Landmarks, Universities, Markets, Hospitals, Terminals & Airports */}
        {visiblePlaces.map((p) => {
          const emoji = PLACE_ICONS[p.kind] || '📍'
          return (
            <Marker
              key={`plc-${p.name}`}
              position={[p.lat, p.lng]}
              interactive
              icon={makeTextIcon(
                `<div style="color:${P.place};font-size:9px;font-weight:600;text-shadow:${P.halo};text-align:center;white-space:nowrap;">${emoji} ${p.name}</div>`,
                165,
                16,
              )}
            >
              <Popup>
                <div className="min-w-[150px] p-1">
                  <div className="text-sm font-bold">{emoji} {p.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{p.sub || p.kind}</div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Explore this place</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Mountain Peaks, Confluence & National Megacities */}
        {atlas.landmarks.map((lm) => {
          if (!inBounds(bounds, lm.lat, lm.lng)) return null
          if (lm.kind === 'peak' && (!layers.topography || zoom < 5.5 || zoom > 11)) return null
          if (lm.kind === 'confluence' && (!layers.rivers || zoom > 12)) return null

          let badgeHtml = ''
          if (lm.kind === 'peak') {
            badgeHtml = `<div style="color:${P.peak};font-size:9px;font-weight:700;text-shadow:${P.haloStrong};white-space:nowrap;">▲ ${lm.name}</div>`
          } else if (lm.kind === 'confluence') {
            badgeHtml = `<div style="color:${P.confluence};font-size:9px;font-style:italic;text-shadow:${P.haloStrong};white-space:nowrap;">💧 ${lm.name}</div>`
          } else if (lm.kind === 'capital' && zoom < 11) {
            badgeHtml = `<div style="color:${P.capital};font-size:10px;font-weight:800;text-shadow:${P.haloStrong};white-space:nowrap;">★ ${lm.name}</div>`
          } else if ((zoom >= 6.5 && zoom < 11) || (lm.kind === 'megacity' && zoom < 11)) {
            badgeHtml = `<div style="color:${P.city};font-size:10px;font-weight:700;text-shadow:${P.haloStrong};white-space:nowrap;">• ${lm.name}</div>`
          } else {
            return null
          }

          return (
            <Marker
              key={`lm-${lm.name}`}
              position={[lm.lat, lm.lng]}
              interactive={false}
              icon={makeTextIcon(badgeHtml, 160, 16)}
            />
          )
        })}
      </Pane>
    </>
  )
}
