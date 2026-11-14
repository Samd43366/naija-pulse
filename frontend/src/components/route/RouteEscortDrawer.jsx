import { useState } from 'react'
import {
  AlertTriangle,
  BookmarkPlus,
  Navigation,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { COMMUTE_PRESETS, fetchStreetRoute } from '../../lib/geo'
import { getCategory } from '../../lib/categories'
import Sheet from '../ui/Sheet'

const BADGE_STYLE = {
  CLEAR: {
    box: 'border-ok/35 bg-ok/10 text-ok',
    label: 'Clear to travel',
    Icon: ShieldCheck,
  },
  MODERATE_RISK: {
    box: 'border-warn/40 bg-warn/12 text-warn',
    label: 'Moderate risk',
    Icon: AlertTriangle,
  },
  HIGH_ALERT: {
    box: 'border-danger/40 bg-danger/10 text-danger',
    label: 'High alert corridor',
    Icon: ShieldAlert,
  },
}

// Feature 2: Route Safety Escort (Commute Risk Advisor).
// Fetches street geometry (OSRM), converts the path into an Uber H3 hexagonal
// corridor on the server, and checks both live crowd incidents and ACLED priors.
export default function RouteEscortDrawer({
  routeCoords,
  routeResult,
  onRunRouteCheck,
  onSaveCorridorMonitor,
  onFocusIncident,
  onClose,
}) {
  const [selectedPresetId, setSelectedPresetId] = useState(COMMUTE_PRESETS[1].id)
  const [customLabel, setCustomLabel] = useState('Route to Office')
  const [checking, setChecking] = useState(false)
  const [savedNotice, setSavedNotice] = useState(null)

  const activePreset =
    COMMUTE_PRESETS.find((p) => p.id === selectedPresetId) || COMMUTE_PRESETS[0]

  async function handleAnalyze() {
    setChecking(true)
    setSavedNotice(null)
    try {
      const coords = await fetchStreetRoute(activePreset.origin, activePreset.destination)
      await onRunRouteCheck(coords, activePreset)
    } finally {
      setChecking(false)
    }
  }

  async function handleSaveRoute() {
    if (!routeCoords || routeCoords.length < 2) return
    await onSaveCorridorMonitor({
      label: `${customLabel}: ${activePreset.label}`,
      monitor_type: 'corridor',
      route_coordinates: routeCoords,
      corridor_ring_buffer: 1,
    })
    setSavedNotice('Commute corridor saved. You will get alerts along this route.')
  }

  const badge = routeResult
    ? BADGE_STYLE[routeResult.overall_safety_rating] || BADGE_STYLE.CLEAR
    : null

  return (
    <Sheet
      onClose={onClose}
      eyebrow="Route Safety Escort"
      eyebrowIcon={Navigation}
      title="Is your commute safe right now?"
      subtitle="Scans travel corridor along your route for live hazards and historical incident data."
      maxHeightClass="max-h-[60dvh]"
    >
      <label className="text-xs font-semibold text-ink-2" htmlFor="route-preset">
        Choose a route
      </label>
      <div className="mt-1.5 flex gap-2">
        <select
          id="route-preset"
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
          className="field flex-1"
        >
          {COMMUTE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <button type="button" disabled={checking} onClick={handleAnalyze} className="btn btn-primary shrink-0">
          {checking ? 'Scanning…' : 'Check route'}
        </button>
      </div>

      {routeResult && badge && (
        <div className="mt-4 space-y-3 pb-1">
          <div className={`rounded-2xl border p-3.5 ${badge.box}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <badge.Icon size={18} />
                {badge.label}
              </span>
              <span className="rounded-full bg-surface/60 px-2 py-0.5 font-mono text-[11px] font-semibold">
                {routeResult.route_hexes.length} cells · {Math.round(routeResult.average_historical_risk * 100)}% prior
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{routeResult.safety_advisory}</p>
          </div>

          {routeResult.active_incidents?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-3">
                Hazards on route ({routeResult.active_incidents.length})
              </p>
              <div className="space-y-1.5">
                {routeResult.active_incidents.map((inc) => {
                  const cat = getCategory(inc.category_code)
                  return (
                    <button
                      type="button"
                      key={inc.id}
                      onClick={() => onFocusIncident(inc)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-left text-xs transition hover:border-line-strong"
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        style={{ background: `${cat.color}22` }}
                      >
                        {cat.emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{inc.title}</span>
                      <span className="shrink-0 font-semibold text-ok">
                        {Math.round(inc.trust_score * 100)}%
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <select
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              aria-label="Name this commute"
              className="field !w-auto"
            >
              <option>Route to Office</option>
              <option>Route Home</option>
              <option>School Run</option>
              <option>Highway Trip</option>
            </select>
            <button type="button" onClick={handleSaveRoute} className="btn btn-soft flex-1">
              <BookmarkPlus size={16} />
              Watch this commute
            </button>
          </div>
          {savedNotice && <p className="text-xs font-medium text-ok">{savedNotice}</p>}
        </div>
      )}
    </Sheet>
  )
}
