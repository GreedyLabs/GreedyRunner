import { useState, useCallback, useEffect, useRef } from 'react'
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import { getAirQualityByRegion, RequestCancelledError } from '../../infrastructure/api/airQualityApi'

const CACHE_TTL = 5 * 60 * 1000 // 5분
/** 상류가 불완전한 응답을 준 경우 — 1분 뒤 재시도할 수 있게 짧게 잡는다. */
const DEGRADED_TTL = 60_000
/** 캐시 상한. 키에 지역·좌표가 들어가므로 상한 없이 두면 세션이 길어질수록 늘어난다. */
const CACHE_MAX_ENTRIES = 50

interface CacheEntry {
  data: AirQualityData
  expiresAt: number
}

/**
 * 모듈 스코프 캐시.
 *
 * 예전에는 `useRef(new Map())`이어서 훅 인스턴스마다 캐시가 따로 생겼다. 훅을 쓰는
 * 컴포넌트가 하나뿐이라 지금은 증상이 없지만, 두 번째 사용처가 생기는 순간 같은 지역을
 * 각자 다시 받아 오고(상류 호출 한도를 두 배로 태운다) 두 화면의 값이 어긋난다.
 * 캐시는 지역별 데이터의 성질이므로 컴포넌트 트리 밖에 두는 것이 맞다.
 */
const cache = new Map<string, CacheEntry>()

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
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now()
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k)
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
  }
  // 대기질이든 날씨든 하나라도 정상이 아니면 짧게만 캐싱한다 (백엔드 라우트 캐시와 같은 규칙).
  const status = data.serviceStatus
  const degraded = !status || status.weather !== 'ok' || status.airKorea !== 'ok'
  cache.set(key, { data, expiresAt: Date.now() + (degraded ? DEGRADED_TTL : CACHE_TTL) })
}

interface UseAirQualityState {
  data: AirQualityData | null
  isLoading: boolean
  error: string | null
}

interface UseAirQualityReturn extends UseAirQualityState {
  fetchByRegion: (regionId: string, lat?: number, lng?: number) => Promise<void>
  reset: () => void
}

export function useAirQuality(): UseAirQualityReturn {
  const [state, setState] = useState<UseAirQualityState>({
    data: null,
    isLoading: false,
    error: null,
  })

  /**
   * 요청 순서 가드. 지역을 빠르게 두 번 고르면 두 요청이 겹치는데, 응답 시간이 요청마다
   * 달라 먼저 고른 지역의 응답이 나중에 도착하면 화면에는 방금 고른 지역 이름 아래
   * 다른 지역의 값이 남았다. 지역 검색과 같은 종류의 경쟁 상태다.
   */
  const latestRequestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // 언마운트 가드(mountedRef)를 두지 않는 이유는 useLocation의 같은 주석을 참고.
  // 요약: StrictMode의 mount → unmount → mount에서 영구히 false가 되어 응답을 버린다.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const fetchByRegion = useCallback(async (regionId: string, lat?: number, lng?: number) => {
    const cacheKey = `${regionId}:${lat ?? ''}:${lng ?? ''}`
    const cached = readCache(cacheKey)
    if (cached) {
      latestRequestRef.current++
      abortRef.current?.abort()
      setState({ data: cached, isLoading: false, error: null })
      return
    }

    const requestId = ++latestRequestRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await getAirQualityByRegion(regionId, lat, lng, { signal: controller.signal })
      if (requestId !== latestRequestRef.current) return
      writeCache(cacheKey, data)
      setState({ data, isLoading: false, error: null })
    } catch (err) {
      if (err instanceof RequestCancelledError) return
      if (requestId !== latestRequestRef.current) return
      // 실패 시 이전 지역의 데이터를 남기지 않는다. 예전에는 `...prev`로 data를 유지해서
      // 오류 배너와 (다른 지역의) 완성된 대시보드가 동시에 표시됐고, 사용자는 화면에 보이는
      // 점수가 어느 지역 것인지 알 수 없었다.
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : '대기질 정보를 불러오는 데 실패했습니다.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    latestRequestRef.current++
    abortRef.current?.abort()
    setState({ data: null, isLoading: false, error: null })
  }, [])

  return { ...state, fetchByRegion, reset }
}
