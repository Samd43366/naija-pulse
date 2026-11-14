import L from 'leaflet'
import { Circle, Marker, Popup } from 'react-leaflet'

function buildUserBeaconIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <span style="position:absolute;width:28px;height:28px;border-radius:999px;background:#38bdf8;opacity:0.4;animation:pulse-beacon 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:absolute;width:18px;height:18px;border-radius:999px;background:#0284c7;opacity:0.6;"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:999px;background:#0ea5e9;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></span>
      </div>
      <style>
        @keyframes pulse-beacon {
          0% { transform: scale(0.6); opacity: 0.8; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      </style>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const BEACON_ICON = buildUserBeaconIcon()

export default function UserLocationMarker({ position, accuracy, onReportHere }) {
  if (!position) return null

  const { lat, lng } = position
  const safeAccuracy = Math.min(Math.max(accuracy || 25, 10), 1200)

  return (
    <>
      {/* Accuracy bubble */}
      <Circle
        center={[lat, lng]}
        radius={safeAccuracy}
        pathOptions={{
          stroke: true,
          color: '#0284c7',
          weight: 1,
          opacity: 0.45,
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
        }}
        interactive={false}
      />

      {/* Pulsing GPS dot */}
      <Marker position={[lat, lng]} icon={BEACON_ICON}>
        <Popup className="custom-user-popup">
          <div className="p-1 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
              Your Current Location
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
              {accuracy ? ` · Accurate to ±${accuracy}m` : ''}
            </p>
            {onReportHere && (
              <button
                type="button"
                onClick={() => onReportHere(position)}
                className="mt-2 w-full rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
              >
                Report incident here
              </button>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  )
}
