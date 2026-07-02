import { useEffect } from 'react'

const UMAMI_URL = import.meta.env.VITE_UMAMI_URL as string | undefined
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
