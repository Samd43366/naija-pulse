import { useEffect } from 'react'
import { X } from 'lucide-react'

// App-level modal: bottom sheet on phones, centred dialog on laptops.
export default function Modal({ title, subtitle, onClose, children, widthClass = 'lg:max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="anim-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-sheet)] lg:max-h-[88dvh] lg:rounded-3xl ${widthClass}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
