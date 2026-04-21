/**
 * 기상청 단기예보 API 클라이언트
 *
 * 초단기실황: 현재 기온·습도·풍속·강수형태
 * 단기예보:   3시간 간격 예보 (최대 3일치)
 *
 * 기상청 격자 좌표 (nx, ny) 변환 포함
 */

import type { WeatherMetrics } from '../../domain/entities/weather'

const API_KEY = process.env.KMA_API_KEY ?? ''
const BASE_URL = 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0'

// 5초 이내 응답을 목표로 기상청 API 타임아웃을 4초로 제한.
// 타임아웃 시 호출부(getAirQuality)는 weatherStatus='timeout'으로 표시하고
// 대기질만으로 러닝 지수를 계산한다.
async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ── 기상청 격자 좌표 변환 (LCC DFS) ─────────────────────────

interface GridCoord { nx: number; ny: number }

function latLngToGrid(lat: number, lng: number): GridCoord {
  const RE = 6371.00877     // 지구 반경(km)
  const GRID = 5.0          // 격자 간격(km)
  const SLAT1 = 30.0        // 투영 위도1(degree)
  const SLAT2 = 60.0        // 투영 위도2(degree)
  const OLON = 126.0        // 기준점 경도(degree)
  const OLAT = 38.0         // 기준점 위도(degree)
  const XO = 43             // 기준점 X좌표(GRID)
  const YO = 136            // 기준점 Y좌표(GRID)

  const DEGRAD = Math.PI / 180.0
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lng * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  }
}

// ── 공통 유틸 ────────────────────────────────────────────────

/** 시스템 타임존과 무관하게 KST(UTC+9) 기준 Date 반환 */
function nowKST(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000
  return new Date(utc + 9 * 60 * 60_000)
}

/** 기상청 API 기준 시각 계산 — 초단기실황은 매시 정각 발표, 40분 후 제공 */
function getUltraSrtBaseTime(): { baseDate: string; baseTime: string } {
  const kst = nowKST()
  // 현재 분이 40분 미만이면 1시간 전 데이터 사용
  if (kst.getMinutes() < 40) {
    kst.setHours(kst.getHours() - 1)
  }
  return {
    baseDate: formatDate(kst),
    baseTime: `${String(kst.getHours()).padStart(2, '0')}00`,
  }
}

/** 단기예보 기준 시각 — 02, 05, 08, 11, 14, 17, 20, 23시 */
function getVilageFcstBaseTime(): { baseDate: string; baseTime: string } {
  const kst = nowKST()
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23]
  const currentHour = kst.getHours()
  const currentMin = kst.getMinutes()

  // 발표 후 약 10분 뒤 제공이므로 10분 미만이면 이전 발표 시각 사용
  let hour = baseHours[0]
  for (const h of baseHours) {
    if (currentHour > h || (currentHour === h && currentMin >= 10)) {
      hour = h
    }
  }
  // 현재 시간이 2시 이전이면 전날 23시 데이터
  if (currentHour < 2 || (currentHour === 2 && currentMin < 10)) {
    kst.setDate(kst.getDate() - 1)
    hour = 23
  }

  return {
    baseDate: formatDate(kst),
    baseTime: `${String(hour).padStart(2, '0')}00`,
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// ── API 호출 ─────────────────────────────────────────────────

interface KmaResponse {
  response: {
    header: { resultCode: string; resultMsg: string }
    body: {
      items: {
        item: Array<{
          category: string
          obsrValue?: string   // 초단기실황
          fcstValue?: string   // 단기예보
          fcstDate?: string
          fcstTime?: string
        }>
      }
    }
  }
}

/** 초단기실황 — 현재 기온·습도·풍속·강수형태 */
async function fetchUltraSrtNcst(nx: number, ny: number): Promise<Map<string, string>> {
  const { baseDate, baseTime } = getUltraSrtBaseTime()
  const url = new URL(`${BASE_URL}/getUltraSrtNcst`)
  url.searchParams.set('authKey', API_KEY)
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('numOfRows', '10')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('base_date', baseDate)
  url.searchParams.set('base_time', baseTime)
  url.searchParams.set('nx', String(nx))
  url.searchParams.set('ny', String(ny))

  const res = await fetchWithTimeout(url.toString())
  if (!res.ok) throw new Error(`초단기실황 HTTP ${res.status}`)
  const json = (await res.json()) as KmaResponse
  if (json.response.header.resultCode !== '00') {
    throw new Error(`초단기실황 API 오류: ${json.response.header.resultMsg}`)
  }

  const map = new Map<string, string>()
  for (const item of json.response.body.items?.item ?? []) {
    if (item.obsrValue != null && item.obsrValue !== '' && item.obsrValue !== '-') {
      map.set(item.category, item.obsrValue)
    }
  }
  return map
}

/**
 * KMA 응답 문자열을 number로 파싱. 결측(undefined/''/'-'/NaN)이면 null.
 * 결측을 0으로 캐스팅하면 러닝 지수 계산에서 "영하 극한 추위"(temperature=0 →
 * temperaturePenalty=100 + applyExtremeCap이 cap 30 적용) 또는 "극건조"(humidity=0)
 * 로 잘못 해석되어 점수가 왜곡되므로 반드시 null로 전파한다.
 */
function parseKmaNumber(v: string | undefined): number | null {
  if (v == null || v === '' || v === '-') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

/** 단기예보 — 시간별 기온·습도·강수확률·풍속 */
async function fetchVilageFcst(nx: number, ny: number): Promise<Map<string, Map<string, string>>> {
  const { baseDate, baseTime } = getVilageFcstBaseTime()
  const url = new URL(`${BASE_URL}/getVilageFcst`)
  url.searchParams.set('authKey', API_KEY)
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('numOfRows', '1000')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('base_date', baseDate)
  url.searchParams.set('base_time', baseTime)
  url.searchParams.set('nx', String(nx))
  url.searchParams.set('ny', String(ny))

  // 5초 응답 목표에 맞춰 기본 타임아웃을 그대로 사용한다.
  // 페이로드가 크지만 KMA API는 평소 1~2초 내 응답. 4초 초과하면 타임아웃 처리 후
  // 대기질만으로 점수를 계산하는 쪽이 사용자 대기보다 낫다.
  const res = await fetchWithTimeout(url.toString())
  if (!res.ok) throw new Error(`단기예보 HTTP ${res.status}`)
  const json = (await res.json()) as KmaResponse
  if (json.response.header.resultCode !== '00') {
    throw new Error(`단기예보 API 오류: ${json.response.header.resultMsg}`)
  }

  // Map<"YYYYMMDD_HHmm", Map<category, value>>
  const hourly = new Map<string, Map<string, string>>()
  for (const item of json.response.body.items?.item ?? []) {
    if (!item.fcstDate || !item.fcstTime || item.fcstValue == null) continue
    const key = `${item.fcstDate}_${item.fcstTime}`
    if (!hourly.has(key)) hourly.set(key, new Map())
    hourly.get(key)!.set(item.category, item.fcstValue)
  }
  return hourly
}

// ── 공개 함수 ────────────────────────────────────────────────

/**
 * 현재 날씨 조회 (초단기실황).
 *
 * 기온(T1H) 또는 습도(REH) 중 하나라도 결측이면 `WeatherDataUnavailableError`를
 * throw해 호출자(airKoreaClient)가 weather=null로 처리하게 한다.
 * (기존에는 0으로 폴백되어 러닝 지수가 "극한 추위/극건조"로 잘못 계산되는 버그가 있었다.)
 *
 * 풍속(WSD)은 결측 시 0으로 취급(페널티 0 → 영향 없음).
 */
export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherMetrics> {
  const { nx, ny } = latLngToGrid(lat, lng)
  const data = await fetchUltraSrtNcst(nx, ny)

  const temperature = parseKmaNumber(data.get('T1H'))
  const humidity = parseKmaNumber(data.get('REH'))
  if (temperature == null || humidity == null) {
    throw new WeatherDataUnavailableError(
      `초단기실황 필수값 결측 (T1H=${data.get('T1H') ?? 'null'}, REH=${data.get('REH') ?? 'null'})`,
    )
  }

  return {
    temperature,
    humidity,
    windSpeed: parseKmaNumber(data.get('WSD')) ?? 0,
    precipitation: parsePrecipitationType(data.get('PTY') ?? '0'),
  }
}

/** 기상 데이터 결측 표시용 에러. 호출자가 taxonomy로 구분해 처리할 수 있게 별도 클래스로 둔다. */
export class WeatherDataUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WeatherDataUnavailableError'
  }
}

export interface HourlyWeatherMap {
  /** 오늘 hour(0~23) → WeatherMetrics */
  today: Map<number, WeatherMetrics>
  /** 내일 hour(0~23) → WeatherMetrics */
  tomorrow: Map<number, WeatherMetrics>
}

/**
 * 시간별 날씨 예보 (단기예보).
 * 단기예보 API는 base_time 이후 최대 3일치를 반환하므로 오늘 + 내일을 모두 담아 리턴한다.
 * (호출 측이 차트의 isNextDay 바에 내일 데이터를 매핑해 사용)
 */
export async function getHourlyWeather(lat: number, lng: number): Promise<HourlyWeatherMap> {
  const { nx, ny } = latLngToGrid(lat, lng)
  const fcst = await fetchVilageFcst(nx, ny)
  const todayStr = formatDate(nowKST())
  const tomorrowDate = nowKST()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = formatDate(tomorrowDate)

  const today = new Map<number, WeatherMetrics>()
  const tomorrow = new Map<number, WeatherMetrics>()

  for (const [key, cats] of fcst) {
    const [date, time] = key.split('_')
    const target = date === todayStr ? today : date === tomorrowStr ? tomorrow : null
    if (!target) continue
    const hour = parseInt(time.slice(0, 2), 10)

    const temperature = parseKmaNumber(cats.get('TMP') ?? cats.get('T1H'))
    const humidity = parseKmaNumber(cats.get('REH'))
    // 기온·습도 중 하나라도 결측이면 이 시각은 맵에 넣지 않는다.
    // → 호출부(buildAirQualityData)에서 `wx ?? currentWx` 폴백이 자연스럽게 동작.
    //   (0으로 캐스팅하면 러닝 지수 계산이 왜곡되기 때문)
    if (temperature == null || humidity == null) continue

    target.set(hour, {
      temperature,
      humidity,
      windSpeed: parseKmaNumber(cats.get('WSD')) ?? 0,
      precipitation: parsePrecipitationType(cats.get('PTY') ?? '0'),
    })
  }
  return { today, tomorrow }
}

function parsePrecipitationType(pty: string): 'none' | 'rain' | 'snow' | 'sleet' {
  switch (pty) {
    case '1': case '4': return 'rain'   // 비, 소나기
    case '2': return 'sleet'            // 비/눈
    case '3': return 'snow'             // 눈
    default: return 'none'
  }
}
