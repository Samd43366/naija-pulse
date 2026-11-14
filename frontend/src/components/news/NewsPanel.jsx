import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, MapPin, Newspaper, RefreshCw, Search } from 'lucide-react'
import { fetchNews } from '../../api/news'
import researchedNewsSeed from '../../data/researchedNewsSeed.json'
import { getCategory } from '../../lib/categories'

function fallbackNews() {
  return researchedNewsSeed.slice(0, 40).map((item, index) => ({
    id: item.external_id || `seed-news-${index}`,
    title: item.title,
    summary: item.summary,
    outlet: item.news_outlet || item.source || 'Naija Pulse newsroom',
    url: item.url || null,
    category_code: item.category_code,
    state_name: item.state_name,
    lga_name: item.lga_name,
    latitude: item.lat,
    longitude: item.lng,
    source_type: item.news_outlet ? 'newsroom' : 'community',
    published_at: new Date(Date.now() - Number(item.hours_ago || 24) * 3600000).toISOString(),
  }))
}

function timeAgo(value) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3600000))
  return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default function NewsPanel({ onFlyToPlace }) {
  const [articles, setArticles] = useState(() => fallbackNews())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await fetchNews({ search: query || undefined })
      if (rows?.length) {
        setArticles(rows)
        setLive(true)
      }
    } catch {
      setLive(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!query) return articles
    const q = query.toLowerCase()
    return articles.filter((article) => `${article.title} ${article.summary} ${article.state_name}`.toLowerCase().includes(q))
  }, [articles, query])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-brand"><Newspaper size={19} /><span className="text-xs font-bold uppercase tracking-wider">Nigeria news desk</span></div>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">What’s happening around Nigeria</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">Headlines from Nigerian newsrooms, official notices, and community updates. Open the original source before sharing.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="btn btn-soft"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </header>

        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="field pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Nigeria news, state or area…" aria-label="Search Nigeria news" />
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-3"><span className={`live-dot !h-2 !w-2 ${live ? '' : '!bg-warn'}`} /> {live ? 'Feed connected' : 'Showing cached newsroom feed'} · {filtered.length} stories</div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((article) => {
            const category = getCategory(article.category_code)
            return (
              <article key={article.id} className="card flex flex-col p-4">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                  <span className="inline-flex items-center gap-1 text-brand"><Newspaper size={12} /> {article.outlet}</span>
                  <span>{timeAgo(article.published_at)}</span>
                </div>
                <h2 className="mt-2 text-base font-bold leading-snug text-ink">{article.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">{article.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                  {category && <span className="chip" style={{ borderColor: `${category.color}66` }}>{category.emoji} {category.label}</span>}
                  {article.state_name && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {article.lga_name || article.state_name}</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  {article.latitude && onFlyToPlace && <button type="button" onClick={() => onFlyToPlace({ lat: article.latitude, lng: article.longitude, label: article.title, zoom: 12 })} className="btn btn-soft flex-1">View on map</button>}
                  {article.url && <a href={article.url} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1"><ExternalLink size={14} /> Original source</a>}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

