import { useEffect } from 'react'

// 끝 슬래시를 제거해 `${UMAMI_URL}/script.js`·data-host-url이 `//script.js`,
// `//api/send` 처럼 이중 슬래시가 되는 것을 막는다 (일부 서버는 404 처리).
const UMAMI_URL = (import.meta.env.VITE_UMAMI_URL as string | undefined)?.replace(/\/+$/, '')
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined

export function UmamiScript() {
  useEffect(() => {
    if (!UMAMI_URL || !WEBSITE_ID) return

    // 분석 스크립트 로드 전 연결 준비 (DNS+TLS 선행)
    const preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = UMAMI_URL
    document.head.appendChild(preconnect)

    const script = document.createElement('script')
    script.defer = true
    script.src = `${UMAMI_URL}/script.js`
    script.setAttribute('data-website-id', WEBSITE_ID)
    script.setAttribute('data-host-url', UMAMI_URL)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
      document.head.removeChild(preconnect)
    }
  }, [])

  return null
}
