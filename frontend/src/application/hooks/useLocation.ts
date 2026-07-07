import { useState, useCallback, useEffect } from 'react'
import type { Region } from '../../domain/entities/region.types'
import { getRegionByCoords } from '../../infrastructure/api/airQualityApi'

const CACHE_KEY = 'gr_location'
const CACHE_TTL = 60 * 60 * 1000 // 1시간 — 위치는 자주 안 바뀌므로 TTL 여유 있게

/**
 * 위치 확인 실패 시 폴백 지역 — 서울 도심(시청 인근).
 * `tm:{tmX}:{tmY}` 형식이라 백엔드가 근접 측정소를 자동으로 찾아준다(특정 측정소명에
 * 의존하지 않아 안전). 위치 권한 거부·GPS 실패·측정소 조회 실패 어느 경우든 이 지역으로
 * 폴백해 점수·팁이 항상 나오게 하고, 화면이 비어버리는 것을 막는다.
 * — 폴백은 캐시하지 않으므로 다음 접속 때 실제 위치를 다시 시도한다.
 */
const FALLBACK_REGION: Region = {
  id: 'tm:198280:451587',
  name: '서울 도심(기본)',
  shortName: '서울 도심',
  city: '서울',
  lat: 37.5665,
  lng: 126.9784,
}

interface CachedLocation {
  region: Region
  timestamp: number
}

function getCached(): Region | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedLocation = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.region
  } catch {
    return null
  }
}

function setCache(region: Region) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }))
}

interface UseLocationState {
  region: Region | null
  isLocating: boolean
  error: string | null
}

interface UseLocationReturn extends UseLocationState {
  locateMe: () => void
  selectRegion: (region: Region) => void
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

    // 위치를 확정하지 못하면 폴백 지역으로 대체해 화면이 비지 않게 한다.
    // 캐시는 남기지 않아 다음 접속 때 실제 위치를 다시 시도한다.
    const applyFallback = (message: string) =>
      setState({ region: FALLBACK_REGION, isLocating: false, error: message })

    if (!navigator.geolocation) {
      applyFallback('이 브라우저는 위치 조회를 지원하지 않아 서울 도심 기준으로 표시 중이에요. 지역을 직접 검색할 수 있어요.')
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
          applyFallback('측정소 조회에 실패해 서울 도심 기준으로 표시 중이에요. 지역을 직접 검색할 수 있어요.')
        }
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되어 서울 도심 기준으로 표시 중이에요. 지역을 직접 검색할 수 있어요.'
            : '현재 위치를 가져오지 못해 서울 도심 기준으로 표시 중이에요. 지역을 직접 검색할 수 있어요.'
        applyFallback(message)
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  // 마운트 시 자동으로 위치 감지 (캐시 우선)
  useEffect(() => {
    locateMe(false)
  }, [locateMe])

  // "현재 위치" 버튼용 — 캐시 무시하고 새로 조회
  const locateMeFresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    locateMe(true)
  }, [locateMe])

  // 사용자가 검색으로 지역을 직접 고르면 활성 지역을 그 지역으로 바꾸고 위치 안내를 지운다.
  // (폴백 안내가 남아 있는 상태에서 검색으로 넘어가도 안내가 사라지도록)
  const selectRegion = useCallback((region: Region) => {
    setState({ region, isLocating: false, error: null })
  }, [])

  return { ...state, locateMe: locateMeFresh, selectRegion }
}
