/**
 * 백엔드 API 클라이언트 — 프론트엔드의 유일한 대기질 데이터 소스.
 * 러닝 지수는 백엔드에서 계산되어 그대로 렌더링된다 (프론트엔드에 알고리즘 사본 없음).
 */
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import type { Region } from '../../domain/entities/region.types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** 읍면동명으로 지역 검색 */
export async function searchRegions(query: string): Promise<Region[]> {
  if (!query.trim()) return []
  const data = await apiFetch<{ results: Region[] }>(
    `/api/v1/air-quality/search?q=${encodeURIComponent(query)}`
  )
  return data.results
}

/**
 * 브라우저 위치(lat/lng) → 가장 가까운 측정소 Region 반환
 * 반환된 region.id 로 getAirQualityByRegion()을 호출하면 대기질 데이터를 가져옵니다.
 */
export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  return apiFetch<Region>(
    `/api/v1/air-quality/by-coords?lat=${lat}&lng=${lng}`
  )
}

/** regionId 기반 대기질 + 기상 + 달리기 지수 조회 */
export async function getAirQualityByRegion(
  regionId: string,
  lat?: number,
  lng?: number
): Promise<AirQualityData> {
  let path = `/api/v1/air-quality/${encodeURIComponent(regionId)}`
  // 좌표가 있으면 기상 데이터도 함께 요청
  if (lat != null && lng != null) {
    path += `?lat=${lat}&lng=${lng}`
  }
  const data = await apiFetch<AirQualityData & { updatedAt: string }>(path)
  return { ...data, updatedAt: new Date(data.updatedAt) }
}
