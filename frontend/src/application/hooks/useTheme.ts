import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'gr_theme'

function initialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Light/dark toggle backed by Tailwind's `darkMode: 'class'` strategy —
 * toggles the `dark` class on <html>, which flips the CSS variables defined
 * in index.css (--paper/--panel/--accent/etc.) for every `bg-panel`-style
 * utility at once, without needing `dark:` on each usage.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(initialMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  function toggle() {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  return { mode, toggle }
}
