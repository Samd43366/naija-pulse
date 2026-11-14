import { useState } from 'react'
import { Hexagon, Home, Shield, Star, Zap } from 'lucide-react'
import Sheet from '../ui/Sheet'

function RatingRow({ label, Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon size={14} />
        </span>
        {label}
      </span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="p-0.5 transition active:scale-90"
          >
            <Star
              size={20}
              className={n <= value ? 'fill-warn text-warn' : 'text-line-strong'}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function ScoreCard({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-3 text-center">
      <p className="text-[11px] font-medium text-ink-3">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

// Core Feature #4: Area Intelligence & Crowdsourced Ratings per Uber H3 Hexagon.
// Combines objective Bayesian priors (ACLED security + NEMA flood) with subjective
// resident scores (Safety, Power Supply, Livability).
export default function HexRatingSheet({ hexInfo, onSubmitRating, onClose }) {
  const { h3Index, stat, cellIncidents } = hexInfo
  const [safety, setSafety] = useState(Math.round(stat?.community_safety_score || 4))
  const [power, setPower] = useState(Math.round(stat?.community_power_score || 3))
  const [livability, setLivability] = useState(Math.round(stat?.community_livability_score || 4))
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSavedMsg(null)
    try {
      await onSubmitRating(h3Index, {
        safety_rating: safety,
        power_rating: power,
        livability_rating: livability,
        comment: comment.trim() || undefined,
      })
      setSavedMsg('Area rating saved. Community averages updated.')
      setComment('')
    } finally {
      setSaving(false)
    }
  }

  const secRiskPct = Math.round((stat?.historical_security_risk ?? 0.12) * 100)
  const floodRiskPct = Math.round((stat?.historical_flood_risk ?? 0.15) * 100)

  return (
    <Sheet
      onClose={onClose}
      eyebrow={`H3 zone · ${h3Index}`}
      eyebrowIcon={Hexagon}
      title={
        stat?.lga_name
          ? `${stat.lga_name}, ${stat.state_name || 'Nigeria'}`
          : 'Neighbourhood intelligence'
      }
      maxHeightClass="max-h-[72dvh]"
    >
      <div className="grid grid-cols-3 gap-2">
        <ScoreCard label="Safety" value={stat ? `${stat.community_safety_score}/5` : '—'} tone="text-ok" />
        <ScoreCard label="Power (NEPA)" value={stat ? `${stat.community_power_score}/5` : '—'} tone="text-warn" />
        <ScoreCard label="Livability" value={stat ? `${stat.community_livability_score}/5` : '—'} tone="text-info" />
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-3">
          Historical risk priors
        </p>
        <div className="mt-2 space-y-2">
          {[
            { label: 'Security', pct: secRiskPct, color: 'bg-danger' },
            { label: 'Flood', pct: floodRiskPct, color: 'bg-info' },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink-2">
                <span>{r.label}</span>
                <span>{r.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">{cellIncidents.length} live event(s) in this zone</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 border-t border-line pt-3">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Star size={15} className="text-warn" />
          Rate this area
        </p>
        <p className="text-xs text-ink-3">As a resident or regular commuter</p>

        <div className="mt-1.5">
          <RatingRow label="Safety & security" Icon={Shield} value={safety} onChange={setSafety} />
          <RatingRow label="Power supply" Icon={Zap} value={power} onChange={setPower} />
          <RatingRow label="Roads & livability" Icon={Home} value={livability} onChange={setLivability} />
        </div>

        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional note, e.g. Band A light, bad drainage when it rains"
          className="field mt-2"
        />

        {savedMsg && <p className="mt-2 text-xs font-medium text-ok">{savedMsg}</p>}

        <button type="submit" disabled={saving} className="btn btn-primary mt-3 w-full">
          {saving ? 'Saving rating…' : 'Submit area rating'}
        </button>
      </form>
    </Sheet>
  )
}
