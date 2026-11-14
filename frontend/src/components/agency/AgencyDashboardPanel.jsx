import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Compass,
  Download,
  Filter,
  LayoutGrid,
  ListChecks,
  Radio,
  Search,
  ShieldAlert,
  Truck,
} from 'lucide-react'
import { getCategory } from '../../lib/categories'
import { NIGERIA_STATES_META } from '../../lib/localPulseBrain'

const AGENCY_DESKS = [
  {
    id: 'all',
    label: '🇳🇬 Joint Command (All)',
    unitName: 'Joint Task Response',
    categories: null,
  },
  {
    id: 'nema',
    label: '🌊 NEMA / SEMA',
    unitName: 'NEMA / SEMA Search & Flood Team',
    categories: ['flood', 'disaster_fire', 'other'],
  },
  {
    id: 'tcn',
    label: '⚡ TCN & DisCos',
    unitName: 'TCN / DisCo 33kV Line Crew',
    categories: ['power_outage'],
  },
  {
    id: 'security',
    label: '🛡️ Police / JTF',
    unitName: 'Police & JTF Tactical Escort',
    categories: ['kidnapping_security'],
  },
  {
    id: 'frsc',
    label: '🛣️ FRSC & Works',
    unitName: 'FRSC Patrol & Heavy Tow Unit',
    categories: ['road_condition'],
  },
  {
    id: 'fire',
    label: '🚒 Fire & LASEMA',
    unitName: 'State Fire & LASEMA Strike Unit',
    categories: ['disaster_fire'],
  },
  {
    id: 'ncdc',
    label: '🏥 NCDC & Water',
    unitName: 'NCDC / Municipal Sanitation Team',
    categories: ['other'],
  },
]

const ZONES = [
  'All Zones',
  'North-Central',
  'North-East',
  'North-West',
  'South-East',
  'South-South',
  'South-West',
]

function defaultUnitForCategory(categoryCode, stateName) {
  const prefix = stateName || 'National'
  switch (categoryCode) {
    case 'power_outage':
      return `${prefix} · DisCo / TCN Fault Crew`
    case 'flood':
      return `${prefix} · NEMA / SEMA Flood Unit`
    case 'kidnapping_security':
      return `${prefix} · Police / JTF Tactical Squad`
    case 'road_condition':
      return `${prefix} · FRSC Recovery & Works`
    case 'disaster_fire':
      return `${prefix} · Fire Service & LASEMA`
    default:
      return `${prefix} · NCDC / Civic Field Team`
  }
}

export default function AgencyDashboardPanel({
  incidents,
  onDispatchIncident,
  onResolveIncident,
  onInspectOnMap,
  onFlyToState,
}) {
  const [deskId, setDeskId] = useState('all')
  const [subView, setSubView] = useState('queue') // 'queue' | 'states'
  const [selectedState, setSelectedState] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'pending' | 'dispatched' | 'resolved'
  const [zoneFilter, setZoneFilter] = useState('All Zones')
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(30)

  const activeDesk = AGENCY_DESKS.find((d) => d.id === deskId) || AGENCY_DESKS[0]

  // Filter incidents by selected Agency Desk
  const deskIncidents = useMemo(() => {
    if (!activeDesk.categories) return incidents
    return incidents.filter((inc) => activeDesk.categories.includes(inc.category_code))
  }, [incidents, activeDesk])

  // Compute nationwide per-state matrix across ALL 36 States + FCT
  const stateMatrix = useMemo(() => {
    const map = {}
    for (const [stName, meta] of Object.entries(NIGERIA_STATES_META)) {
      map[stName] = {
        stateName: stName,
        capital: meta.capital,
        zone: meta.zone,
        lat: meta.lat,
        lng: meta.lng,
        totalAll: 0,
        deskCount: 0,
        dispatched: 0,
        resolved: 0,
        byCat: {},
      }
    }

    for (const inc of incidents) {
      const st = inc.state_name
      if (!map[st]) continue
      map[st].totalAll += 1
      map[st].byCat[inc.category_code] = (map[st].byCat[inc.category_code] || 0) + 1
      const aStatus = inc.status === 'resolved' ? 'resolved' : inc.agency_status || 'pending'
      if (aStatus === 'dispatched') map[st].dispatched += 1
      if (aStatus === 'resolved') map[st].resolved += 1
    }

    for (const inc of deskIncidents) {
      const st = inc.state_name
      if (map[st]) map[st].deskCount += 1
    }

    return Object.values(map).sort((a, b) => a.stateName.localeCompare(b.stateName))
  }, [incidents, deskIncidents])

  const kpis = useMemo(() => {
    let critical = 0
    let pending = 0
    let dispatched = 0
    let resolved = 0
    for (const inc of deskIncidents) {
      const aStatus = inc.status === 'resolved' ? 'resolved' : inc.agency_status || 'pending'
      if (aStatus === 'resolved') resolved += 1
      else if (aStatus === 'dispatched') dispatched += 1
      else pending += 1

      if ((inc.trust_score || 0) >= 0.85 && aStatus !== 'resolved') critical += 1
    }
    const statesWithCases = stateMatrix.filter((s) => s.totalAll > 0).length
    const minCasesPerState = stateMatrix.length
      ? Math.min(...stateMatrix.map((s) => s.totalAll))
      : 0

    return {
      total: deskIncidents.length,
      statesWithCases,
      minCasesPerState,
      critical,
      pending,
      dispatched,
      resolved,
    }
  }, [deskIncidents, stateMatrix])

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return deskIncidents
      .filter((inc) => {
        if (selectedState !== 'ALL' && inc.state_name !== selectedState) return false
        const aStatus = inc.status === 'resolved' ? 'resolved' : inc.agency_status || 'pending'
        if (statusFilter !== 'ALL' && aStatus !== statusFilter) return false
        if (q) {
          const hay = `${inc.title} ${inc.lga_name} ${inc.state_name} ${inc.news_outlet || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        // Pending critical items first, then dispatched, then resolved
        const rank = (x) =>
          x.status === 'resolved' || x.agency_status === 'resolved'
            ? 2
            : x.agency_status === 'dispatched'
              ? 1
              : 0
        const diff = rank(a) - rank(b)
        if (diff !== 0) return diff
        return (b.trust_score || 0) - (a.trust_score || 0)
      })
  }, [deskIncidents, selectedState, statusFilter, searchQuery])

  const visibleMatrix = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return stateMatrix.filter((s) => {
      if (zoneFilter !== 'All Zones' && s.zone !== zoneFilter) return false
      if (q && !`${s.stateName} ${s.capital} ${s.zone}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [stateMatrix, zoneFilter, searchQuery])

  function handleExportCsv() {
    const headers = [
      'Incident_ID',
      'State',
      'LGA',
      'Category',
      'Agency_Status',
      'Assigned_Unit',
      'Trust_Score',
      'Title',
      'Source_Outlet',
      'Latitude',
      'Longitude',
    ]
    const rows = filteredQueue.map((inc) => {
      const aStatus = inc.status === 'resolved' ? 'resolved' : inc.agency_status || 'pending'
      const cols = [
        inc.id,
        inc.state_name || '',
        inc.lga_name || '',
        inc.category_code,
        aStatus,
        inc.assigned_unit || '',
        inc.trust_score,
        (inc.title || '').replace(/"/g, '""'),
        (inc.news_outlet || '').replace(/"/g, '""'),
        inc.latitude,
        inc.longitude,
      ]
      return cols.map((c) => `"${c}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `naija_pulse_sitrep_${deskId}_${selectedState.toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-ink">
      {/* Command Header & Agency Desk Switcher */}
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn/15 text-warn ring-1 ring-warn/35">
              <Radio size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink sm:text-base">
                Multi-Agency Emergency Command HQ
              </h2>
              <p className="text-[11px] text-ink-3">
                National Situational Room · 36 States + FCT ({kpis.minCasesPerState}+ cases/state) · Real-Time Triage & Dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-bg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSubView('queue')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
                  subView === 'queue'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                <ListChecks size={13} />
                Triage Queue
              </button>
              <button
                type="button"
                onClick={() => setSubView('states')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
                  subView === 'states'
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                <LayoutGrid size={13} />
                36 States + FCT
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-brand hover:text-brand"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export SitRep CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>

        {/* Agency Role Pills */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {AGENCY_DESKS.map((desk) => (
            <button
              key={desk.id}
              type="button"
              onClick={() => {
                setDeskId(desk.id)
                setPageSize(30)
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                deskId === desk.id
                  ? 'bg-warn text-ink shadow'
                  : 'border border-line bg-bg text-ink-2 hover:border-line-strong'
              }`}
            >
              {desk.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Workspace */}
      <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-7xl px-3.5 py-4 sm:px-6 lg:px-8">
        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Desk Incidents
            </div>
            <div className="mt-1 text-xl font-extrabold text-ink">
              {kpis.total.toLocaleString()}
            </div>
            <div className="text-[10px] text-ink-3">{activeDesk.label}</div>
          </div>

          <div className="rounded-xl border border-brand/35 bg-brand-soft p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
              State Coverage
            </div>
            <div className="mt-1 text-xl font-extrabold text-brand">
              {kpis.statesWithCases} / 37
            </div>
            <div className="text-[10px] text-brand/80">
              Min {kpis.minCasesPerState} cases / state
            </div>
          </div>

          <div className="rounded-xl border border-danger/35 bg-danger/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-danger">
              High Priority
            </div>
            <div className="mt-1 text-xl font-extrabold text-danger">{kpis.critical}</div>
            <div className="text-[10px] text-danger/80">Trust ≥ 85% active</div>
          </div>

          <div className="rounded-xl border border-warn/35 bg-warn/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-warn">
              Awaiting Triage
            </div>
            <div className="mt-1 text-xl font-extrabold text-warn">{kpis.pending}</div>
            <div className="text-[10px] text-warn/80">Ready for dispatch</div>
          </div>

          <div className="rounded-xl border border-info/35 bg-info/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-info">
              Units Dispatched
            </div>
            <div className="mt-1 text-xl font-extrabold text-info">{kpis.dispatched}</div>
            <div className="text-[10px] text-info/80">Field teams en route</div>
          </div>

          <div className="rounded-xl border border-ok/35 bg-ok/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ok">
              Resolved
            </div>
            <div className="mt-1 text-xl font-extrabold text-ok">{kpis.resolved}</div>
            <div className="text-[10px] text-ok/80">Cleared & verified</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPageSize(30)
              }}
              placeholder={
                subView === 'queue'
                  ? 'Search incident, LGA, state, highway, or agency…'
                  : 'Search state, capital, or geopolitical zone…'
              }
              className="w-full rounded-lg border border-line bg-bg py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </div>

          {subView === 'queue' ? (
            <>
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-ink-3" />
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value)
                    setPageSize(30)
                  }}
                  className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                >
                  <option value="ALL">All 36 States + FCT ({deskIncidents.length})</option>
                  {stateMatrix.map((s) => (
                    <option key={s.stateName} value={s.stateName}>
                      {s.stateName} ({s.deskCount})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'dispatched', label: 'Dispatched' },
                  { id: 'resolved', label: 'Resolved' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id)
                      setPageSize(30)
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      statusFilter === st.id
                        ? 'bg-ink text-surface'
                        : 'border border-line bg-bg text-ink-3 hover:text-ink'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-1">
              {ZONES.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoneFilter(z)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    zoneFilter === z
                      ? 'bg-brand text-brand-ink'
                      : 'border border-line bg-bg text-ink-3 hover:text-ink'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SUB-VIEW A: ALL 36 STATES + FCT MATRIX */}
        {subView === 'states' ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMatrix.map((st) => {
              const catOrder = [
                'power_outage',
                'flood',
                'kidnapping_security',
                'road_condition',
                'disaster_fire',
                'other',
              ]
              return (
                <div
                  key={st.stateName}
                  className="flex flex-col justify-between rounded-xl border border-line bg-surface p-3.5 transition hover:border-line-strong"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-ink">{st.stateName}</h3>
                        <p className="text-[11px] text-ink-3">
                          Capital: {st.capital} · {st.zone}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-extrabold text-brand ring-1 ring-brand/35">
                        {st.totalAll} cases
                      </span>
                    </div>

                    {/* Stacked Category Distribution Bar */}
                    <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
                      {catOrder.map((code) => {
                        const cCount = st.byCat[code] || 0
                        if (!cCount || !st.totalAll) return null
                        const { color } = getCategory(code)
                        const pct = (cCount / st.totalAll) * 100
                        return (
                          <div
                            key={code}
                            style={{ width: `${pct}%`, backgroundColor: color }}
                            title={`${code}: ${cCount}`}
                          />
                        )
                      })}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-2">
                      {catOrder.map((code) => {
                        const cCount = st.byCat[code] || 0
                        if (!cCount) return null
                        const { emoji, label } = getCategory(code)
                        return (
                          <span
                            key={code}
                            className="rounded bg-bg px-1.5 py-0.5 text-ink-2 ring-1 ring-line"
                          >
                            {emoji} {label}: <strong>{cCount}</strong>
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <span className="text-[10px] text-ink-3">
                      ⚡ {st.dispatched} dispatched · ✓ {st.resolved} resolved
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedState(st.stateName)
                          setSubView('queue')
                        }}
                        className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink hover:border-warn hover:text-warn"
                      >
                        Queue ({st.deskCount})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onFlyToState?.({
                            lat: st.lat,
                            lng: st.lng,
                            zoom: 9,
                            label: st.stateName,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-brand/15 px-2 py-1 text-[11px] font-semibold text-brand ring-1 ring-brand/35 hover:bg-brand hover:text-brand-ink"
                      >
                        <Compass size={11} />
                        Map
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* SUB-VIEW B: LIVE TRIAGE & DISPATCH QUEUE */
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span>
                Showing <strong>{Math.min(pageSize, filteredQueue.length)}</strong> of{' '}
                <strong>{filteredQueue.length.toLocaleString()}</strong> matching incidents
                {selectedState !== 'ALL' ? ` in ${selectedState}` : ' nationwide'}
              </span>
              {selectedState !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedState('ALL')}
                  className="text-brand hover:underline"
                >
                  Clear state filter ({selectedState})
                </button>
              )}
            </div>

            {filteredQueue.slice(0, pageSize).map((inc) => {
              const cat = getCategory(inc.category_code)
              const aStatus = inc.status === 'resolved' ? 'resolved' : inc.agency_status || 'pending'
              const trustPct = Math.round((inc.trust_score || 0.5) * 100)

              return (
                <div
                  key={inc.id}
                  className="rounded-xl border border-line bg-surface p-3.5 transition hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                          style={{ backgroundColor: `${cat.color}cc` }}
                        >
                          {cat.emoji} {cat.label}
                        </span>

                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                          📍 {inc.state_name} · {inc.lga_name}
                        </span>

                        <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-ink-2 ring-1 ring-line">
                          Trust {trustPct}%
                        </span>

                        {aStatus === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold text-warn ring-1 ring-warn/35">
                            <ShieldAlert size={10} />
                            Pending Triage
                          </span>
                        )}
                        {aStatus === 'dispatched' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold text-info ring-1 ring-info/35">
                            <Truck size={10} />
                            Dispatched: {inc.assigned_unit || 'Response Team'}
                          </span>
                        )}
                        {aStatus === 'resolved' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand ring-1 ring-brand/35">
                            <CheckCircle2 size={10} />
                            Resolved
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-ink">{inc.title}</h3>
                      <p className="text-xs leading-relaxed text-ink-3">{inc.summary}</p>
                      {inc.news_outlet && (
                        <p className="text-[10px] text-ink-3">
                          Source: {inc.news_outlet} · Area Ref: <code className="font-mono">{inc.h3_res8}</code>
                        </p>
                      )}
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                      {aStatus === 'pending' && (
                        <button
                          type="button"
                          onClick={() =>
                            onDispatchIncident?.(
                              inc.id,
                              activeDesk.id === 'all'
                                ? defaultUnitForCategory(inc.category_code, inc.state_name)
                                : `${inc.state_name || 'National'} · ${activeDesk.unitName}`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-info px-2.5 py-1.5 text-xs font-bold text-brand-ink shadow transition hover:brightness-110"
                        >
                          <Truck size={13} />
                          Dispatch Unit
                        </button>
                      )}

                      {aStatus !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => onResolveIncident?.(inc.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand/35 bg-brand/15 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-brand-ink"
                        >
                          <CheckCircle2 size={13} />
                          Resolve
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onInspectOnMap?.(inc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-line-strong hover:text-ink"
                      >
                        <Compass size={13} />
                        Map
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {pageSize < filteredQueue.length && (
              <div className="py-3 text-center">
                <button
                  type="button"
                  onClick={() => setPageSize((p) => p + 40)}
                  className="rounded-xl border border-line bg-surface px-5 py-2 text-xs font-bold text-brand hover:border-brand"
                >
                  Load More Incidents ({filteredQueue.length - pageSize} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div></div>
    </div>
  )
}
