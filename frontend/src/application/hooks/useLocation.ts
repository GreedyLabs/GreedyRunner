import { useState, useCallback, useEffect } from 'react'
import type { Region } from '../../domain/entities/region.types'
import { getRegionByCoords } from '../../infrastructure/api/airQualityApi'

const CACHE_KEY = 'gr_location'
const CACHE_TTL = 30 * 60 * 1000 // 30분

interface CachedLocation {
  region: Region
  timestamp: number
}

function getCached(): Region | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedLocation = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.region
  } catch {
    return null
  }
}

function setCache(region: Region) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }))
}

interface UseLocationState {
  region: Region | null
  isLocating: boolean
  error: string | null
}

interface UseLocationReturn extends UseLocationState {
  locateMe: () => void
}

export function useLocation(): UseLocationReturn {
  const [state, setState] = useState<UseLocationState>(() => {
    const cached = getCached()
    return {
      region: cached,
      isLocating: false,
      error: null,
    }
  })

  const locateMe = useCallback((skipCache = false) => {
    if (!skipCache) {
      const cached = getCached()
      if (cached) {
        setState({ region: cached, isLocating: false, error: null })
        return
      }
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: '이 브라우저는 위치 조회를 지원하지 않습니다.' }))
      return
    }

    setState(prev => ({ ...prev, isLocating: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const region = await getRegionByCoords(coords.latitude, coords.longitude)
          setCache(region)
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

  // 마운트 시 자동으로 위치 감지 (캐시 우선)
  useEffect(() => {
    locateMe(false)
  }, [locateMe])

  // "현재 위치" 버튼용 — 캐시 무시하고 새로 조회
  const locateMeFresh = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY)
    locateMe(true)
  }, [locateMe])

  return { ...state, locateMe: locateMeFresh }
}
