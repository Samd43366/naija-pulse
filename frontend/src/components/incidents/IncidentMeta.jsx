import { Clock3, FileCheck2, MapPin, ShieldCheck } from 'lucide-react'

export function formatFreshness(iso) {
  if (!iso) return 'Time unknown'
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (ageMinutes < 1) return 'Just now'
  if (ageMinutes < 60) return `${ageMinutes}m ago`
  const hours = Math.round(ageMinutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export function FreshnessLabel({ value, className = '' }) {
  const ageMinutes = value ? Math.max(0, (Date.now() - new Date(value).getTime()) / 60000) : Infinity
  const tone = ageMinutes <= 60 ? 'text-ok' : ageMinutes <= 360 ? 'text-warn' : 'text-ink-3'
  return (
    <span className={`inline-flex items-center gap-1 ${tone} ${className}`}>
      <Clock3 size={11} /> {formatFreshness(value)}
    </span>
  )
}

export function SourceBadge({ source, sourceType }) {
  const label = sourceType || source || 'community'
  const normalized = String(label).toLowerCase()
  const official = normalized.includes('official') || normalized.includes('agency')
  const research = normalized.includes('research') || normalized.includes('acled') || normalized.includes('nema')
  const tone = official ? 'bg-info/12 text-info' : research ? 'bg-violet/12 text-violet' : 'bg-brand-soft text-brand'
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {official || research ? <FileCheck2 size={11} /> : <ShieldCheck size={11} />}
      {official ? 'Official' : research ? 'Research' : 'Community'}
    </span>
  )
}

export function EvidenceSummary({ incident, compact = false }) {
  const reports = incident?.report_count ?? incident?.reports?.length ?? 0
  const confirms = incident?.confirm_count ?? 0
  const disputes = incident?.dispute_count ?? 0
  const score = Math.round((incident?.trust_score ?? 0) * 100)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
      <span className="inline-flex items-center gap-1"><FileCheck2 size={11} /> {reports} report{reports === 1 ? '' : 's'}</span>
      {!compact && <span className="text-ok">{confirms} confirm{confirms === 1 ? '' : 's'}</span>}
      {!compact && disputes > 0 && <span className="text-danger">{disputes} dispute{disputes === 1 ? '' : 's'}</span>}
      <span className="font-semibold text-ink-2">{score}% signal</span>
    </span>
  )
}

export function LocationLabel({ incident }) {
  const label = [incident?.lga_name, incident?.state_name].filter(Boolean).join(', ')
  if (!label) return null
  return <span className="inline-flex items-center gap-1"><MapPin size={11} /> {label}</span>
}

