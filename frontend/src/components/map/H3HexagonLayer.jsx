import { useMemo, useState } from 'react'
import { Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { cellToBoundary, cellToCenterChild, cellToParent, gridDisk, latLngToCell } from 'h3-js'

// Concept: Multi-Resolution Uber H3 Discrete Global Grid in the browser.
// - At street/city zoom (zoom >= 9): renders Resolution-8 hexagons (~460m edge, ~0.7 km²)
//   plus a 2-ring around the map center so residents can tap & rate any neighborhood.
// - At national Nigeria zoom (zoom < 9): aggregates into parent Resolution-5 macro-hexagons
//   (~8.5km edge) so regional risk clusters remain clearly visible across all 36 States!

function pickHexStyle(stat, cellIncidents, isSelected, isMacro) {
  const hasCritical = cellIncidents.some((i) =>
    ['kidnapping_security', 'disaster_fire'].includes(i.category_code),
  )
  const hasFlood = cellIncidents.some((i) => i.category_code === 'flood')
  const hasAnyIncident = cellIncidents.length > 0

  let color = '#10b981' // calm / safe emerald
  let fillOpacity = isMacro ? 0.16 : 0.09

  if (hasCritical || (stat && stat.historical_security_risk >= 0.55)) {
    color = '#ef4444'
    fillOpacity = 0.28
  } else if (hasFlood || (stat && stat.historical_flood_risk >= 0.6)) {
    color = '#3b82f6'
    fillOpacity = 0.26
  } else if (hasAnyIncident || (stat && stat.community_safety_score < 2.8)) {
    color = '#f59e0b'
    fillOpacity = 0.24
  } else if (stat) {
    fillOpacity = 0.16
  }

  return {
    color: isSelected ? '#ffffff' : color,
    fillColor: color,
    fillOpacity: isSelected ? Math.min(0.45, fillOpacity + 0.15) : fillOpacity,
    weight: isSelected ? 2.5 : hasAnyIncident ? 1.9 : 1.1,
  }
}

export default function H3HexagonLayer({
  center,
  incidents,
  hexStats,
  selectedHex,
  onSelectHex,
  pickMode = false,
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom() || 6)

  useMapEvents({
    zoomend(e) {
      setZoom(e.target.getZoom())
    },
  })

  const isMacro = zoom < 9

  const cells = useMemo(() => {
    const statsByHex = Object.fromEntries(hexStats.map((s) => [s.h3_index, s]))
    const incidentsByHex = {}
    for (const inc of incidents) {
      if (!inc.h3_res8) continue
      if (!incidentsByHex[inc.h3_res8]) incidentsByHex[inc.h3_res8] = []
      incidentsByHex[inc.h3_res8].push(inc)
    }

    if (isMacro) {
      // National / State overview: rollup Res-8 cells into parent Res-5 macro-hexagons
      const macroGroups = {}
      const ensureMacro = (res8) => {
        const parent = cellToParent(res8, 5)
        if (!macroGroups[parent]) {
          macroGroups[parent] = { cellIncidents: [], stat: null, repRes8: res8 }
        }
        return macroGroups[parent]
      }

      for (const [res8, stat] of Object.entries(statsByHex)) {
        const g = ensureMacro(res8)
        if (!g.stat || stat.historical_security_risk > g.stat.historical_security_risk) {
          g.stat = stat
          g.repRes8 = res8
        }
      }
      for (const [res8, list] of Object.entries(incidentsByHex)) {
        const g = ensureMacro(res8)
        g.cellIncidents.push(...list)
      }

      return Object.entries(macroGroups).map(([macroHex, g]) => ({
        renderHex: macroHex,
        targetRes8: g.repRes8 || cellToCenterChild(macroHex, 8),
        boundary: cellToBoundary(macroHex),
        stat: g.stat,
        cellIncidents: g.cellIncidents,
      }))
    }

    // Street / City view (zoom >= 9): crisp Resolution-8 neighborhood grid
    const hexSet = new Set([
      ...Object.keys(statsByHex),
      ...Object.keys(incidentsByHex),
    ])

    if (center) {
      const centerCell = latLngToCell(center.lat, center.lng, 8)
      for (const h of gridDisk(centerCell, 2)) hexSet.add(h)
    }

    return Array.from(hexSet).map((h3Index) => ({
      renderHex: h3Index,
      targetRes8: h3Index,
      boundary: cellToBoundary(h3Index),
      stat: statsByHex[h3Index] || null,
      cellIncidents: incidentsByHex[h3Index] || [],
    }))
  }, [center, incidents, hexStats, isMacro])

  return (
    <>
      {cells.map(({ renderHex, targetRes8, boundary, stat, cellIncidents }) => (
        <Polygon
          key={renderHex}
          positions={boundary}
          interactive={!pickMode}
          pathOptions={pickHexStyle(
            stat,
            cellIncidents,
            selectedHex === targetRes8 || selectedHex === renderHex,
            isMacro,
          )}
          eventHandlers={{
            click: () => {
              if (!pickMode) {
                onSelectHex({ h3Index: targetRes8, stat, cellIncidents })
              }
            },
          }}
        >
          <Tooltip sticky direction="top" opacity={0.92}>
            <div className="text-xs">
              <strong>
                {isMacro ? 'Regional H3 Cluster' : `Hex ${renderHex.slice(0, 9)}…`}
              </strong>
              <div>
                {cellIncidents.length} live incident(s)
                {stat ? ` · Safety ${stat.community_safety_score}/5` : ' · Tap to rate area'}
              </div>
            </div>
          </Tooltip>
        </Polygon>
      ))}
    </>
  )
}
