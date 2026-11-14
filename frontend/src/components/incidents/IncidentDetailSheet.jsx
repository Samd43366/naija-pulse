import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldAlert, Truck } from 'lucide-react'
import { getCategory } from '../../lib/categories'
import { fetchIncidentDetail } from '../../api/incidents'
import Sheet from '../ui/Sheet'
import TrustGauge from './TrustGauge'
import VerificationButtons from './VerificationButtons'
import { EvidenceSummary, FreshnessLabel, LocationLabel, SourceBadge } from './IncidentMeta'

function formatTimeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

function formatRemainingTtl(expiresIso) {
  const mins = Math.round((new Date(expiresIso).getTime() - Date.now()) / 60000)
  if (mins <= 0) return 'Expiring soon'
  if (mins < 60) return `Auto-expires in ${mins}m`
  return `Auto-expires in ${Math.round(mins / 60)}h`
}

export default function IncidentDetailSheet({
  incident,
  voterCoords,
  isOfflineDemo,
  onVote,
  onClose,
}) {
  const [reports, setReports] = useState(incident.reports || [])
  const cat = getCategory(incident.category_code)
  const isSensitive = incident.category_code === 'kidnapping_security'
  const agencyStatus = incident.status === 'resolved' ? 'resolved' : incident.agency_status

  useEffect(() => {
    setReports(incident.reports || [])
    if (isOfflineDemo) return
    let cancelled = false
    fetchIncidentDetail(incident.id)
      .then((detail) => {
        if (!cancelled && detail?.reports) setReports(detail.reports)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [incident.id, incident.reports, isOfflineDemo])

  return (
    <Sheet onClose={onClose} maxHeightClass="max-h-[72dvh]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-white"
          style={{ background: cat.color }}
        >
          {cat.emoji} {cat.label}
        </span>
        {agencyStatus === 'dispatched' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info/14 px-2.5 py-1 font-bold text-info">
            <Truck size={12} /> Unit dispatched
          </span>
        )}
        {agencyStatus === 'resolved' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok/14 px-2.5 py-1 font-bold text-ok">
            <CheckCircle2 size={12} /> Resolved
          </span>
        )}
        <FreshnessLabel value={incident.last_activity_at} />
        <span className="text-ink-3">· {formatRemainingTtl(incident.expires_at)}</span>
      </div>

      <h2 className="mt-2.5 text-lg font-bold leading-snug text-ink">{incident.title}</h2>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <SourceBadge source={incident.source} sourceType={incident.source_type} />
        {(incident.lga_name || incident.state_name) && (
          <span className="rounded-lg bg-surface-2 px-2 py-1 font-semibold text-ink-2"><LocationLabel incident={incident} /></span>
        )}
      </div>

      {incident.assigned_unit && agencyStatus !== 'resolved' && (
        <p className="mt-2 rounded-xl bg-info/10 px-3 py-2 text-xs font-medium text-info">
          Assigned: {incident.assigned_unit}
        </p>
      )}

      {incident.summary && incident.summary !== incident.title && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-2">{incident.summary}</p>
      )}

      {isSensitive && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-xs text-ink-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <strong className="text-ink">Location generalized for safety.</strong> Coordinates are
            blurred to a neighborhood zone (~1.2 km) to protect victims and reporters.
          </span>
        </div>
      )}

      <div className="mt-3">
        <TrustGauge
          score={incident.trust_score}
          reportCount={incident.report_count}
          confirmCount={incident.confirm_count}
          disputeCount={incident.dispute_count}
        />
      </div>
      <div className="mt-2">
        <EvidenceSummary incident={incident} />
      </div>

      <VerificationButtons incident={incident} voterCoords={voterCoords} onVote={onVote} />

      {reports.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">
            Witness reports merged ({reports.length})
          </p>
          <ul className="mt-2 space-y-2">
            {reports.slice(0, 5).map((r) => (
              <li key={r.id} className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
                <p className="leading-relaxed">{r.description}</p>
                {r.media_url && (
                  <img
                    src={r.media_url}
                    alt="Sanitized citizen report"
                    className="mt-2 max-h-36 rounded-lg object-cover"
                  />
                )}
                <p className="mt-1.5 text-[10px] text-ink-3">
                  Local area report · {formatTimeAgo(r.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
