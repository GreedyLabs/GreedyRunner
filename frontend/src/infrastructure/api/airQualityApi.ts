/**
 * 백엔드 API 클라이언트 — 프론트엔드의 유일한 대기질 데이터 소스.
 * 러닝 지수는 백엔드에서 계산되어 그대로 렌더링된다 (프론트엔드에 알고리즘 사본 없음).
 */
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import type { Region } from '../../domain/entities/region.types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * 요청 타임아웃.
 *
 * 백엔드의 상류 예산은 최악 12초(지역 검색)이므로 그보다 여유를 둔다. 예전에는 타임아웃이
 * 아예 없어서, 백엔드나 그 앞단이 응답을 멈추면 스피너가 영구히 돌았다 — 사용자에게는
 * "가끔 아무 일도 일어나지 않는" 증상으로 보이고, 에러 화면조차 나오지 않았다.
 */
const REQUEST_TIMEOUT_MS = 15_000

/** 취소·타임아웃을 호출부의 실패와 구분하기 위한 에러. */
export class RequestCancelledError extends Error {
  constructor() {
    super('요청이 취소되었습니다.')
    this.name = 'RequestCancelledError'
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super('서버 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.')
    this.name = 'RequestTimeoutError'
  }
}

/**
 * API 서버에 연결 자체가 되지 않는 경우.
 *
 * fetch는 서버가 없거나, 주소가 틀렸거나, CORS에 막혔을 때 모두 `TypeError: Failed to fetch`를
 * 던진다. 그대로 화면에 띄우면 "Failed to fetch" 한 줄만 남아 사용자도 개발자도 원인을
 * 좁힐 수 없다 — 실제로 VITE_API_BASE_URL이 다른 서비스의 포트를 가리키는 설정 오류를
 * 이 문구만으로는 구분할 수 없었다. 어디로 호출했는지와 확인할 지점을 함께 적는다.
 */
export class ApiUnreachableError extends Error {
  constructor(readonly target: string) {
    super(
      target
        ? `API 서버(${target})에 연결할 수 없습니다. 서버가 실행 중인지, VITE_API_BASE_URL이 올바른지 확인해 주세요.`
        : 'API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.'
    )
    this.name = 'ApiUnreachableError'
  }
}

interface FetchOptions {
  /** 호출부가 넘기는 취소 신호 (지역을 다시 고르거나 컴포넌트가 언마운트될 때). */
  signal?: AbortSignal
}

async function apiFetch<T>(path: string, { signal }: FetchOptions = {}): Promise<T> {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)

  // 호출부의 취소와 타임아웃을 하나의 신호로 합친다.
  const onAbort = () => timeoutController.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: timeoutController.signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // 호출부가 취소한 것과 타임아웃을 구분한다 — 전자는 화면에 에러를 띄우면 안 된다.
      throw signal?.aborted ? new RequestCancelledError() : new RequestTimeoutError()
    }
    // fetch는 서버 미기동·주소 오류·CORS 차단을 모두 TypeError로 던진다.
    // 응답을 받아 상태 코드를 읽은 경우(위의 !res.ok)는 여기로 오지 않는다.
    if (err instanceof TypeError) {
      throw new ApiUnreachableError(API_BASE)
    }
    throw err
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** 읍면동명으로 지역 검색 */
export async function searchRegions(query: string, options?: FetchOptions): Promise<Region[]> {
  if (!query.trim()) return []
  const data = await apiFetch<{ results: Region[] }>(
    `/api/v1/air-quality/search?q=${encodeURIComponent(query)}`,
    options
  )
  return data.results
}

/**
 * 브라우저 위치(lat/lng) → 가장 가까운 측정소 Region 반환
 * 반환된 region.id 로 getAirQualityByRegion()을 호출하면 대기질 데이터를 가져옵니다.
 */
export async function getRegionByCoords(lat: number, lng: number, options?: FetchOptions): Promise<Region> {
  return apiFetch<Region>(`/api/v1/air-quality/by-coords?lat=${lat}&lng=${lng}`, options)
}

/** regionId 기반 대기질 + 기상 + 달리기 지수 조회 */
export async function getAirQualityByRegion(
  regionId: string,
  lat?: number,
  lng?: number,
  options?: FetchOptions
): Promise<AirQualityData> {
  let path = `/api/v1/air-quality/${encodeURIComponent(regionId)}`
  // 좌표가 있으면 기상 데이터도 함께 요청. 백엔드는 둘 중 하나만 오면 400으로 거부하므로
  // 반드시 쌍으로 보낸다.
  if (lat != null && lng != null) {
    path += `?lat=${lat}&lng=${lng}`
  }
  const data = await apiFetch<AirQualityData & { updatedAt: string }>(path, options)
  return { ...data, updatedAt: new Date(data.updatedAt) }
}

/** 방문자 통계 — 실패해도 화면에 영향이 없어야 하므로 호출부가 조용히 무시한다. */
export async function getVisitorStats(options?: FetchOptions): Promise<{ today: number; total: number }> {
  return apiFetch<{ today: number; total: number }>('/api/v1/stats/visitors', options)
}
