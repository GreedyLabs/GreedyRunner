import { Router, type Request, type Response } from 'express'
import { SearchQuerySchema, CoordsQuerySchema, RegionIdParamSchema, RegionIdQuerySchema } from '../../../schemas/airQuality'
import * as realClient from '../../../infrastructure/apiClients/airKoreaClient'
import * as mockClient from '../../../infrastructure/apiClients/mockAirQualityClient'
import { RegionNotFoundError } from '../../../infrastructure/apiClients/airKoreaClient'
import { UpstreamApiError } from '../../../infrastructure/apiClients/openApiResponse'
import type { AirQualityData } from '../../../domain/entities/airQuality'

const client = process.env.AIR_KOREA_API_KEY ? realClient : mockClient

// ── 인메모리 캐시 (대기질 응답) ──────────────────────────────
// 에어코리아 데이터는 1시간 단위 발표이므로 5분 캐시로 충분하다.
const CACHE_TTL = 5 * 60 * 1000 // 5분
/** 상류가 불완전한 응답을 준 경우의 TTL — 곧 다시 시도할 수 있게 짧게 잡는다. */
const DEGRADED_CACHE_TTL = 60_000 // 1분
/**
 * 캐시 상한. 예전에는 상한도 만료 제거도 없는 Map이어서, 키에 들어가는 좌표가
 * 방문자마다 달라(전체 정밀도 lat/lng) 엔트리가 방문자 수만큼 무한히 쌓였다.
 */
const CACHE_MAX_ENTRIES = 500

const cache = new Map<string, { data: AirQualityData; expiresAt: number }>()

if (!process.env.AIR_KOREA_API_KEY) {
  console.warn('[air-quality] AIR_KOREA_API_KEY 미설정 → Mock 데이터 사용')
}

/**
 * 좌표를 약 1km 격자로 반올림한 캐시 키.
 *
 * 전체 정밀도 좌표를 키로 쓰면 같은 측정소를 보는 방문자끼리도 캐시를 공유하지 못해
 * 사실상 "방문자별 캐시"가 된다. 모든 새 방문자가 상류 팬아웃(측정소 3곳 + 날씨 2회 + UV)을
 * 그대로 태우므로 일일 호출 한도가 방문자 수에 비례해 녹는다 — 한도 소진의 주요 경로였다.
 * 날씨·UV는 km 단위로 사실상 동일하므로 소수점 2자리(≈1.1km)로 묶어도 값이 달라지지 않는다.
 */
function coordKey(lat?: number, lng?: number): string {
  if (lat == null || lng == null) return ':'
  return `${lat.toFixed(2)}:${lng.toFixed(2)}`
}

/**
 * 응답의 상류 상태로 캐시 TTL을 고른다.
 *
 * 짧은 TTL은 **곧 복구될 수 있는** 실패에만 의미가 있다. 상류 장애(error)와 응답 지연
 * (timeout)은 몇 분 뒤 다시 시도할 가치가 있으므로 1분만 캐싱한다.
 *
 * 반면 weather의 'unavailable'은 KMA_API_KEY가 없거나 좌표를 받지 못한 **영구 상태**다.
 * README가 KMA 키를 선택으로 두고 있으므로 키 없이 운영하는 구성이 정상인데, 이것을
 * degraded로 묶으면 그 구성에서는 모든 응답이 1분만 캐싱되어 에어코리아 호출이 5배로
 * 늘어난다 — 호출 한도를 지키려던 캐시가 반대로 한도를 태운다. 재시도해도 키는 생기지
 * 않으므로 정상 TTL을 준다.
 */
function ttlFor(status: AirQualityData['serviceStatus']): number {
  const transient = status.airKorea !== 'ok' || status.weather === 'timeout' || status.weather === 'error'
  return transient ? DEGRADED_CACHE_TTL : CACHE_TTL
}

function readCache(key: string): AirQualityData | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.data
}

function writeCache(key: string, data: AirQualityData): void {
  // 만료된 엔트리를 먼저 걷어낸다 — 상한에 도달했을 때만 훑어 비용을 억제한다.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now()
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k)
    }
    // 그래도 넘치면 가장 오래된 삽입 순서부터 버린다 (Map은 삽입 순서를 보존한다).
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
  }

  cache.set(key, { data, expiresAt: Date.now() + ttlFor(data.serviceStatus) })
}

/**
 * 실패를 HTTP 상태로 옮긴다.
 *
 * 예전에는 에러 메시지에 '찾을 수 없습니다'가 들어 있는지와 `err.name === 'AbortError'`만 보고
 * 나머지 전부를 502로 보냈다. 그래서 일일 한도 초과·서비스키 미등록처럼 **운영자가 조치해야
 * 하는 원인**이 상류 일시 장애와 똑같은 문구로 나갔고, 로그에도 원인이 남지 않았다.
 */
function sendUpstreamError(res: Response, label: string, err: unknown, subject: string): void {
  if (err instanceof RegionNotFoundError) {
    console.warn(`[${label}] ${err.message}`)
    res.status(404).json({ error: err.message })
    return
  }

  if (err instanceof UpstreamApiError) {
    console.error(`[${label}] kind=${err.kind} endpoint=${err.endpoint} code=${err.resultCode ?? '-'} snippet=${err.snippet ?? '-'}`)
    switch (err.kind) {
      case 'quota':
        res.status(429).json({
          error: '공공데이터포털 API 호출 한도를 초과했습니다. 자정 이후 다시 시도해 주세요.',
        })
        return
      case 'key':
        // 사용자가 할 수 있는 일이 없는 서버 설정 문제다. 5xx로 내야 모니터링에 잡힌다.
        res.status(500).json({ error: '서버의 공공데이터포털 서비스키 설정에 문제가 있습니다.' })
        return
      case 'nodata':
        res.status(503).json({ error: `${subject} 자료가 아직 발표되지 않았습니다. 잠시 후 다시 시도해 주세요.` })
        return
      default:
        res.status(502).json({ error: `${subject} 중 오류가 발생했습니다.` })
        return
    }
  }

  if (err instanceof Error && err.name === 'AbortError') {
    console.error(`[${label}] 상류 응답 지연(AbortError)`)
    res.status(504).json({ error: `상류 API 응답 지연으로 ${subject}를 완료할 수 없습니다. 잠시 후 다시 시도해 주세요.` })
    return
  }

  console.error(`[${label}]`, err)
  res.status(502).json({ error: `${subject} 중 오류가 발생했습니다.` })
}

export const airQualityRouter = Router()

/** GET /api/v1/air-quality/search?q=강남 */
airQualityRouter.get('/search', async (req: Request, res: Response) => {
  const parsed = SearchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  try {
    const results = await client.searchRegions(parsed.data.q)
    res.json({ results })
  } catch (err) {
    sendUpstreamError(res, 'search', err, '지역 검색')
  }
})

/** GET /api/v1/air-quality/by-coords?lat=37.5&lng=127.0 */
airQualityRouter.get('/by-coords', async (req: Request, res: Response) => {
  const parsed = CoordsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  try {
    const region = await client.getRegionByCoords(parsed.data.lat, parsed.data.lng)
    res.json(region)
  } catch (err) {
    sendUpstreamError(res, 'by-coords', err, '위치 기반 측정소 조회')
  }
})

/** GET /api/v1/air-quality/:regionId?lat=37.5&lng=127.0 */
airQualityRouter.get('/:regionId', async (req: Request, res: Response) => {
  const parsed = RegionIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }

  // 좌표는 선택적 — 있으면 기상 데이터도 함께 조회한다.
  // 다만 "좌표를 아예 안 보낸 것"과 "보냈지만 형식이 잘못된 것"은 구분한다. 예전에는 둘 다
  // 조용히 무시해서, lat만 보내거나 lat이 깨진 클라이언트가 400 대신 200을 받고
  // serviceStatus.weather='unavailable'을 보게 됐다 — 기상 API가 간헐적으로 죽은 것처럼 보였다.
  const coordsProvided = req.query.lat !== undefined || req.query.lng !== undefined
  const coordsParsed = RegionIdQuerySchema.safeParse(req.query)
  if (coordsProvided && !coordsParsed.success) {
    res.status(400).json({ error: coordsParsed.error.flatten().fieldErrors })
    return
  }
  const lat = coordsParsed.success ? coordsParsed.data.lat : undefined
  const lng = coordsParsed.success ? coordsParsed.data.lng : undefined

  try {
    const cacheKey = `${parsed.data.regionId}:${coordKey(lat, lng)}`
    const cached = readCache(cacheKey)
    if (cached) {
      res.json(cached)
      return
    }

    const data = await client.getAirQuality(parsed.data.regionId, lat, lng)
    writeCache(cacheKey, data)
    res.json(data)
  } catch (err) {
    sendUpstreamError(res, 'region', err, '대기질 정보 조회')
  }
})
