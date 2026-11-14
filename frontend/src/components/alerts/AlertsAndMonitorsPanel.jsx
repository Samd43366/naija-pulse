import { useState } from 'react'
import { Bell, BellRing, Briefcase, Check, GraduationCap, Home, Plus, Route } from 'lucide-react'
import { NIGERIA_AREAS } from '../../lib/geo'

const PLACE_PRESETS = [
  { label: 'Home', Icon: Home },
  { label: 'Office', Icon: Briefcase },
  { label: "Child's School", Icon: GraduationCap },
]

// Core Feature #5: Saved Personal Locations (Home, Office, School, Routes) & Alerts.
// Each saved monitor stores an array of H3 hexagon IDs (`monitored_hexes`) indexed
// by a PostgreSQL GIN index so alert matching runs in <2ms on every new report.
export default function AlertsAndMonitorsPanel({
  monitors,
  alerts,
  defaultCoords,
  onCreatePointMonitor,
  onMarkAlertRead,
}) {
  const [selectedPreset, setSelectedPreset] = useState('Home')
  const [selectedAreaId, setSelectedAreaId] = useState('lagos_mainland')
  const [useGps, setUseGps] = useState(Boolean(defaultCoords))
  const [radiusM, setRadiusM] = useState(1500)
  const [saving, setSaving] = useState(false)

  const chosenArea =
    NIGERIA_AREAS.find((a) => a.id === selectedAreaId) || NIGERIA_AREAS[0]

  async function handleAddMonitor(e) {
    e.preventDefault()
    setSaving(true)
    const coords = useGps && defaultCoords ? defaultCoords : chosenArea
    try {
      await onCreatePointMonitor({
        label: `${selectedPreset} (${useGps && defaultCoords ? 'My GPS' : chosenArea.label})`,
        monitor_type: 'point',
        latitude: coords.lat,
        longitude: coords.lng,
        radius_m: radiusM,
      })
    } finally {
      setSaving(false)
    }
  }

  const unread = alerts.filter((a) => !a.read_at).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-8">
        <header>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
            Alerts & places
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Save the places you care about and get alerted when verified incidents land nearby.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Add Personal Place Watch */}
          <section className="card p-5">
            <h2 className="text-base font-bold text-ink">Add a watch zone</h2>
            <p className="mt-0.5 text-xs text-ink-3">Home, office or your child’s school.</p>

            <form onSubmit={handleAddMonitor} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {PLACE_PRESETS.map(({ label, Icon }) => {
                  const active = selectedPreset === label
                  return (
                    <button
                      type="button"
                      key={label}
                      onClick={() => setSelectedPreset(label)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-xs font-semibold transition ${
                        active
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                      }`}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={useGps ? '__gps__' : selectedAreaId}
                  onChange={(e) => {
                    if (e.target.value === '__gps__') {
                      setUseGps(true)
                    } else {
                      setUseGps(false)
                      setSelectedAreaId(e.target.value)
                    }
                  }}
                  aria-label="Location"
                  className="field"
                >
                  {defaultCoords && <option value="__gps__">📍 Current map / GPS position</option>}
                  {NIGERIA_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>

                <select
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                  aria-label="Watch radius"
                  className="field"
                >
                  <option value={800}>~500 m (7 hexes)</option>
                  <option value={1500}>~1.5 km (19 hexes)</option>
                </select>
              </div>

              <button type="submit" disabled={saving} className="btn btn-primary w-full">
                <Plus size={16} />
                {saving ? 'Saving…' : `Save ${selectedPreset} watch`}
              </button>
            </form>
          </section>

          {/* Active Monitors */}
          <section className="card p-5">
            <h2 className="text-base font-bold text-ink">
              Your places & routes{' '}
              <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">
                {monitors.length}
              </span>
            </h2>
            {monitors.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-line-strong p-5 text-center">
                <Home size={22} className="mx-auto text-ink-3" />
                <p className="mt-2 text-sm text-ink-2">No saved places yet.</p>
                <p className="text-xs text-ink-3">
                  Add Home or Office, or save a commute from Route Escort.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {monitors.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 font-medium text-ink">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        {m.monitor_type === 'corridor' ? <Route size={15} /> : <Home size={15} />}
                      </span>
                      <span className="truncate">{m.label}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                      {m.monitored_hex_count} monitored zones
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Triggered Alerts Inbox */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <BellRing size={18} className="text-warn" />
            Alert inbox
            {unread > 0 && (
              <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-bold text-white">
                {unread} new
              </span>
            )}
          </h2>
          {alerts.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line-strong p-6 text-center">
              <Bell size={22} className="mx-auto text-ink-3" />
              <p className="mt-2 text-sm font-semibold text-ink-2">All quiet</p>
              <p className="text-xs text-ink-3">
                When an incident lands inside one of your watched zones it will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => {
                const isUnread = !a.read_at
                return (
                  <li
                    key={a.id}
                    className={`rounded-2xl border p-3.5 text-sm ${
                      isUnread ? 'border-warn/40 bg-warn/10' : 'border-line bg-surface-2/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{a.title}</p>
                        <p className="mt-0.5 text-xs text-ink-2">{a.message}</p>
                      </div>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => onMarkAlertRead(a.id)}
                          className="btn btn-ghost shrink-0 !px-2.5 !py-1.5 text-xs"
                        >
                          <Check size={13} /> Read
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
