import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'gr_theme'

/**
 * 렌더 중에 실행되므로 예외가 새어 나가면 앱 전체가 흰 화면이 된다.
 * 시크릿 창·사이트 데이터 차단 브라우저에서는 localStorage 접근 자체가 throw하므로
 * 읽기와 matchMedia를 모두 감싼다.
 */
function initialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // 저장된 설정을 못 읽으면 시스템 설정으로 넘어간다.
  }
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
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
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 저장 실패는 다음 방문에서 시스템 설정을 쓰게 될 뿐이다.
      // 이 throw가 이펙트를 빠져나가면 테마 클래스 적용까지 함께 되돌려진다.
    }
  }, [mode])

  function toggle() {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  return { mode, toggle }
}
