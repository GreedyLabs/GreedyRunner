import { Router } from 'express'

const UMAMI_URL = process.env.UMAMI_URL ?? 'http://umami:3000'
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ''
const UMAMI_USERNAME = process.env.UMAMI_USERNAME ?? 'admin'
const UMAMI_PASSWORD = process.env.UMAMI_PASSWORD ?? 'umami'

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_USERNAME, password: UMAMI_PASSWORD }),
  })

  if (!res.ok) throw new Error('Umami 인증 실패')

  const data = (await res.json()) as { token: string }
  cachedToken = data.token
  tokenExpiry = Date.now() + 30 * 60 * 1000 // 30분 캐시
  return cachedToken
}

async function fetchStats(startAt: number, endAt: number): Promise<{ visitors: number }> {
  const token = await getToken()
  const url = `${UMAMI_URL}/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Umami 통계 조회 실패')
  const data = (await res.json()) as { visitors: number }
  return { visitors: data.visitors }
}

export const statsRouter = Router()

statsRouter.get('/visitors', async (_req, res) => {
  if (!UMAMI_WEBSITE_ID) {
    res.json({ today: 0, total: 0 })
    return
  }

  try {
    const now = Date.now()

    // 오늘 00:00
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 서비스 시작일 (충분히 과거)
    const serviceStart = new Date('2026-01-01').getTime()

    const [today, total] = await Promise.all([
      fetchStats(todayStart.getTime(), now),
      fetchStats(serviceStart, now),
    ])

    res.json({ today: today.visitors, total: total.visitors })
  } catch {
    res.json({ today: 0, total: 0 })
  }
})
