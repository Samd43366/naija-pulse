import { useEffect, useMemo, useState } from 'react'
import { Compass, MapPin, Search, Sparkles } from 'lucide-react'

const KIND_LABELS = { beach: 'Beach', park: 'Park', museum: 'Museum', waterfall: 'Waterfall', mountain: 'Mountain', university: 'Campus', stadium: 'Stadium', civic: 'Civic landmark', airport: 'Transport hub', market: 'Market' }

export default function PlacesPanel({ onFlyToPlace }) {
  const [places, setPlaces] = useState([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')

  useEffect(() => {
    fetch('/geo/nigeria_cities_detail.json').then((response) => response.json()).then((data) => setPlaces(data.places || [])).catch(() => {})
  }, [])

  const kinds = useMemo(() => Array.from(new Set(places.map((place) => place.kind))).sort(), [places])
  const visible = useMemo(() => places.filter((place) => {
    if (kind !== 'all' && place.kind !== kind) return false
    if (!query) return true
    return `${place.name} ${place.sub} ${place.kind}`.toLowerCase().includes(query.toLowerCase())
  }).slice(0, 48), [places, kind, query])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <header>
          <div className="flex items-center gap-2 text-brand"><Sparkles size={19} /><span className="text-xs font-bold uppercase tracking-wider">Explore Nigeria</span></div>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">Interesting places to visit</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">Discover beaches, parks, museums, markets, campuses, stadiums, airports, and major landmarks on the map.</p>
        </header>
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><input className="field pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places, cities or landmarks…" aria-label="Search interesting places" /></div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"><button type="button" className="chip" data-active={kind === 'all'} onClick={() => setKind('all')}>All</button>{kinds.map((item) => <button type="button" className="chip" data-active={kind === item} onClick={() => setKind(item)} key={item}>{KIND_LABELS[item] || item}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((place) => <button type="button" key={`${place.name}-${place.lat}`} onClick={() => onFlyToPlace?.({ lat: place.lat, lng: place.lng, label: place.name, zoom: 14 })} className="card group p-4 text-left transition hover:-translate-y-0.5 hover:border-brand"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-lg">{place.kind === 'beach' ? '🏖️' : place.kind === 'park' ? '🌳' : place.kind === 'museum' ? '🏛️' : place.kind === 'waterfall' ? '💧' : '📍'}</span><Compass size={16} className="text-ink-3 group-hover:text-brand" /></div><h2 className="mt-3 text-sm font-bold text-ink">{place.name}</h2><p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3"><MapPin size={11} /> {place.sub || KIND_LABELS[place.kind] || place.kind}</p></button>)}</div>
      </div>
    </div>
  )
}

