/**
 * 에어코리아 Open API 클라이언트
 *
 * regionId 포맷:
 *   - `tm:{tmX}:{tmY}`      — 지역명 검색 결과 (TM 좌표 → 가장 가까운 측정소 조회)
 *   - `station:{stationName}` — 좌표 기반 조회 결과 (측정소명 직접 사용)
 */

import proj4 from 'proj4'
import type { AirQualityData, AirQualityMetrics } from '../../domain/entities/airQuality'
import type { Region } from '../../domain/entities/region'
import { getRunningIndex } from '../../domain/useCases/getRunningIndex'

const API_KEY = process.env.AIR_KOREA_API_KEY ?? ''
const MSRS_BASE = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc'
const ARPL_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc'

// 한국 중부원점 TM 좌표계 (EPSG:2097, Bessel 타원체)
proj4.defs(
  'KOREAN_TM',
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-146.43,507.89,681.46 +units=m +no_defs'
)

// ── 좌표 변환 ─────────────────────────────────────────────────

function latLngToTM(lat: number, lng: number): { tmX: number; tmY: number } {
  const [tmX, tmY] = proj4('EPSG:4326', 'KOREAN_TM', [lng, lat])
  return { tmX, tmY }
}

function tmToLatLng(tmX: number, tmY: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('KOREAN_TM', 'EPSG:4326', [tmX, tmY])
  return { lat, lng }
}

// ── AirKorea 공통 응답 타입 ───────────────────────────────────

interface AirKoreaResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string }
    body: { items: T[]; totalCount: number }
  }
}

// ── 측정소 정보 API ──────────────────────────────────────────

interface NearbyStation {
  stationName: string
  addr: string
  tm: number // 거리(km)
}

async function getNearbyStations(tmX: number, tmY: number): Promise<NearbyStation[]> {
  const url = new URL(`${MSRS_BASE}/getNearbyMsrstnList`)
  url.searchParams.set('serviceKey', API_KEY)
  url.searchParams.set('returnType', 'json')
  url.searchParams.set('tmX', tmX.toFixed(6))
  url.searchParams.set('tmY', tmY.toFixed(6))
  url.searchParams.set('ver', '1.1')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`getNearbyMsrstnList HTTP ${res.status}`)
  const json = (await res.json()) as AirKoreaResponse<NearbyStation>
  const { resultCode, resultMsg } = json.response.header
  if (resultCode !== '00') throw new Error(`getNearbyMsrstnList API 오류: ${resultMsg}`)
  return json.response.body.items ?? []
}

interface TmCoordResult {
  umdName: string
  sggName: string
  sidoName: string
  tmX: string | number  // API가 문자열로 반환
  tmY: string | number
}

async function getTMCoords(query: string): Promise<TmCoordResult[]> {
  const url = new URL(`${MSRS_BASE}/getTMStdrCrdnt`)
  url.searchParams.set('serviceKey', API_KEY)
  url.searchParams.set('returnType', 'json')
  url.searchParams.set('numOfRows', '20')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('umdName', query)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`getTMStdrCrdnt HTTP ${res.status}`)
  const json = (await res.json()) as AirKoreaResponse<TmCoordResult>
  const { resultCode, resultMsg } = json.response.header
  if (resultCode !== '00') throw new Error(`getTMStdrCrdnt API 오류: ${resultMsg}`)
  return json.response.body.items ?? []
}

// ── 대기오염 정보 API ─────────────────────────────────────────

interface StationMeasurement {
  dataTime: string   // "2024-04-02 10:00"
  pm10Value: string
  pm25Value: string
  o3Value: string
  no2Value: string
  coValue: string
}

async function getStationMeasurements(stationName: string): Promise<StationMeasurement[]> {
  const url = new URL(`${ARPL_BASE}/getMsrstnAcctoRltmMesureDnsty`)
  url.searchParams.set('serviceKey', API_KEY)
  url.searchParams.set('returnType', 'json')
  url.searchParams.set('numOfRows', '24')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('stationName', stationName)
  url.searchParams.set('dataTerm', 'DAILY')
  url.searchParams.set('ver', '1.0')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`getMsrstnAcctoRltmMesureDnsty HTTP ${res.status}`)
  const json = (await res.json()) as AirKoreaResponse<StationMeasurement>
  const { resultCode, resultMsg } = json.response.header
  if (resultCode !== '00') throw new Error(`getMsrstnAcctoRltmMesureDnsty API 오류: ${resultMsg}`)
  return json.response.body.items ?? []
}

// ── 공개 함수 ────────────────────────────────────────────────

/**
 * 읍면동명 검색 → Region 목록 (id = `tm:{tmX}:{tmY}`)
 * 선택된 Region의 id로 getAirQuality()를 호출하면 가장 가까운 측정소를 찾아 데이터 반환
 */
export async function searchRegions(query: string): Promise<Region[]> {
  const results = await getTMCoords(query.trim())
  return results.slice(0, 6).map((r) => {
    const tmX = parseFloat(String(r.tmX))
    const tmY = parseFloat(String(r.tmY))
    const { lat, lng } = tmToLatLng(tmX, tmY)
    return {
      id: `tm:${Math.round(tmX)}:${Math.round(tmY)}`,
      name: `${r.sidoName} ${r.sggName} ${r.umdName}`.replace(/\s+/g, ' ').trim(),
      shortName: r.umdName,
      city: r.sidoName,
      lat,
      lng,
    }
  })
}

/**
 * WGS84 좌표 → 가장 가까운 측정소 Region (id = `station:{stationName}`)
 */
export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  const { tmX, tmY } = latLngToTM(lat, lng)
  const stations = await getNearbyStations(tmX, tmY)
  if (stations.length === 0) throw new Error('주변 측정소를 찾을 수 없습니다.')

  const nearest = stations[0]
  const city = nearest.addr.split(' ')[0] ?? ''
  return {
    id: `station:${nearest.stationName}`,
    name: `${nearest.stationName} 측정소`,
    shortName: nearest.stationName,
    city,
    lat,
    lng,
  }
}

/**
 * regionId → 대기질 데이터 + 달리기 지수
 *   - `station:{name}` : 측정소명으로 바로 조회
 *   - `tm:{X}:{Y}`     : TM 좌표로 가장 가까운 측정소 조회 후 데이터 반환
 */
export async function getAirQuality(regionId: string): Promise<AirQualityData> {
  const stationName = await resolveStationName(regionId)
  const measurements = await getStationMeasurements(stationName)
  return buildAirQualityData(stationName, measurements)
}

// ── 내부 유틸 ──────────────────────────────────────────────

async function resolveStationName(regionId: string): Promise<string> {
  if (regionId.startsWith('station:')) {
    return regionId.slice('station:'.length)
  }
  if (regionId.startsWith('tm:')) {
    const parts = regionId.split(':')
    const tmX = parseFloat(parts[1])
    const tmY = parseFloat(parts[2])
    if (isNaN(tmX) || isNaN(tmY)) throw new Error(`잘못된 TM 좌표: ${regionId}`)
    const stations = await getNearbyStations(tmX, tmY)
    if (stations.length === 0) throw new Error('측정소를 찾을 수 없습니다.')
    return stations[0].stationName
  }
  throw new Error(`알 수 없는 regionId 형식: ${regionId}`)
}

function buildAirQualityData(
  stationName: string,
  measurements: StationMeasurement[]
): AirQualityData {
  const now = new Date()
  const currentHour = now.getHours()

  // API 응답은 최신순(내림차순) → 최신 측정값 = 현재 상태
  const latestItem = measurements[0]
  const currentMetrics = latestItem ? parseMeasurement(latestItem) : defaultMetrics()
  const currentRunningIndex = getRunningIndex(currentMetrics)

  // 실측 데이터를 시간별로 매핑
  const hourlyMap = new Map<number, AirQualityMetrics>()
  for (const item of measurements) {
    const hour = parseHour(item.dataTime)
    if (!hourlyMap.has(hour)) hourlyMap.set(hour, parseMeasurement(item))
  }

  // 24시간 예보 구성
  const hourlyForecast = Array.from({ length: 24 }, (_, hour) => {
    let metrics: AirQualityMetrics
    if (hourlyMap.has(hour)) {
      // 실측값 사용
      metrics = hourlyMap.get(hour)!
    } else if (hour <= currentHour) {
      // 과거이지만 데이터 없음 → 현재값으로 대체
      metrics = currentMetrics
    } else {
      // 미래 시간 → 출퇴근 패턴 기반 예측
      metrics = predictMetrics(currentMetrics, hour)
    }
    return { hour, airQuality: metrics, runningIndex: getRunningIndex(metrics) }
  })

  const bestRunningHours = [...hourlyForecast]
    .filter((h) => h.runningIndex.score >= 60)
    .sort((a, b) => b.runningIndex.score - a.runningIndex.score)
    .slice(0, 3)
    .map((h) => h.hour)
    .sort((a, b) => a - b)

  return {
    regionName: `${stationName} 측정소`,
    updatedAt: now,
    current: {
      airQuality: currentMetrics,
      runningIndex: currentRunningIndex,
    },
    hourlyForecast,
    bestRunningHours,
  }
}

function parseMeasurement(item: StationMeasurement): AirQualityMetrics {
  return {
    pm25: parseNum(item.pm25Value),
    pm10: parseNum(item.pm10Value),
    o3: roundTo(parseNum(item.o3Value), 3),
    no2: roundTo(parseNum(item.no2Value), 3),
    co: roundTo(parseNum(item.coValue), 2),
  }
}

/** "-" 또는 빈 값은 0으로 처리 */
function parseNum(v: string): number {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function roundTo(v: number, decimals: number): number {
  return parseFloat(v.toFixed(decimals))
}

function parseHour(dataTime: string): number {
  // "2024-04-02 10:00" → 10
  return parseInt(dataTime.split(' ')[1]?.split(':')[0] ?? '0', 10)
}

function defaultMetrics(): AirQualityMetrics {
  return { pm25: 0, pm10: 0, o3: 0, no2: 0, co: 0 }
}

function predictMetrics(base: AirQualityMetrics, hour: number): AirQualityMetrics {
  const factor = isRushHour(hour) ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0
  return {
    pm25: roundTo(base.pm25 * factor, 1),
    pm10: roundTo(base.pm10 * factor, 1),
    o3: roundTo(base.o3 * (isRushHour(hour) ? 1.2 : factor), 3),
    no2: roundTo(base.no2 * factor, 3),
    co: roundTo(base.co * factor, 2),
  }
}

function isRushHour(h: number) {
  return (h >= 7 && h <= 9) || (h >= 17 && h <= 19)
}
function isEarlyMorning(h: number) {
  return h >= 3 && h <= 6
}
