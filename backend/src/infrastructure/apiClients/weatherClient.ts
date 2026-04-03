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

/** 기상청 API 기준 시각 계산 — 초단기실황은 매시 정각 발표, 40분 후 제공 */
function getUltraSrtBaseTime(): { baseDate: string; baseTime: string } {
  const now = new Date()
  // 현재 분이 40분 미만이면 1시간 전 데이터 사용
  if (now.getMinutes() < 40) {
    now.setHours(now.getHours() - 1)
  }
  return {
    baseDate: formatDate(now),
    baseTime: `${String(now.getHours()).padStart(2, '0')}00`,
  }
}

/** 단기예보 기준 시각 — 02, 05, 08, 11, 14, 17, 20, 23시 */
function getVilageFcstBaseTime(): { baseDate: string; baseTime: string } {
  const now = new Date()
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23]
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()

  // 발표 후 약 10분 뒤 제공이므로 10분 미만이면 이전 발표 시각 사용
  let hour = baseHours[0]
  for (const h of baseHours) {
    if (currentHour > h || (currentHour === h && currentMin >= 10)) {
      hour = h
    }
  }
  // 현재 시간이 2시 이전이면 전날 23시 데이터
  if (currentHour < 2 || (currentHour === 2 && currentMin < 10)) {
    now.setDate(now.getDate() - 1)
    hour = 23
  }

  return {
    baseDate: formatDate(now),
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

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`초단기실황 HTTP ${res.status}`)
  const json = (await res.json()) as KmaResponse
  if (json.response.header.resultCode !== '00') {
    throw new Error(`초단기실황 API 오류: ${json.response.header.resultMsg}`)
  }

  const map = new Map<string, string>()
  for (const item of json.response.body.items?.item ?? []) {
    if (item.obsrValue != null) {
      map.set(item.category, item.obsrValue)
    }
  }
  return map
}

/** 단기예보 — 시간별 기온·습도·강수확률·풍속 */
async function fetchVilageFcst(nx: number, ny: number): Promise<Map<string, Map<string, string>>> {
  const { baseDate, baseTime } = getVilageFcstBaseTime()
  const url = new URL(`${BASE_URL}/getVilageFcst`)
  url.searchParams.set('authKey', API_KEY)
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('numOfRows', '300')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('base_date', baseDate)
  url.searchParams.set('base_time', baseTime)
  url.searchParams.set('nx', String(nx))
  url.searchParams.set('ny', String(ny))

  const res = await fetch(url.toString())
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
 * 현재 날씨 조회 (초단기실황)
 */
export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherMetrics> {
  const { nx, ny } = latLngToGrid(lat, lng)
  const data = await fetchUltraSrtNcst(nx, ny)

  return {
    temperature: parseFloat(data.get('T1H') ?? '0'),
    humidity: parseFloat(data.get('REH') ?? '0'),
    windSpeed: parseFloat(data.get('WSD') ?? '0'),
    precipitation: parsePrecipitationType(data.get('PTY') ?? '0'),
  }
}

/**
 * 24시간 시간별 날씨 예보 (단기예보)
 * Map<hour(0~23), WeatherMetrics>
 */
export async function getHourlyWeather(lat: number, lng: number): Promise<Map<number, WeatherMetrics>> {
  const { nx, ny } = latLngToGrid(lat, lng)
  const fcst = await fetchVilageFcst(nx, ny)
  const today = formatDate(new Date())

  const result = new Map<number, WeatherMetrics>()
  for (const [key, cats] of fcst) {
    const [date, time] = key.split('_')
    if (date !== today) continue
    const hour = parseInt(time.slice(0, 2), 10)

    result.set(hour, {
      temperature: parseFloat(cats.get('TMP') ?? cats.get('T1H') ?? '0'),
      humidity: parseFloat(cats.get('REH') ?? '0'),
      windSpeed: parseFloat(cats.get('WSD') ?? '0'),
      precipitation: parsePrecipitationType(cats.get('PTY') ?? '0'),
    })
  }
  return result
}

function parsePrecipitationType(pty: string): 'none' | 'rain' | 'snow' | 'sleet' {
  switch (pty) {
    case '1': case '4': return 'rain'   // 비, 소나기
    case '2': return 'sleet'            // 비/눈
    case '3': return 'snow'             // 눈
    default: return 'none'
  }
}
