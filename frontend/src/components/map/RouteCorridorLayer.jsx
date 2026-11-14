import { CircleMarker, Polygon, Polyline } from 'react-leaflet'
import { cellToBoundary } from 'h3-js'

const RATING_COLORS = {
  CLEAR: '#10b981',
  MODERATE_RISK: '#f59e0b',
  HIGH_ALERT: '#ef4444',
}

// Renders Feature 2 (Route Safety Escort) directly on the map:
//   1. Each H3 hexagon in the buffered corridor (`route_hexes`)
//   2. The street polyline itself
//   3. Origin (green) and Destination (sky-blue) pins
export default function RouteCorridorLayer({ routeCoords, routeResult }) {
  if (!routeCoords || routeCoords.length < 2) return null

  const color = RATING_COLORS[routeResult?.overall_safety_rating] || '#38bdf8'
  const hexes = routeResult?.route_hexes || []
  const start = routeCoords[0]
  const end = routeCoords[routeCoords.length - 1]

  return (
    <>
      {hexes.map((h) => (
        <Polygon
          key={`route-${h}`}
          positions={cellToBoundary(h)}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.16,
            weight: 1.2,
            dashArray: '4 4',
          }}
        />
      ))}

      <Polyline
        positions={routeCoords}
        pathOptions={{ color, weight: 4, opacity: 0.95 }}
      />

      <CircleMarker
        center={start}
        radius={7}
        pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
      />
      <CircleMarker
        center={end}
        radius={7}
        pathOptions={{ color: '#fff', fillColor: '#38bdf8', fillOpacity: 1, weight: 2 }}
      />
    </>
  )
}
