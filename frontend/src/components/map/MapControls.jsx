import { useState } from 'react'
import {
  Building2,
  Compass,
  Landmark,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Mountain,
  Navigation,
  Plus,
  Waves,
} from 'lucide-react'
import { NIGERIA_AREAS, NIGERIA_CENTER } from '../../lib/geo'

// Floating map controls: area quick-jump, zoom +/- & Nigeria reset,
// vector atlas layer toggles (Streets, 774 LGAs & Areas, Places, Rivers, Topography),
// and user GPS geolocation trigger.
export default function MapControls({
  mapLayers,
  onToggleMapLayer,
  onJumpToArea,
  onZoomStep,
  onLocateUser,
  gpsStatus = 'idle',
  gpsError = null,
  hasGps = false,
}) {
  const [layersOpen, setLayersOpen] = useState(false)

  const layerItems = [
    { key: 'roads', label: 'Streets, bridges & grid', active: mapLayers.roads, onClick: () => onToggleMapLayer('roads'), Icon: Navigation },
    { key: 'areas', label: '774 LGAs & areas', active: mapLayers.areas, onClick: () => onToggleMapLayer('areas'), Icon: Building2 },
    { key: 'places', label: 'Places & landmarks', active: mapLayers.places, onClick: () => onToggleMapLayer('places'), Icon: Landmark },
    { key: 'rivers', label: 'Rivers & lagoons', active: mapLayers.rivers, onClick: () => onToggleMapLayer('rivers'), Icon: Waves },
    { key: 'topography', label: 'Topography & relief', active: mapLayers.topography, onClick: () => onToggleMapLayer('topography'), Icon: Mountain },
    { key: 'states', label: '36 states + FCT lines', active: mapLayers.states, onClick: () => onToggleMapLayer('states'), Icon: MapPin },
  ]

  const isLocating = gpsStatus === 'locating'
  const isLocated = gpsStatus === 'granted' && hasGps

  return (
    <div className="flex flex-col items-end gap-2.5">
      {gpsError && gpsStatus !== 'locating' && (
        <div
          role="status"
          className="max-w-[260px] rounded-2xl border border-warn/30 bg-surface px-3 py-2 text-right text-[11px] font-medium leading-relaxed text-ink-2 shadow-lg"
        >
          <span className="font-bold text-warn">Location unavailable.</span> {gpsError}
        </div>
      )}
      {layersOpen && (
        <div className="anim-sheet glass w-60 rounded-2xl p-2 shadow-xl">
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Nigeria map layers
          </div>
          <div className="space-y-0.5">
            {layerItems.map(({ key, label, active, onClick, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                role="switch"
                aria-checked={active}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-ink transition hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className={active ? 'text-brand' : 'text-ink-3'} />
                  {label}
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    active ? 'bg-brand' : 'bg-surface-3'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      active ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Region jump */}
      <div className="glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs shadow-md">
        <MapPin size={14} className="shrink-0 text-brand" />
        <select
          aria-label="Jump to a Nigerian region, state or city"
          onChange={(e) => {
            const area = NIGERIA_AREAS.find((a) => a.id === e.target.value)
            if (area) onJumpToArea(area)
          }}
          defaultValue="lagos_mainland"
          className="max-w-[150px] bg-transparent text-xs font-semibold text-ink focus:outline-none"
        >
          {NIGERIA_AREAS.map((area) => (
            <option key={area.id} value={area.id} className="bg-surface text-ink">
              {area.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLayersOpen((v) => !v)}
          aria-expanded={layersOpen}
          className={`glass inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-md transition ${
            layersOpen ? '!border-brand !text-brand ring-2 ring-brand/20' : 'text-ink'
          }`}
        >
          <Layers size={16} />
          Layers
        </button>

        {/* Locate Me button */}
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          title={
            isLocated
              ? 'GPS active · Click to re-center on your location'
              : isLocating
                ? 'Acquiring GPS location…'
                : 'Find my location on the map'
          }
          aria-label="Find my location"
          className={`glass relative grid h-10 w-10 place-items-center rounded-full shadow-md transition ${
            isLocated
              ? '!border-sky-500 !bg-sky-500/20 text-sky-500 ring-2 ring-sky-500/30'
              : isLocating
                ? '!border-brand !bg-brand/10 text-brand'
                : 'text-ink hover:!border-sky-500 hover:text-sky-500'
          }`}
        >
          {isLocating ? (
            <Loader2 size={18} className="animate-spin text-brand" />
          ) : (
            <>
              <LocateFixed size={18} />
              {isLocated && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500"></span>
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Zoom stack */}
      <div className="glass flex flex-col overflow-hidden rounded-2xl text-ink shadow-md">
        <button
          type="button"
          onClick={() => onZoomStep?.(1)}
          aria-label="Zoom in"
          className="grid h-10 w-10 place-items-center transition hover:bg-surface-2"
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          onClick={() => onZoomStep?.(-1)}
          aria-label="Zoom out"
          className="grid h-10 w-10 place-items-center border-y border-line transition hover:bg-surface-2"
        >
          <Minus size={17} />
        </button>
        <button
          type="button"
          onClick={() => onJumpToArea(NIGERIA_CENTER)}
          aria-label="View all of Nigeria"
          title="View all of Nigeria (36 states)"
          className="grid h-10 w-10 place-items-center text-brand transition hover:bg-surface-2"
        >
          <Compass size={17} />
        </button>
      </div>
    </div>
  )
}
