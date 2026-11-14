import { useEffect, useMemo, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'

const TYPE_BADGE = {
  State: 'bg-brand-soft text-brand',
  LGA: 'bg-info/12 text-info',
  District: 'bg-violet/12 text-violet',
  Area: 'bg-violet/12 text-violet',
  Estate: 'bg-ok/12 text-ok',
  'Street / Hwy': 'bg-warn/14 text-warn',
  Bridge: 'bg-warn/14 text-warn',
}

// Instant offline-capable search across 1,000+ Nigerian States, 774 LGAs,
// Neighborhoods/Areas, Named Streets/Bridges, Universities, Markets & Airports.
export default function MapSearchBox({ onSelectPlace }) {
  const [index, setIndex] = useState([])
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    fetch('/geo/nigeria_cities_detail.json')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.search_index)) setIndex(data.search_index)
      })
      .catch(() => {})
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const starts = []
    const contains = []
    for (const item of index) {
      const nameL = item.name.toLowerCase()
      const subL = (item.sub || '').toLowerCase()
      if (nameL.startsWith(q)) {
        starts.push(item)
      } else if (nameL.includes(q) || subL.includes(q)) {
        contains.push(item)
      }
      if (starts.length >= 10) break
    }
    return [...starts, ...contains].slice(0, 8)
  }, [index, query])

  return (
    <div className="relative">
      <div className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
        <Search size={17} className="shrink-0 text-brand" />
        <input
          type="text"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a street, area, LGA, landmark or state…"
          aria-label="Search places in Nigeria"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {focused && matches.length > 0 && (
        <div className="anim-fade glass absolute inset-x-0 top-full z-10 mt-2 max-h-72 overflow-y-auto rounded-2xl p-1.5">
          {matches.map((item, idx) => (
            <button
              key={`${item.name}-${item.type}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectPlace({
                  lat: item.lat,
                  lng: item.lng,
                  zoom: item.zoom || 13,
                  label: item.name,
                })
                setQuery(item.name)
                setFocused(false)
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
                  <MapPin size={15} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                  <div className="truncate text-[11px] text-ink-3">{item.sub}</div>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  TYPE_BADGE[item.type] || 'bg-surface-2 text-ink-2'
                }`}
              >
                {item.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
