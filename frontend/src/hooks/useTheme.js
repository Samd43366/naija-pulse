import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'naija-pulse-theme'

function readInitialTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

// Light / dark theme switcher. The attribute is applied on <html data-theme="...">
// (also pre-applied in index.html before first paint, so there is no flash).
export function useTheme() {
  const [theme, setThemeState] = useState(readInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#090e0c' : '#f4f6f2')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private mode: ignore */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
