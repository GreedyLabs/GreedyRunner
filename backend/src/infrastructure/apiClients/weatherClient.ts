/**
 * 기상청 단기예보 API 클라이언트
 *
 * 초단기실황: 현재 기온·습도·풍속·강수형태
 * 단기예보:   3시간 간격 예보 (최대 3일치)
 *
 * 기상청 격자 좌표 (nx, ny) 변환 포함
 */

import type { WeatherMetrics } from '../../domain/entities/weather'
import { assertOpenApiOk, fetchOpenApi, UpstreamApiError } from './openApiResponse'

const API_KEY = process.env.KMA_API_KEY ?? ''
const BASE_URL = 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0'

// 5초 이내 응답을 목표로 기상청 API 타임아웃을 4초로 제한.
// 타임아웃 시 호출부(getAirQuality)는 weatherStatus='timeout'으로 표시하고
// 대기질만으로 러닝 지수를 계산한다.
// 재시도는 airKorea 클라이언트와 동일하게 1회 — 예전에는 여기만 재시도가 없어, 같은 상류 지연에
// 대기질은 견디고 날씨만 사라져 점수가 수십 점 튀는 비대칭이 있었다.
const WEATHER_TIMEOUT_MS = 4000

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

/**
 * 초단기실황 기준 시각 — 매시 정각 측정, 약 40분 후 제공.
 *
 * `back`은 몇 발표분 이전을 볼지 지정한다. 발표 지연은 항상 정확히 40분이 아니어서
 * 매시 40~42분쯤에는 계산된 시각의 자료가 아직 없어 NODATA가 돌아온다. 그 순간 접속하면
 * 날씨가 통째로 빠지고 러닝 지수가 대기질만으로 계산돼 점수가 튀었다 — 호출부가 `back`을
 * 1로 올려 한 시간 전 발표분으로 재시도하도록 폴백 경로를 만든다.
 */
function getUltraSrtBaseTime(back = 0): { baseDate: string; baseTime: string } {
  const kst = nowKST()
  // 현재 분이 40분 미만이면 1시간 전 데이터 사용
  if (kst.getMinutes() < 40) {
    kst.setHours(kst.getHours() - 1)
  }
  kst.setHours(kst.getHours() - back)
  return {
    baseDate: formatDate(kst),
    baseTime: `${String(kst.getHours()).padStart(2, '0')}00`,
  }
}

const VILAGE_BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

/**
 * 단기예보 기준 시각 — 02, 05, 08, 11, 14, 17, 20, 23시 발표.
 *
 * `back`은 몇 발표분 이전을 볼지 지정한다. 초단기실황과 같은 이유로, 발표 직후 몇 분간은
 * 아직 자료가 없어 NODATA가 돌아오므로 호출부가 이전 발표분으로 재시도할 수 있어야 한다.
 */
function getVilageFcstBaseTime(back = 0): { baseDate: string; baseTime: string } {
  const kst = nowKST()
  const currentHour = kst.getHours()
  const currentMin = kst.getMinutes()

  // 발표 후 약 10분 뒤 제공이므로 10분 미만이면 이전 발표 시각 사용.
  // 가장 최근 발표분부터 과거로 세어 back번째를 고른다 — 자정을 넘어가면 날짜도 함께 내린다.
  let index = -1
  for (let i = 0; i < VILAGE_BASE_HOURS.length; i++) {
    const h = VILAGE_BASE_HOURS[i]
    if (currentHour > h || (currentHour === h && currentMin >= 10)) index = i
  }

  let stepsBack = back
  while (index - stepsBack < 0) {
    // 오늘의 발표분을 다 소진했으면 전날 마지막 발표(23시)부터 이어 센다.
    kst.setDate(kst.getDate() - 1)
    stepsBack -= index + 1
    index = VILAGE_BASE_HOURS.length - 1
  }

  return {
    baseDate: formatDate(kst),
    baseTime: `${String(VILAGE_BASE_HOURS[index - stepsBack]).padStart(2, '0')}00`,
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// ── API 호출 ─────────────────────────────────────────────────

/** airKorea 쪽과 같은 이유로 모든 단계를 옵셔널로 둔다 (openApiResponse.ts 참고). */
interface KmaResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: {
      items?: {
        item?: Array<{
          category: string
          obsrValue?: string   // 초단기실황
          fcstValue?: string   // 단기예보
          fcstDate?: string
          fcstTime?: string
        }>
      }
      totalCount?: number
    }
  }
}

/**
 * 발표 지연 구간을 넘기기 위해 이전 발표분까지 한 번 더 시도한다.
 * NODATA는 "요청은 옳지만 그 시각 자료가 아직 없다"는 뜻이므로, 재시도할 대상은 같은 시각이
 * 아니라 **한 발표분 이전**이다. 그래서 openApiResponse의 재시도(같은 URL 재요청)가 아니라
 * 여기서 URL을 바꿔 다시 부른다.
 */
async function fetchWithIssuanceFallback<T>(
  label: string,
  build: (back: number) => string,
  timeoutMs = WEATHER_TIMEOUT_MS,
): Promise<T> {
  for (let back = 0; back <= 1; back++) {
    try {
      const json = await fetchOpenApi<T>(build(back), { endpoint: label, timeoutMs })
      assertOpenApiOk(json, label)
      return json
    } catch (err) {
      if (back === 0 && err instanceof UpstreamApiError && err.kind === 'nodata') {
        console.warn(`[${label}] 해당 발표 시각 자료 없음 — 이전 발표분으로 재시도`)
        continue
      }
      throw err
    }
  }
  // 위 루프는 반드시 반환하거나 throw한다. 타입 좁히기를 위한 도달 불가 분기.
  throw new UpstreamApiError('nodata', label, '이전 발표분까지 자료 없음')
}

/** 초단기실황 — 현재 기온·습도·풍속·강수형태 */
async function fetchUltraSrtNcst(nx: number, ny: number): Promise<Map<string, string>> {
  const json = await fetchWithIssuanceFallback<KmaResponse>('초단기실황', (back) => {
    const { baseDate, baseTime } = getUltraSrtBaseTime(back)
    const url = new URL(`${BASE_URL}/getUltraSrtNcst`)
    url.searchParams.set('authKey', API_KEY)
    url.searchParams.set('dataType', 'JSON')
    url.searchParams.set('numOfRows', '10')
    url.searchParams.set('pageNo', '1')
    url.searchParams.set('base_date', baseDate)
    url.searchParams.set('base_time', baseTime)
    url.searchParams.set('nx', String(nx))
    url.searchParams.set('ny', String(ny))
    return url.toString()
  })

  const map = new Map<string, string>()
  for (const item of json.response?.body?.items?.item ?? []) {
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
  // 5초 응답 목표에 맞춰 기본 타임아웃을 그대로 사용한다.
  // 페이로드가 크지만 KMA API는 평소 1~2초 내 응답. 4초 초과하면 타임아웃 처리 후
  // 대기질만으로 점수를 계산하는 쪽이 사용자 대기보다 낫다.
  const json = await fetchWithIssuanceFallback<KmaResponse>('단기예보', (back) => {
    const { baseDate, baseTime } = getVilageFcstBaseTime(back)
    const url = new URL(`${BASE_URL}/getVilageFcst`)
    url.searchParams.set('authKey', API_KEY)
    url.searchParams.set('dataType', 'JSON')
    // 오늘+내일 전 항목을 담기 위한 크기. base_time에 따라 상류가 이보다 많이 돌려줄 수 있어
    // totalCount로 잘림을 감지한다 — 잘리면 뒤쪽 시각의 WSD·PTY가 통째로 빠져, 그 시간대만
    // 풍속 0·강수 없음으로 계산되는 조용한 왜곡이 생긴다.
    url.searchParams.set('numOfRows', '1000')
    url.searchParams.set('pageNo', '1')
    url.searchParams.set('base_date', baseDate)
    url.searchParams.set('base_time', baseTime)
    url.searchParams.set('nx', String(nx))
    url.searchParams.set('ny', String(ny))
    return url.toString()
  })

  const totalCount = json.response?.body?.totalCount
  const returned = json.response?.body?.items?.item?.length ?? 0
  if (totalCount != null && totalCount > returned) {
    console.warn(`[단기예보] ${totalCount}건 중 ${returned}건만 반환됨 — 뒤쪽 시각의 항목이 누락된다`)
  }

  // Map<"YYYYMMDD_HHmm", Map<category, value>>
  const hourly = new Map<string, Map<string, string>>()
  for (const item of json.response?.body?.items?.item ?? []) {
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

/**
 * KST 날짜 키("YYYYMMDD") → 그 날의 hour(0~23) → WeatherMetrics.
 *
 * 예전에는 `{ today, tomorrow }` 두 개의 맵이었다. 그런데 "오늘"의 기준이 이 모듈의
 * 서버 벽시계인 반면, 호출부(buildAirQualityData)의 기준 시각은 에어코리아 dataTime이다.
 * 에어코리아는 30~60분 지연 발표하므로 자정 직후에는 두 기준의 날짜가 하루 어긋나고,
 * 그 구간에 접속하면 24개 예보 바 전체가 하루 뒤 날씨와 짝지어졌다.
 * → 날짜를 명시적 키로 돌려주고 호출부가 자기 기준 시각으로 날짜를 계산해 조회하게 한다.
 */
export type HourlyWeatherMap = Map<string, Map<number, WeatherMetrics>>

/** KST 기준 "YYYYMMDD" 키. 호출부가 같은 규칙으로 조회하도록 함께 내보낸다. */
export function kstDateKey(instant: Date): string {
  const kst = new Date(instant.getTime() + (instant.getTimezoneOffset() + 540) * 60_000)
  return formatDate(kst)
}

/**
 * 시간별 날씨 예보 (단기예보).
 * 단기예보 API는 base_time 이후 최대 3일치를 반환하므로 받은 날짜를 그대로 모두 담아 리턴한다.
 * (호출 측이 각 예보 바의 KST 날짜로 조회)
 */
export async function getHourlyWeather(lat: number, lng: number): Promise<HourlyWeatherMap> {
  const { nx, ny } = latLngToGrid(lat, lng)
  const fcst = await fetchVilageFcst(nx, ny)
  const byDate: HourlyWeatherMap = new Map()

  for (const [key, cats] of fcst) {
    const [date, time] = key.split('_')
    const hour = parseInt(time.slice(0, 2), 10)

    const temperature = parseKmaNumber(cats.get('TMP') ?? cats.get('T1H'))
    const humidity = parseKmaNumber(cats.get('REH'))
    // 기온·습도 중 하나라도 결측이면 이 시각은 맵에 넣지 않는다.
    // → 호출부(buildAirQualityData)에서 `wx ?? currentWx` 폴백이 자연스럽게 동작.
    //   (0으로 캐스팅하면 러닝 지수 계산이 왜곡되기 때문)
    if (temperature == null || humidity == null) continue

    let target = byDate.get(date)
    if (!target) {
      target = new Map<number, WeatherMetrics>()
      byDate.set(date, target)
    }
    target.set(hour, {
      temperature,
      humidity,
      windSpeed: parseKmaNumber(cats.get('WSD')) ?? 0,
      precipitation: parsePrecipitationType(cats.get('PTY') ?? '0'),
    })
  }
  return byDate
}

/**
 * KMA 강수형태(PTY) 코드 → 내부 enum 매핑.
 *
 * 초단기실황: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기 (+5=빗방울, 6=빗방울눈날림, 7=눈날림)
 * 단기예보:   0=없음, 1=비, 2=비/눈, 3=눈, 5=빗방울, 6=빗방울눈날림, 7=눈날림
 *
 * 기존에는 5/6/7을 default로 흘려 'none'으로 처리되어, 단기예보에서 빗방울·눈날림
 * 시간대가 강수 페널티/cap 없이 점수가 부풀려지는 버그가 있었다.
 * → 빗방울(5)=rain, 빗방울눈날림(6)=sleet, 눈날림(7)=snow 로 매핑.
 */
function parsePrecipitationType(pty: string): 'none' | 'rain' | 'snow' | 'sleet' {
  switch (pty) {
    case '1': case '4': case '5': return 'rain'   // 비, 소나기, 빗방울
    case '2': case '6': return 'sleet'            // 비/눈, 빗방울눈날림
    case '3': case '7': return 'snow'             // 눈, 눈날림
    default: return 'none'
  }
}
