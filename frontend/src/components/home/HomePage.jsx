import { useMemo } from 'react'
import {
  ArrowRight,
  Bell,
  Bot,
  Map as MapIcon,
  Phone,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import { CATEGORIES, getCategory } from '../../lib/categories'
import { EvidenceSummary, FreshnessLabel, LocationLabel, SourceBadge } from '../incidents/IncidentMeta'

const EMERGENCY = [
  { label: 'National emergency', number: '112', tel: '112' },
  { label: 'Lagos LASEMA', number: '767', tel: '767' },
  { label: 'FRSC highway', number: '122', tel: '122' },
  { label: 'NCDC health', number: '6232', tel: '6232' },
]

function StatCard({ label, value, hint, Icon, tone = 'brand' }) {
  const toneClass = {
    brand: 'bg-brand-soft text-brand',
    warn: 'bg-warn/14 text-warn',
    info: 'bg-info/12 text-info',
    danger: 'bg-danger/12 text-danger',
  }[tone]
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-3">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div>}
    </div>
  )
}

export default function HomePage({
  incidents,
  onReport,
  onOpenMap,
  onNavigate,
  onFocusIncident,
  onFlyToState,
  stateCentroids,
}) {
  const stats = useMemo(() => {
    const byState = new Map()
    const byCat = {}
    let verified = 0
    let dispatched = 0
    let critical = 0
    for (const inc of incidents) {
      byCat[inc.category_code] = (byCat[inc.category_code] || 0) + 1
      const st = inc.state_name || 'Nigeria'
      byState.set(st, (byState.get(st) || 0) + 1)
      if ((inc.trust_score || 0) >= 0.65) verified += 1
      if (inc.agency_status === 'dispatched') dispatched += 1
      if ((inc.trust_score || 0) >= 0.88 && inc.agency_status !== 'resolved') critical += 1
    }
    const topStates = [...byState.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
    const latest = [...incidents]
      .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
      .slice(0, 6)
    return { byCat, topStates, latest, verified, dispatched, critical, stateCount: byState.size }
  }, [incidents])

  const maxStateCount = stats.topStates[0]?.[1] || 1
  const maxCat = Math.max(1, ...Object.values(stats.byCat))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-8">
        {/* HERO */}
        <section className="hero-pattern relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-float)] sm:p-8 lg:p-10">
          {/* decorative hex grid */}
          <svg
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 text-white/10 sm:h-96 sm:w-96"
            viewBox="0 0 200 200"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            {[0, 1, 2, 3].flatMap((r) =>
              [0, 1, 2, 3].map((c) => {
                const x = 30 + c * 44 + (r % 2) * 22
                const y = 30 + r * 38
                return (
                  <polygon
                    key={`${r}-${c}`}
                    points={`${x},${y - 22} ${x + 19},${y - 11} ${x + 19},${y + 11} ${x},${y + 22} ${x - 19},${y + 11} ${x - 19},${y - 11}`}
                  />
                )
              }),
            )}
          </svg>

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className="live-dot !bg-white" />
              Live · {incidents.length.toLocaleString()} incidents across {stats.stateCount} states
            </span>
            <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              Know what’s happening on your street, before you step out.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">
              Community-verified reports on power, floods, security, roads and fires across all 36
              states and the FCT, with a safety assistant and an agency command desk behind them.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onReport}
                className="btn bg-white !text-[#006c41] shadow-lg hover:bg-white/90"
              >
                <Plus size={17} strokeWidth={2.8} />
                Report an incident
              </button>
              <button
                type="button"
                onClick={() => onOpenMap()}
                className="btn border-white/30 bg-white/12 text-white backdrop-blur hover:bg-white/20"
              >
                <MapIcon size={17} />
                Open live map
              </button>
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="btn border-white/30 bg-white/12 text-white backdrop-blur hover:bg-white/20"
              >
                <Sparkles size={17} />
                Ask Pulse AI
              </button>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Active incidents"
            value={incidents.length.toLocaleString()}
            hint="Updated live"
            Icon={Bell}
            tone="brand"
          />
          <StatCard
            label="Community verified"
            value={stats.verified.toLocaleString()}
            hint="Trust score 65% or higher"
            Icon={ShieldCheck}
            tone="info"
          />
          <StatCard
            label="High priority"
            value={stats.critical.toLocaleString()}
            hint="Trust 88%+ and unresolved"
            Icon={Bell}
            tone="danger"
          />
          <StatCard
            label="Units dispatched"
            value={stats.dispatched.toLocaleString()}
            hint="Agency teams en route"
            Icon={Truck}
            tone="warn"
          />
        </section>

        {/* Category breakdown */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">What’s happening</h2>
              <p className="text-xs text-ink-3">Tap a category to see it on the map.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.map((c) => {
              const n = stats.byCat[c.code] || 0
              return (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => onOpenMap({ category: c.code })}
                  className="card group p-3.5 text-left transition hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-xl text-lg"
                      style={{ background: `${c.color}22` }}
                    >
                      {c.emoji}
                    </span>
                    <ArrowRight
                      size={15}
                      className="text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </div>
                  <div className="mt-2.5 font-display text-2xl font-extrabold text-ink">{n}</div>
                  <div className="text-xs font-semibold text-ink-2">{c.label}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(n / maxCat) * 100}%`, background: c.color }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Latest + Hotspots */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="card p-4 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Latest reports</h2>
              <button
                type="button"
                onClick={() => onOpenMap()}
                className="text-xs font-semibold text-brand hover:underline"
              >
                View on map
              </button>
            </div>
            <ul className="divide-y divide-line">
              {stats.latest.map((inc) => {
                const cat = getCategory(inc.category_code)
                return (
                  <li key={inc.id}>
                    <button
                      type="button"
                      onClick={() => onFocusIncident(inc)}
                      className="flex w-full items-start gap-3 py-3 text-left transition hover:bg-surface-2/60 sm:px-1"
                    >
                      <span
                        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
                        style={{ background: `${cat.color}22` }}
                      >
                        {cat.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                          {inc.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                          <LocationLabel incident={inc} />
                          <FreshnessLabel value={inc.last_activity_at} />
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <SourceBadge source={inc.source} sourceType={inc.source_type} />
                          <EvidenceSummary incident={inc} compact />
                        </div>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="card p-4 lg:col-span-2">
            <h2 className="text-base font-bold text-ink">Busiest states</h2>
            <p className="mb-3 text-xs text-ink-3">By number of active reports</p>
            <ul className="space-y-2.5">
              {stats.topStates.map(([name, count]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => {
                      const c = stateCentroids?.[name]
                      if (c) onFlyToState({ ...c, label: name })
                      else onOpenMap()
                    }}
                    className="block w-full text-left"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{name}</span>
                      <span className="font-bold text-ink-2">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-strong"
                        style={{ width: `${(count / maxStateCount) * 100}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tools */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                id: 'route',
                Icon: RouteIcon,
                title: 'Route Escort',
                body: 'Scan your commute for floods, hold-ups and security alerts before you drive.',
              },
              {
                id: 'chat',
                Icon: Bot,
                title: 'Pulse AI',
                body: 'Ask about any state, road or emergency and get an answer from live data.',
              },
              {
                id: 'agency',
                Icon: ShieldCheck,
                title: 'Agency HQ',
                body: 'Triage, dispatch and resolve incidents for NEMA, TCN, FRSC, Police and more.',
              },
              {
                id: 'alerts',
                Icon: Bell,
                title: 'Alerts & Places',
                body: 'Watch Home, Office or School and get pinged when something happens nearby.',
              },
            ].map(({ id, Icon, title, body }) => (
              <button
                type="button"
                key={id}
                onClick={() => onNavigate(id)}
                className="card group p-4 text-left transition hover:-translate-y-0.5 hover:border-brand"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon size={20} />
                </span>
                <h3 className="mt-3 text-sm font-bold text-ink">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">{body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  Open <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Emergency strip */}
        <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger">
              <Phone size={19} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">In an emergency, call first</h2>
              <p className="text-xs text-ink-3">Tap a number to dial from your phone.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {EMERGENCY.map((e) => (
              <a
                key={e.number}
                href={`tel:${e.tel}`}
                className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-center transition hover:border-danger"
              >
                <span className="block font-display text-lg font-extrabold leading-tight text-ink">
                  {e.number}
                </span>
                <span className="block text-[10.5px] text-ink-3">{e.label}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
