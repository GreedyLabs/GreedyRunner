/**
 * IndexNow 핑 스크립트 (배포 후 CI에서 실행).
 *
 * 1. 새 이미지가 라이브될 때까지 키 파일(/{key}.txt)을 폴링해 배포 완료를 확인
 * 2. 라이브 sitemap.xml의 전체 URL을 IndexNow(빙/네이버/얀덱스 공용)에 제출
 *
 * 의존성 없음 — plain Node 18+ (fetch 내장)로 실행:
 *   node frontend/scripts/indexnow-ping.mjs
 */
const HOST = 'run.greedylabs.kr'
const ORIGIN = `https://${HOST}`
const KEY = 'fb3839205443b4acde21d448a1338a30'
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const POLL_INTERVAL_MS = 15_000
const POLL_TIMEOUT_MS = 10 * 60_000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// 1. 키 파일이 서빙될 때까지 대기 (= 새 프론트엔드 이미지가 라이브)
const deadline = Date.now() + POLL_TIMEOUT_MS
for (;;) {
  try {
    const res = await fetch(`${ORIGIN}/${KEY}.txt`, { cache: 'no-store' })
    if (res.ok && (await res.text()).trim() === KEY) break
  } catch {
    // 네트워크 오류는 재시도
  }
  if (Date.now() > deadline) {
    console.error(`indexnow: ${POLL_TIMEOUT_MS / 60000}분 내에 키 파일이 라이브되지 않아 중단합니다.`)
    process.exit(1)
  }
  console.log('indexnow: 배포 대기 중...')
  await sleep(POLL_INTERVAL_MS)
}

// 2. 라이브 sitemap에서 URL 수집
const sitemapRes = await fetch(`${ORIGIN}/sitemap.xml`, { cache: 'no-store' })
if (!sitemapRes.ok) {
  console.error(`indexnow: sitemap.xml 요청 실패 (HTTP ${sitemapRes.status})`)
  process.exit(1)
}
const sitemap = await sitemapRes.text()
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
if (urlList.length === 0) {
  console.error('indexnow: sitemap에서 URL을 찾지 못했습니다.')
  process.exit(1)
}

// 3. IndexNow 제출 (한 번에 최대 10,000개 — 현재 규모에서는 단일 요청으로 충분)
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
})
// 200(처리됨)과 202(키 검증 대기)가 정상 응답
if (res.status !== 200 && res.status !== 202) {
  console.error(`indexnow: 제출 실패 (HTTP ${res.status}) ${await res.text()}`)
  process.exit(1)
}
console.log(`indexnow: ${urlList.length}개 URL 제출 완료 (HTTP ${res.status})`)
