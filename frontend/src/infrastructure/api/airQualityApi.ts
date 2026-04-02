/**
 * 백엔드 API 클라이언트
 * mockAirQualityApi.ts와 동일한 인터페이스를 제공하여 훅에서 교체 가능
 */
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import type { Region } from '../../domain/entities/region.types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
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

/** regionId 기반 대기질 + 달리기 지수 조회 */
export async function getAirQualityByRegion(regionId: string): Promise<AirQualityData> {
  const data = await apiFetch<AirQualityData & { updatedAt: string }>(
    `/api/v1/air-quality/${encodeURIComponent(regionId)}`
  )
  // JSON 역직렬화 시 Date → string 변환되므로 복원
  return { ...data, updatedAt: new Date(data.updatedAt) }
}
