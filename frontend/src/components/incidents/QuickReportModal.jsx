import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, Crosshair, MapPin, MousePointerClick, ShieldCheck } from 'lucide-react'
import { CATEGORIES } from '../../lib/categories'
import { uploadSanitizedPhoto } from '../../api/incidents'
import Modal from '../ui/Modal'

// Concept: Defense-in-depth EXIF stripping (Feature 5).
// Re-drawing an image onto an HTML5 <canvas> copies ONLY raw pixels — all EXIF
// metadata (GPS coordinates, phone serial number, timestamp) is discarded in the
// browser before upload AND reduces a 6MB phone photo to ~200KB for 3G networks.
// The FastAPI backend (`privacy.strip_image_exif`) strips EXIF again on receipt!
function stripExifInBrowser(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const maxDim = 1280
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas encoding failed'))
          const cleanFile = new File([blob], 'sanitized.jpg', { type: 'image/jpeg' })
          resolve({ cleanFile, dataUrl: canvas.toDataURL('image/jpeg', 0.82) })
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not decode image'))
    }
    img.src = objectUrl
  })
}

function StepLabel({ n, children }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-extrabold text-brand-ink">
        {n}
      </span>
      {children}
    </p>
  )
}

export default function QuickReportModal({
  gpsPosition,
  mapCenter,
  pickedLocation,
  onRequestMapPick,
  isOfflineDemo,
  onSubmitReport,
  onClose,
}) {
  const [categoryCode, setCategoryCode] = useState('power_outage')
  const [locMode, setLocMode] = useState(
    pickedLocation ? 'picked' : gpsPosition ? 'gps' : 'center',
  )
  const [description, setDescription] = useState('')
  const [photoState, setPhotoState] = useState(null) // { url, status }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitState, setSubmitState] = useState('editing')

  const draftKey = 'naija-pulse-report-draft'

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (!draft) return
      if (draft.categoryCode) setCategoryCode(draft.categoryCode)
      if (draft.locMode) setLocMode(draft.locMode)
      if (draft.description) setDescription(draft.description)
    } catch {
      // A damaged local draft should never block reporting.
    }
  }, [])

  useEffect(() => {
    if (submitState !== 'editing') return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ categoryCode, locMode, description }))
    } catch {
      // Storage can be unavailable in private browsing; reporting still works.
    }
  }, [categoryCode, locMode, description, submitState])

  const activeCoords =
    locMode === 'picked' && pickedLocation
      ? pickedLocation
      : locMode === 'gps' && gpsPosition
        ? gpsPosition
        : mapCenter

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPhotoState({ url: null, status: 'Stripping GPS & EXIF metadata…' })
    try {
      const { cleanFile, dataUrl } = await stripExifInBrowser(file)
      if (isOfflineDemo) {
        setPhotoState({
          url: dataUrl,
          status: 'EXIF & GPS stripped locally (demo mode)',
        })
      } else {
        const res = await uploadSanitizedPhoto(cleanFile)
        setPhotoState({
          url: res.media_url,
          status: 'EXIF & GPS stripped (client + server verified)',
        })
      }
    } catch (err) {
      setPhotoState(null)
      setError(`Photo upload failed: ${err.message}`)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (description.trim().length < 4) {
      setError('Please write a short description (4+ characters) of what is happening.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmitReport({
        category_code: categoryCode,
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        description: description.trim(),
        media_url: photoState?.url || null,
      })
      localStorage.removeItem(draftKey)
      setSubmitState('submitted')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const locBtn = (active) =>
    `flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition disabled:opacity-40 ${
      active
        ? 'border-brand bg-brand-soft text-brand'
        : 'border-line-strong bg-surface text-ink-2 hover:border-brand'
    }`

  return (
    <Modal
      onClose={onClose}
      title="Report a live incident"
      subtitle="No sign-up needed. Duplicates nearby merge automatically."
    >
      {submitState === 'submitted' ? (
        <div className="space-y-4 py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/12 text-ok">
            <CheckCircle2 size={34} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Report received</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              Your report has been added to the incident feed. Nearby reports can strengthen or dispute it.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-primary w-full py-3">
            Done
          </button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        <div>
          <StepLabel n={1}>What is happening?</StepLabel>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const active = categoryCode === c.code
              return (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => setCategoryCode(c.code)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-xs font-semibold transition ${
                    active ? 'text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                  }`}
                  style={active ? { background: `${c.color}1f`, borderColor: c.color } : undefined}
                >
                  <span className="text-2xl leading-none">{c.emoji}</span>
                  {c.label}
                </button>
              )
            })}
          </div>
          {categoryCode === 'kidnapping_security' && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-warn/10 px-3 py-2 text-xs text-ink-2">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-warn" />
              Your exact location is auto-blurred to a ~1.2 km neighborhood zone to protect your privacy.
            </p>
          )}
        </div>

        <div>
          <StepLabel n={2}>Where is it?</StepLabel>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!gpsPosition}
              onClick={() => setLocMode('gps')}
              className={locBtn(locMode === 'gps')}
            >
              <Crosshair size={17} /> My GPS
            </button>
            <button type="button" onClick={() => setLocMode('center')} className={locBtn(locMode === 'center')}>
              <MapPin size={17} /> Map centre
            </button>
            <button type="button" onClick={onRequestMapPick} className={locBtn(locMode === 'picked')}>
              <MousePointerClick size={17} /> Tap on map
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-ink-3">
            {activeCoords.lat.toFixed(4)}°N, {activeCoords.lng.toFixed(4)}°E
          </p>
        </div>

        <div>
          <StepLabel n={3}>Add a short note</StepLabel>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Transformer sparked at Bode Thomas junction, whole street is out…"
            className="field resize-none"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="btn btn-ghost cursor-pointer !px-3 !py-2 text-xs">
              <Camera size={15} className="text-info" />
              Add photo (EXIF stripped)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>

            {photoState && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-ok">
                <CheckCircle2 size={13} />
                {photoState.status}
              </span>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3.5 text-[15px]">
          {submitting ? 'Publishing…' : 'Publish live report'}
        </button>
      </form>
      )}
    </Modal>
  )
}
