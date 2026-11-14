import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { distanceDecayWeight, formatDistance, haversineMeters } from '../../lib/geo'

// Feature 1: One-Tap Community Ping.
// Displays the voter's distance and Cauchy distance-decay weight BEFORE they tap,
// then sends +1 (Confirm) or -1 (Dispute) to POST /api/v1/incidents/{id}/verify.
export default function VerificationButtons({ incident, voterCoords, onVote }) {
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const distMeters = voterCoords
    ? haversineMeters(
        incident.latitude,
        incident.longitude,
        voterCoords.lat,
        voterCoords.lng,
      )
    : null

  const proximityPct =
    distMeters !== null ? Math.round(distanceDecayWeight(distMeters) * 100) : null

  async function handleClick(vote) {
    if (!voterCoords || submitting) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const res = await onVote(incident, {
        vote,
        latitude: voterCoords.lat,
        longitude: voterCoords.lng,
      })
      setFeedback({
        ok: true,
        text:
          vote === 1
            ? `Confirmed. Trust updated to ${Math.round(res.new_trust_score * 100)}%.`
            : `Dispute logged. Trust updated to ${Math.round(res.new_trust_score * 100)}%.`,
      })
    } catch (err) {
      setFeedback({ ok: false, text: `Could not submit vote: ${err.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-2.5">
      {distMeters !== null && (
        <p className="text-[11px] text-ink-3">
          📍 You are <strong className="text-ink-2">{formatDistance(distMeters)}</strong> away ·
          your vote carries{' '}
          <strong className="text-info">{proximityPct}%</strong> proximity weight
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleClick(1)}
          className="btn border-ok/35 bg-ok/12 text-ok hover:bg-ok/20"
        >
          <ThumbsUp size={16} />
          Still happening
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleClick(-1)}
          className="btn border-danger/35 bg-danger/10 text-danger hover:bg-danger/18"
        >
          <ThumbsDown size={16} />
          False / cleared
        </button>
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-center text-xs font-medium ${feedback.ok ? 'text-ok' : 'text-danger'}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  )
}
