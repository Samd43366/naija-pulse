// Frontend incident contract. Live API responses, fallback responses, and local
// demo records are normalized here so the UI does not need storage-specific rules.

export function normalizeIncident(raw = {}) {
  const reports = Array.isArray(raw.reports) ? raw.reports : []
  const reportCount = Number(raw.report_count ?? reports.length ?? 0)
  const confirmCount = Number(raw.confirm_count ?? 0)
  const disputeCount = Number(raw.dispute_count ?? 0)
  const source = raw.source || 'crowd'
  const sourceType = raw.source_type || inferSourceType(source)
  const sensitive = raw.location_precision === 'macro' || raw.category_code === 'kidnapping_security'

  return {
    ...raw,
    report_count: reportCount,
    confirm_count: confirmCount,
    dispute_count: disputeCount,
    trust_score: clamp(Number(raw.trust_score ?? 0), 0, 1),
    source,
    source_type: sourceType,
    location_precision: raw.location_precision || (sensitive ? 'macro' : 'exact'),
    evidence_count: Number(raw.evidence_count ?? Math.max(reportCount, reports.length)),
    last_activity_at: raw.last_activity_at || raw.first_reported_at || null,
    observed_at: raw.observed_at || raw.first_reported_at || raw.last_activity_at || null,
    expires_at: raw.expires_at || null,
    status: raw.status || 'unconfirmed',
  }
}

export function normalizeIncidents(records) {
  return Array.isArray(records) ? records.map(normalizeIncident) : []
}

function inferSourceType(source) {
  const value = String(source).toLowerCase()
  if (value.includes('official') || value.includes('agency')) return 'official'
  if (value.includes('acled') || value.includes('nema') || value.includes('research')) return 'research'
  if (value.includes('seed') || value.includes('demo')) return 'seed'
  return 'crowd'
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

