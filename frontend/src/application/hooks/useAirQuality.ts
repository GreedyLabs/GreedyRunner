import { useState, useCallback } from 'react'
import type { AirQualityData } from '../../domain/entities/airQuality.types'
import { getAirQualityByRegion } from '../../infrastructure/api/airQualityApi'

interface UseAirQualityState {
  data: AirQualityData | null
  isLoading: boolean
  error: string | null
}

interface UseAirQualityReturn extends UseAirQualityState {
  fetchByRegion: (regionId: string) => Promise<void>
  reset: () => void
}

export function useAirQuality(): UseAirQualityReturn {
  const [state, setState] = useState<UseAirQualityState>({
    data: null,
    isLoading: false,
    error: null,
  })

  const fetchByRegion = useCallback(async (regionId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await getAirQualityByRegion(regionId)
      setState({ data, isLoading: false, error: null })
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: '대기질 정보를 불러오는 데 실패했습니다.',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null })
  }, [])

  return { ...state, fetchByRegion, reset }
}
