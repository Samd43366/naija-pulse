import { useState } from 'react'
import { Home, Map, MessageSquare, MoreHorizontal, Plus, Sparkles, X } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'

// Phone bottom navigation (< lg): Home · Map · [Report] · Pulse AI · More
export default function BottomNav({
  activeId,
  onNavigate,
  onReport,
  moreItems,
  theme,
  onToggleTheme,
  onToggleSms,
  unreadAlerts,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreItems.some((m) => m.id === activeId)

  const tab = (id, label, Icon) => {
    const active = activeId === id
    return (
      <button
        type="button"
        onClick={() => onNavigate(id)}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] font-semibold transition ${
          active ? 'text-brand' : 'text-ink-3'
        }`}
      >
        <span
          className={`grid h-7 w-12 place-items-center rounded-full transition ${
            active ? 'bg-brand-soft' : ''
          }`}
        >
          <Icon size={19} strokeWidth={active ? 2.5 : 2} />
        </span>
        {label}
      </button>
    )
  }

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[2500] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="anim-fade absolute inset-0 bg-black/40"
          />
          <div className="anim-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border border-b-0 border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">More</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-ink-2"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              {moreItems.map(({ id, label, hint, Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => {
                    setMoreOpen(false)
                    onNavigate(id)
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-3 text-left active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{label}</span>
                    <span className="block truncate text-xs text-ink-3">{hint}</span>
                  </span>
                  {id === 'alerts' && unreadAlerts > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn px-1.5 text-[10px] font-bold text-white">
                      {unreadAlerts}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="flex-1 justify-center" />
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  onToggleSms()
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-2 text-xs font-semibold text-ink-2"
              >
                <MessageSquare size={14} />
                SMS reporting
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="relative z-[2000] flex shrink-0 items-stretch border-t border-line bg-surface pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {tab('home', 'Home', Home)}
        {tab('map', 'Map', Map)}

        <div className="relative flex w-16 shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onReport}
            aria-label="Report an incident"
            className={`grid place-items-center rounded-full bg-brand text-brand-ink shadow-[0_6px_20px_color-mix(in_srgb,var(--brand)_40%,transparent)] transition active:scale-95 ${
              activeId === 'chat'
                ? 'h-10 w-10 ring-2 ring-surface'
                : 'absolute -top-4 h-13 w-13 ring-4 ring-surface'
            }`}
          >
            <Plus size={activeId === 'chat' ? 22 : 26} strokeWidth={2.8} />
          </button>
          <span
            className={`text-[11px] font-semibold text-ink-3 ${
              activeId === 'chat' ? 'hidden' : 'mt-auto pb-1'
            }`}
          >
            Report
          </span>
        </div>

        {tab('chat', 'Pulse AI', Sparkles)}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] font-semibold transition ${
            moreActive ? 'text-brand' : 'text-ink-3'
          }`}
        >
          <span
            className={`grid h-7 w-12 place-items-center rounded-full ${moreActive ? 'bg-brand-soft' : ''}`}
          >
            <MoreHorizontal size={20} strokeWidth={moreActive ? 2.5 : 2} />
          </span>
          More
          {unreadAlerts > 0 && (
            <span className="absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full bg-warn ring-2 ring-surface" />
          )}
        </button>
      </nav>
    </>
  )
}
