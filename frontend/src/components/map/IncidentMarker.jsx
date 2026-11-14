import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { getCategory } from '../../lib/categories'

// Concept: divIcon. Instead of image files, each marker is a small HTML element
// that we style with the category colour. No image assets, and we can change
// the look from data, such as fading unconfirmed reports.

function buildIcon(incident) {
  const { color, emoji } = getCategory(incident.category_code)
  const resolved = incident.status === 'resolved' || incident.agency_status === 'resolved'
  const dispatched = !resolved && incident.agency_status === 'dispatched'
  const unconfirmed = !resolved && incident.status === 'unconfirmed'

  // Unconfirmed: faded dashed ring. Dispatched: cyan pulse ring. Resolved: emerald ring. Confirmed: solid glow.
  const style = resolved
    ? 'background:#059669aa;border:2px solid #34d399;box-shadow:0 0 8px #10b981;'
    : unconfirmed
      ? `background:${color}55;border:2px dashed ${color};`
      : dispatched
        ? `background:${color};border:2.5px solid #38bdf8;box-shadow:0 0 12px #38bdf8;`
        : `background:${color};border:2px solid #fff;box-shadow:0 0 10px ${color};`

  const badge = resolved
    ? '<span style="position:absolute;top:-4px;right:-4px;background:#10b981;color:#022c22;font-size:9px;font-weight:800;border-radius:999px;padding:0 3px;line-height:13px;">✓</span>'
    : dispatched
      ? '<span style="position:absolute;top:-4px;right:-4px;background:#0284c7;color:#fff;font-size:9px;font-weight:800;border-radius:999px;padding:0 3px;line-height:13px;">⚡</span>'
      : ''

  return L.divIcon({
    className: '', // drop Leaflet's default white square
    html: `<div style="position:relative;${style}width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;">${emoji}${badge}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

export default function IncidentMarker({ incident, onSelect }) {
  return (
    <Marker
      position={[incident.latitude, incident.longitude]}
      icon={buildIcon(incident)}
      eventHandlers={{ click: () => onSelect(incident) }}
    />
  )
}
