import { useState, useCallback, useRef } from 'react'
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import { getAirQualityByRegion } from '../../infrastructure/api/airQualityApi'

const CACHE_TTL = 5 * 60 * 1000 // 5분

interface CacheEntry {
  data: AirQualityData
  expiresAt: number
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
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const fetchByRegion = useCallback(async (regionId: string, lat?: number, lng?: number) => {
    const cacheKey = `${regionId}:${lat ?? ''}:${lng ?? ''}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      setState({ data: cached.data, isLoading: false, error: null })
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await getAirQualityByRegion(regionId, lat, lng)
      cacheRef.current.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL })
      setState({ data, isLoading: false, error: null })
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : '대기질 정보를 불러오는 데 실패했습니다.',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null })
  }, [])

  return { ...state, fetchByRegion, reset }
}
