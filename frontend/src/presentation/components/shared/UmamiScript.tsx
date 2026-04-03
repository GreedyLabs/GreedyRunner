import { useEffect } from 'react'

const UMAMI_URL = import.meta.env.VITE_UMAMI_URL as string | undefined
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined

export function UmamiScript() {
  useEffect(() => {
    if (!UMAMI_URL || !WEBSITE_ID) return

    const script = document.createElement('script')
    script.defer = true
    script.src = `${UMAMI_URL}/script.js`
    script.setAttribute('data-website-id', WEBSITE_ID)
    script.setAttribute('data-host-url', UMAMI_URL)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return null
}
