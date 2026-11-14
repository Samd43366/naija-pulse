import { Activity } from 'lucide-react'

// Naija Pulse brand mark: green tile with a pulse line, tri-colour (green · white · green) accent.
export default function BrandMark({ size = 36, withText = true, subtitle = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        style={{ width: size, height: size }}
        className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-brand text-brand-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--brand)_35%,transparent)]"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 bg-black/10" />
        <span className="absolute inset-y-0 right-0 w-1/3 bg-black/10" />
        <Activity size={size * 0.55} strokeWidth={2.6} className="relative" />
      </div>
      {withText && (
        <div className="leading-tight">
          <div className="font-display text-[17px] font-extrabold tracking-tight text-ink">
            Naija Pulse
          </div>
          {subtitle && (
            <div className="text-[10.5px] font-medium text-ink-3">Live safety intelligence</div>
          )}
        </div>
      )}
    </div>
  )
}
