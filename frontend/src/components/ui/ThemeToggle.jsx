import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle({ theme, onToggle, compact = false, className = '' }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface text-ink-2 transition hover:border-brand hover:text-ink ${
        compact ? 'h-9 w-9 justify-center' : 'px-3 py-2 text-xs font-semibold'
      } ${className}`}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
