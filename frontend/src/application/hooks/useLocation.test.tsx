/**
 * useLocation 훅 테스트.
 *
 * 이 파일이 존재하는 이유: `mountedRef`(언마운트 가드)를 cleanup에서만 false로 내리고
 * 재마운트 setup에서 true로 되돌리지 않는 코드가 머지됐고, 그 때문에 **개발 모드에서
 * 첫 화면이 통째로 비었다.** 순수 함수 테스트 156개가 전부 통과하는데도 못 잡았다 —
 * React 런타임(StrictMode의 mount → unmount → mount)에서만 드러나는 부류이기 때문이다.
 *
 * 아래 'StrictMode' 블록이 그 회귀를 직접 재현한다.
 */
import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from './useLocation'
import type { Region } from '../../domain/entities/region.types'

const STATION: Region = {
  id: 'station:강남대로',
  name: '강남대로 측정소',
  shortName: '강남대로',
  city: '서울특별시',
  lat: 37.4874,
  lng: 127.0471,
}

const { getRegionByCoords } = vi.hoisted(() => ({ getRegionByCoords: vi.fn() }))
vi.mock('../../infrastructure/api/airQualityApi', () => ({
  getRegionByCoords,
  // 훅이 import하는 다른 심볼이 없더라도 모듈 형태를 맞춰 둔다.
  RequestCancelledError: class RequestCancelledError extends Error {},
}))

/** 훅의 상태를 DOM으로 드러내는 최소 컴포넌트. */
function Probe() {
  const { region, isLocating, error } = useLocation()
  return (
    <div>
      <span data-testid="region">{region?.id ?? 'none'}</span>
      <span data-testid="locating">{String(isLocating)}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  )
}

/** geolocation을 성공/실패로 흉내낸다. */
function stubGeolocation(behavior: 'success' | 'denied' | 'absent', coords = { latitude: 37.4874, longitude: 127.0471 }) {
  if (behavior === 'absent') {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
    return
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
        if (behavior === 'success') {
          ok({ coords } as GeolocationPosition)
        } else {
          fail({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as unknown as GeolocationPositionError)
        }
      },
    },
  })
}

beforeEach(() => {
  localStorage.clear()
  getRegionByCoords.mockReset()
  getRegionByCoords.mockResolvedValue(STATION)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useLocation — StrictMode 재마운트 (회귀)', () => {
  // 이 테스트가 잡는 버그: cleanup에서 내린 언마운트 플래그가 재마운트에서 복구되지 않아
  // /by-coords 응답이 와도 setState가 건너뛰어지고 region이 영구히 null로 남는다.
  it('StrictMode에서 두 번 마운트되어도 조회 결과를 반영한다', async () => {
    stubGeolocation('success')

    render(
      <StrictMode>
        <Probe />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe(STATION.id)
    })
    expect(screen.getByTestId('error').textContent).toBe('')
    expect(screen.getByTestId('locating').textContent).toBe('false')
  })

  it('StrictMode가 아닌 환경에서도 동일하게 동작한다', async () => {
    stubGeolocation('success')
    render(<Probe />)
    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe(STATION.id)
    })
  })
})

describe('useLocation — 폴백', () => {
  it('위치 권한이 거부되면 서울 도심으로 폴백하고 안내를 남긴다', async () => {
    stubGeolocation('denied')
    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe('tm:198280:451587')
    })
    expect(screen.getByTestId('error').textContent).toContain('위치 권한이 거부')
  })

  it('geolocation을 지원하지 않는 브라우저도 폴백한다', async () => {
    stubGeolocation('absent')
    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe('tm:198280:451587')
    })
    expect(screen.getByTestId('error').textContent).toContain('지원하지 않아')
  })

  it('측정소 조회가 실패하면 폴백한다', async () => {
    stubGeolocation('success')
    getRegionByCoords.mockRejectedValue(new Error('upstream down'))
    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe('tm:198280:451587')
    })
    expect(screen.getByTestId('error').textContent).toContain('측정소 조회에 실패')
  })

  // 폴백은 캐시하지 않아야 한다 — 그러지 않으면 한 번 실패한 사용자가 최대 1시간 동안
  // 실제 위치를 다시 시도하지 못한다.
  it('폴백 지역은 캐시하지 않는다', async () => {
    stubGeolocation('denied')
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe('tm:198280:451587'))
    expect(localStorage.getItem('gr_location')).toBeNull()
  })
})

describe('useLocation — 캐시', () => {
  it('조회에 성공하면 지역을 캐시한다', async () => {
    stubGeolocation('success')
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe(STATION.id))

    const raw = localStorage.getItem('gr_location')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).region.id).toBe(STATION.id)
  })

  it('캐시가 있으면 geolocation과 API를 호출하지 않는다', async () => {
    localStorage.setItem('gr_location', JSON.stringify({ region: STATION, timestamp: Date.now() }))
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })

    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe(STATION.id))
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(getRegionByCoords).not.toHaveBeenCalled()
  })

  // 지원하지 않는 형식이 캐시에 남아 있으면 그 1시간 동안 모든 조회가 실패했다.
  it('지원하지 않는 regionId 형식은 버리고 위치를 다시 잡는다', async () => {
    localStorage.setItem(
      'gr_location',
      JSON.stringify({ region: { ...STATION, id: 'seoul-gangnam' }, timestamp: Date.now() })
    )
    stubGeolocation('success')

    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe(STATION.id))
    expect(getRegionByCoords).toHaveBeenCalled()
  })

  it('TTL이 지난 캐시는 버린다', async () => {
    localStorage.setItem(
      'gr_location',
      JSON.stringify({ region: STATION, timestamp: Date.now() - 2 * 60 * 60 * 1000 })
    )
    stubGeolocation('success')

    render(<Probe />)
    await waitFor(() => expect(getRegionByCoords).toHaveBeenCalled())
  })

  // 시크릿 창·사이트 데이터 차단 브라우저에서는 localStorage 접근 자체가 throw한다.
  it('localStorage가 throw해도 조회 결과를 반영한다', async () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    stubGeolocation('success')

    render(<Probe />)
    // setCache의 throw가 바로 뒤 setState까지 건너뛰면 조회에 성공했는데도 폴백이 표시된다.
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe(STATION.id))
    expect(screen.getByTestId('error').textContent).toBe('')

    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('useLocation — 중복 요청', () => {
  // getCached()가 매번 새 객체를 반환하면 region의 참조가 바뀌어, 이를 의존성으로 쓰는
  // App의 조회 이펙트가 한 번 더 실행되고 같은 대기질 요청이 두 번 나갔다.
  it('캐시된 지역의 참조가 리렌더 사이에 바뀌지 않는다', async () => {
    localStorage.setItem('gr_location', JSON.stringify({ region: STATION, timestamp: Date.now() }))
    const seen: unknown[] = []

    function RefProbe() {
      const { region } = useLocation()
      seen.push(region)
      return <span data-testid="region">{region?.id ?? 'none'}</span>
    }

    const { rerender } = render(<RefProbe />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe(STATION.id))
    await act(async () => {
      rerender(<RefProbe />)
    })

    const identities = new Set(seen.filter(Boolean))
    expect(identities.size).toBe(1)
  })
})
