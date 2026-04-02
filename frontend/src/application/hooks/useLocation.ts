import { useState, useCallback } from 'react'
import type { Region } from '../../domain/entities/region.types'
import { getRegionByCoords } from '../../infrastructure/api/airQualityApi'

interface UseLocationState {
  region: Region | null
  isLocating: boolean
  error: string | null
}

interface UseLocationReturn extends UseLocationState {
  locateMe: () => void
}

export function useLocation(): UseLocationReturn {
  const [state, setState] = useState<UseLocationState>({
    region: null,
    isLocating: false,
    error: null,
  })

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: '이 브라우저는 위치 조회를 지원하지 않습니다.' }))
      return
    }

    setState(prev => ({ ...prev, isLocating: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          // lat/lng → 백엔드에서 TM 변환 후 가장 가까운 측정소 반환
          const region = await getRegionByCoords(coords.latitude, coords.longitude)
          setState({ region, isLocating: false, error: null })
        } catch {
          setState(prev => ({
            ...prev,
            isLocating: false,
            error: '위치 기반 측정소 조회에 실패했습니다.',
          }))
        }
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되었습니다. 직접 지역을 검색해 주세요.'
            : '현재 위치를 가져올 수 없습니다.'
        setState(prev => ({ ...prev, isLocating: false, error: message }))
      },
      { timeout: 10000 }
    )
  }, [])

  return { ...state, locateMe }
}
