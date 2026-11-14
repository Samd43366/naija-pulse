import { Plus, RefreshCw, MessageSquare } from 'lucide-react'
import BrandMark from '../ui/BrandMark'
import ThemeToggle from '../ui/ThemeToggle'

export function backendLabel(backend) {
  switch (backend) {
    case 'online':
      return { text: 'Live database', tone: 'ok' }
    case 'api_ready':
      return { text: 'AI online', tone: 'info' }
    case 'offline':
      return { text: 'Offline mode', tone: 'warn' }
    case 'unavailable':
      return { text: 'Live data unavailable', tone: 'warn' }
    default:
      return { text: 'Connecting…', tone: 'muted' }
  }
}

const TONE = {
  ok: 'bg-ok/12 text-ok',
  info: 'bg-info/12 text-info',
  warn: 'bg-warn/14 text-warn',
  muted: 'bg-surface-2 text-ink-3',
}

export function StatusPill({ backend, onClick, className = '' }) {
  const { text, tone } = backendLabel(backend)
  return (
    <button
      type="button"
      onClick={onClick}
      title="Re-check backend connection"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-95 ${TONE[tone]} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {text}
      <RefreshCw size={10} className="opacity-70" />
    </button>
  )
}

// Desktop left sidebar (>= lg)
export function Sidebar({
  items,
  activeId,
  onNavigate,
  onReport,
  backend,
  onRecheck,
  theme,
  onToggleTheme,
  onToggleSms,
  incidentCount,
  unreadAlerts,
}) {
  return (
    <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="px-5 pb-4 pt-5">
        <BrandMark size={40} />
      </div>

      <div className="px-4">
        <button type="button" onClick={onReport} className="btn btn-primary w-full py-3 text-[15px]">
          <Plus size={18} strokeWidth={2.6} />
          Report an incident
        </button>
      </div>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
        {items.map(({ id, label, hint, Icon }) => {
          const active = activeId === id
          return (
            <button
              type="button"
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                active
                  ? 'bg-brand-soft text-brand'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />
              )}
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{label}</span>
                <span className="block truncate text-[11px] font-normal text-ink-3">{hint}</span>
              </span>
              {id === 'alerts' && unreadAlerts > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn px-1.5 text-[10px] font-bold text-white">
                  {unreadAlerts}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-line p-4">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              System
            </span>
            <StatusPill backend={backend} onClick={onRecheck} />
          </div>
          <p className="mt-2 text-xs text-ink-2">
            <strong className="text-ink">{incidentCount.toLocaleString()}</strong> incidents tracked
            across 36 states + FCT
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="flex-1 justify-center" />
          <button
            type="button"
            onClick={onToggleSms}
            title="Low-data SMS reporting"
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-2 text-xs font-semibold text-ink-2 hover:border-warn hover:text-ink"
          >
            <MessageSquare size={14} />
            SMS
          </button>
        </div>
      </div>
    </aside>
  )
}

// Phone top bar (< lg)
export function MobileHeader({ backend, onRecheck, theme, onToggleTheme }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-4 pb-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] lg:hidden">
      <BrandMark size={32} subtitle={false} />
      <div className="flex items-center gap-2">
        <StatusPill backend={backend} onClick={onRecheck} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
      </div>
    </header>
  )
}
