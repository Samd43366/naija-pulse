import { X } from 'lucide-react'

// Responsive floating panel used on the map screen.
// - Phones:  slides up from the bottom as a rounded sheet with a drag-handle look.
// - Laptops: becomes a floating side card on the right edge of the map.
export default function Sheet({
  title,
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  subtitle,
  onClose,
  children,
  maxHeightClass = 'max-h-[74dvh]',
  z = 1000,
}) {
  return (
    <section
      style={{ zIndex: z }}
      className={`anim-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-[var(--shadow-sheet)] ${maxHeightClass} lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[400px] lg:rounded-3xl lg:border-b lg:shadow-[var(--shadow-float)]`}
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />

      {(title || onClose) && (
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
                {EyebrowIcon && <EyebrowIcon size={13} />}
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-0.5 text-base font-bold leading-snug text-ink">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition hover:bg-surface-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </section>
  )
}
