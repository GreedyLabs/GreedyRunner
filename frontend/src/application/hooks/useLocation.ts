import { useState, useCallback, useEffect, useRef } from 'react'
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

/**
 * 백엔드가 이해하는 regionId 형식인지 확인한다.
 *
 * 저장된 지역은 최대 1시간 재사용되는데, 형식이 바뀌면(예전 mock 클라이언트의
 * `seoul-gangnam` 같은 자체 네임스페이스) 그 1시간 동안 모든 조회가 실패했다.
 * 읽는 시점에 걸러 버리면 다음 조회에서 곧바로 위치를 다시 잡는다.
 */
function isSupportedRegionId(id: unknown): boolean {
  return typeof id === 'string' && /^(tm:-?\d+:-?\d+|station:.+)$/.test(id)
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
    if (!isSupportedRegionId(cached.region?.id)) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.region
  } catch {
    // 사이트 데이터가 차단된 브라우저·시크릿 창에서는 접근 자체가 throw한다.
    return null
  }
}

function setCache(region: Region) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }))
  } catch {
    // 저장 실패는 기능 실패가 아니다 — 다음 접속 때 위치를 다시 잡으면 된다.
    // 예전에는 여기서 throw가 나면 바로 아래 setState까지 건너뛰어, 조회에 성공했는데도
    // 폴백 안내가 표시됐다.
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // 무시 — 읽기 쪽에서 TTL·형식 검사로 다시 걸러진다.
  }
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
  // 캐시는 여기서 한 번만 읽는다. 읽을 때마다 새 객체가 나오므로, 마운트 이펙트에서 다시
  // 읽어 setState하면 region의 참조가 바뀌어 이를 의존성으로 쓰는 App의 조회 이펙트가
  // 한 번 더 실행됐다 — 매 로드마다 같은 대기질 요청이 두 번 나갔다.
  const [state, setState] = useState<UseLocationState>(() => ({
    region: getCached(),
    isLocating: false,
    error: null,
  }))

  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const locate = useCallback((skipCache: boolean) => {
    if (!skipCache && getCached()) {
      // 초기 state가 이미 캐시된 지역을 담고 있다. setState를 하지 않아 참조가 유지된다.
      return
    }

    // 위치를 확정하지 못하면 폴백 지역으로 대체해 화면이 비지 않게 한다.
    // 캐시는 남기지 않아 다음 접속 때 실제 위치를 다시 시도한다.
    const applyFallback = (message: string) => {
      if (!mountedRef.current) return
      setState({ region: FALLBACK_REGION, isLocating: false, error: message })
    }

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
          if (!mountedRef.current) return
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

  // 마운트 시 자동으로 위치 감지 (캐시된 지역이 있으면 그대로 사용)
  useEffect(() => {
    locate(false)
  }, [locate])

  // "현재 위치" 버튼용 — 캐시 무시하고 새로 조회
  const locateMe = useCallback(() => {
    clearCache()
    locate(true)
  }, [locate])

  // 사용자가 검색으로 지역을 직접 고르면 활성 지역을 그 지역으로 바꾸고 위치 안내를 지운다.
  // (폴백 안내가 남아 있는 상태에서 검색으로 넘어가도 안내가 사라지도록)
  const selectRegion = useCallback((region: Region) => {
    setState({ region, isLocating: false, error: null })
  }, [])

  return { ...state, locateMe, selectRegion }
}
