// Visualizes the Bayesian trust_score (0.0 – 1.0) stored on each incident.
// Thresholds match verification_service.py (>= 0.65 promotes status to 'active').

export default function TrustGauge({ score, reportCount, confirmCount, disputeCount }) {
  const pct = Math.round((score || 0) * 100)

  let label = 'Unconfirmed bystander'
  let barColor = 'bg-warn'
  let textColor = 'text-warn'

  if (score >= 0.65) {
    label = 'Community verified'
    barColor = 'bg-ok'
    textColor = 'text-ok'
  } else if (score < 0.3) {
    label = 'Low credibility / disputed'
    barColor = 'bg-danger'
    textColor = 'text-danger'
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold ${textColor}`}>{label}</span>
        <span className="font-display text-base font-extrabold text-ink">{pct}%</span>
      </div>

      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
        {/* verification threshold marker at 65% */}
        <span className="absolute inset-y-0 left-[65%] w-px bg-ink/40" title="Verified at 65%" />
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-ink-3">
        <span>{reportCount} merged report(s)</span>
        <span>
          👍 {confirmCount} · 👎 {disputeCount}
        </span>
      </div>
    </div>
  )
}
