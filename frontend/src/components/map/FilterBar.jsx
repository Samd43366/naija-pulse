import { CATEGORIES } from '../../lib/categories'

const RECENCY_OPTIONS = [
  { label: 'Any time', hours: null },
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
]

// Horizontally scrollable category pills + recency segmented control, floating over the map.
export default function FilterBar({
  selectedCategory,
  onCategoryChange,
  withinHours,
  onRecencyChange,
  totalShown,
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        <button
          type="button"
          data-active={selectedCategory === null}
          onClick={() => onCategoryChange(null)}
          className="chip glass !border-line shadow-sm data-[active=true]:!bg-ink data-[active=true]:!text-surface"
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const active = selectedCategory === c.code
          return (
            <button
              type="button"
              key={c.code}
              onClick={() => onCategoryChange(active ? null : c.code)}
              className="chip glass shadow-sm"
              style={
                active
                  ? { background: c.color, borderColor: c.color, color: '#fff', backdropFilter: 'none' }
                  : undefined
              }
            >
              <span>{c.emoji}</span>
              {c.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="glass inline-flex rounded-full p-0.5 text-[11px] font-semibold">
          {RECENCY_OPTIONS.map((opt) => {
            const active = withinHours === opt.hours
            return (
              <button
                type="button"
                key={opt.label}
                onClick={() => onRecencyChange(opt.hours)}
                className={`rounded-full px-2.5 py-1 transition ${
                  active ? 'bg-brand text-brand-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {typeof totalShown === 'number' && (
          <span className="glass rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-2">
            {totalShown.toLocaleString()} shown
          </span>
        )}
      </div>
    </div>
  )
}
