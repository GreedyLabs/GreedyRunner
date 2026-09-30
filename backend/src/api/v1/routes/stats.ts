import { Router } from 'express'

const UMAMI_URL = process.env.UMAMI_URL ?? 'http://umami:3000'
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ''
/**
 * 인증 정보는 기본값을 두지 않는다.
 *
 * 예전에는 `?? 'admin'` / `?? 'umami'`로 Umami의 초기 기본 계정이 소스에 박혀 있었다.
 * 환경변수를 빼먹으면 조용히 그 값으로 로그인을 시도하므로, 설정 누락이 "통계가 안 나온다"가
 * 아니라 "기본 계정으로 붙는다"가 된다. 비어 있으면 아예 호출하지 않는다.
 */
const UMAMI_USERNAME = process.env.UMAMI_USERNAME ?? ''
const UMAMI_PASSWORD = process.env.UMAMI_PASSWORD ?? ''

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30분
const FETCH_TIMEOUT_MS = 3000

let cachedToken: string | null = null
let tokenExpiry = 0

const isConfigured = (): boolean => !!(UMAMI_WEBSITE_ID && UMAMI_USERNAME && UMAMI_PASSWORD)

/** Umami는 내부 네트워크에 있지만 응답이 멈추면 이 엔드포인트도 함께 매달린다. */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function login(): Promise<string> {
  const res = await fetchWithTimeout(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_USERNAME, password: UMAMI_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Umami 인증 실패 (HTTP ${res.status})`)
  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error('Umami 인증 응답에 token이 없음')
  cachedToken = data.token
  tokenExpiry = Date.now() + TOKEN_TTL_MS
  return data.token
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  return login()
}

/** 토큰을 무효화한다 — 401을 받았을 때 다음 호출이 재로그인하도록. */
function invalidateToken(): void {
  cachedToken = null
  tokenExpiry = 0
}

async function fetchStats(startAt: number, endAt: number): Promise<{ visitors: number }> {
  const url = `${UMAMI_URL}/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`

  // 토큰이 서버 쪽에서 무효화되면(재배포·시크릿 교체) 캐시된 토큰으로 30분 동안 401을 받아
  // 방문자 수가 계속 0으로 나왔다. 401·403이면 한 번 재로그인하고 다시 시도한다.
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken()
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401 || res.status === 403) {
      invalidateToken()
      if (attempt === 0) continue
      throw new Error(`Umami 통계 조회 권한 오류 (HTTP ${res.status})`)
    }
    if (!res.ok) throw new Error(`Umami 통계 조회 실패 (HTTP ${res.status})`)
    const data = (await res.json()) as { visitors?: number | { value?: number } }
    // Umami 버전에 따라 visitors가 숫자이거나 { value } 객체다.
    const visitors = typeof data.visitors === 'object' ? data.visitors?.value : data.visitors
    return { visitors: typeof visitors === 'number' ? visitors : 0 }
  }
  throw new Error('Umami 통계 조회 실패')
}

/**
 * KST 기준 오늘 00:00의 epoch ms.
 *
 * 예전에는 `new Date()`에 `setHours(0,0,0,0)`을 걸어 **서버 로컬 타임존**의 자정을 썼다.
 * 컨테이너가 UTC로 돌면 한국 사용자에게 "오늘"이 KST 09:00부터가 되어, 오전 방문자가
 * 전날 집계에 들어간다.
 */
function kstTodayStart(): number {
  const now = new Date()
  const kstNow = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60_000)
  kstNow.setHours(0, 0, 0, 0)
  // KST 자정을 다시 UTC 인스턴트로 환산한다.
  return kstNow.getTime() - (now.getTimezoneOffset() + 540) * 60_000
}

/**
 * 전체 집계의 시작 시각.
 *
 * 예전에는 `new Date('2026-01-01')`이 소스에 박혀 있었다. 서비스 시작일을 손으로 적어 둔
 * 값이라 그 이전 데이터는 영구히 빠지고, 날짜가 바뀌면 코드를 고쳐야 한다.
 * Umami에 없는 기간을 요청해도 0이 더해질 뿐이므로 넉넉하게 과거로 잡는다.
 */
const TOTAL_WINDOW_MS = 10 * 365 * 24 * 60 * 60 * 1000 // 10년

export const statsRouter = Router()

statsRouter.get('/visitors', async (_req, res) => {
  if (!isConfigured()) {
    res.json({ today: 0, total: 0 })
    return
  }

  const now = Date.now()
  const [today, total] = await Promise.allSettled([
    fetchStats(kstTodayStart(), now),
    fetchStats(now - TOTAL_WINDOW_MS, now),
  ])

  // 통계는 화면의 부가 정보이므로 실패해도 200과 0을 돌려준다. 다만 예전의 빈 catch와
  // 달리 **왜 실패했는지 로그를 남긴다** — 그게 없어서 "통계가 0인데 이유를 모르는"
  // 상태가 계속됐다. 한쪽만 실패하면 성공한 쪽은 그대로 쓴다.
  for (const r of [today, total]) {
    if (r.status === 'rejected') console.warn('[stats]', r.reason)
  }

  res.json({
    today: today.status === 'fulfilled' ? today.value.visitors : 0,
    total: total.status === 'fulfilled' ? total.value.visitors : 0,
  })
})
