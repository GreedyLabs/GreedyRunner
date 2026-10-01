/**
 * useAirQuality 훅 테스트.
 *
 * 고정하는 것:
 *   - StrictMode 재마운트 후에도 응답을 반영한다 (언마운트 가드 회귀)
 *   - 늦게 도착한 옛 지역의 응답이 최신 화면을 덮지 않는다
 *   - 실패 시 이전 지역 데이터를 남기지 않는다 (오류 배너 + 남의 대시보드 동시 표시 방지)
 *   - 캐시가 훅 인스턴스 사이에 공유되고, degraded 응답은 짧게만 캐싱된다
 */
import { StrictMode, useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAirQuality } from './useAirQuality'
import type { AirQualityData } from '../../domain/entities/airQuality.types'

// vi.mock은 호이스팅되므로 팩토리가 참조하는 값은 vi.hoisted 안에서 만든다.
const { getAirQualityByRegion, RequestCancelledError, ApiUnreachableError } = vi.hoisted(() => {
  class RequestCancelledError extends Error {
    constructor() {
      super('요청이 취소되었습니다.')
      this.name = 'RequestCancelledError'
    }
  }
  class ApiUnreachableError extends Error {
    constructor(target: string) {
      super(
        `API 서버(${target})에 연결할 수 없습니다. 서버가 실행 중인지, VITE_API_BASE_URL이 올바른지 확인해 주세요.`
      )
      this.name = 'ApiUnreachableError'
    }
  }
  return { getAirQualityByRegion: vi.fn(), RequestCancelledError, ApiUnreachableError }
})

vi.mock('../../infrastructure/api/airQualityApi', () => ({
  getAirQualityByRegion,
  RequestCancelledError,
  ApiUnreachableError,
}))

function data(regionName: string, overrides: Partial<AirQualityData> = {}): AirQualityData {
  const runningIndex = { score: 80, status: 'great' as const, label: '달리기 최적', message: '', canRun: true }
  return {
    regionName,
    updatedAt: new Date('2026-10-01T08:00:00+09:00'),
    serviceStatus: { airKorea: 'ok', weather: 'ok' },
    current: { airQuality: { pm25: 5, pm10: 10, o3: 0.02, no2: null, co: null }, runningIndex },
    hourlyForecast: [],
    bestRunningHours: [],
    ...overrides,
  }
}

/** regionId를 외부에서 주입하며 훅 상태를 DOM으로 드러낸다. */
function Probe({ regionId }: { regionId: string }) {
  const { data: result, isLoading, error, fetchByRegion } = useAirQuality()
  useEffect(() => {
    void fetchByRegion(regionId, 37.5, 127)
  }, [regionId, fetchByRegion])
  return (
    <div>
      <span data-testid="region">{result?.regionName ?? 'none'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  )
}

/**
 * 테스트마다 고유한 regionId를 쓴다.
 *
 * 캐시가 모듈 스코프에 있어(컴포넌트 트리 밖에 두는 것이 맞다 — 훅 인스턴스마다 갈라지면
 * 상류 호출을 중복으로 태우므로) 테스트 사이에 남는다. 같은 id를 재사용하면 앞 테스트가
 * 채운 캐시를 맞아 API를 타지 않고, "두 번째 요청이 안 나간다"는 가짜 실패가 된다.
 */
let seq = 0
const uniqueId = (label: string) => `station:${label}-${++seq}`

beforeEach(() => {
  getAirQualityByRegion.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAirQuality — StrictMode 재마운트 (회귀)', () => {
  it('StrictMode에서 두 번 마운트되어도 응답을 반영한다', async () => {
    getAirQualityByRegion.mockResolvedValue(data('강남대로 측정소'))

    render(
      <StrictMode>
        <Probe regionId={uniqueId('strict')} />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByTestId('region').textContent).toBe('강남대로 측정소')
    })
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('')
  })
})

describe('useAirQuality — 요청 경쟁 상태', () => {
  // 지역을 빠르게 두 번 고르면 두 요청이 겹친다. 먼저 고른 지역의 응답이 나중에 도착하면
  // 화면에는 방금 고른 지역 이름 아래 다른 지역의 값이 남는다.
  it('늦게 도착한 옛 지역의 응답은 버린다', async () => {
    const resolvers: Array<(v: AirQualityData) => void> = []
    getAirQualityByRegion.mockImplementation(
      () => new Promise<AirQualityData>((resolve) => resolvers.push(resolve))
    )

    const [idA, idB] = [uniqueId('race-A'), uniqueId('race-B')]
    const { rerender } = render(<Probe regionId={idA} />)
    await waitFor(() => expect(resolvers).toHaveLength(1))

    rerender(<Probe regionId={idB} />)
    await waitFor(() => expect(resolvers).toHaveLength(2))

    // 최신 요청(B)이 먼저, 옛 요청(A)이 나중에 끝난다.
    await act(async () => {
      resolvers[1](data('B 측정소'))
    })
    await act(async () => {
      resolvers[0](data('A 측정소'))
    })

    expect(screen.getByTestId('region').textContent).toBe('B 측정소')
  })

  it('새 조회가 시작되면 진행 중인 요청을 취소한다', async () => {
    const signals: AbortSignal[] = []
    getAirQualityByRegion.mockImplementation(
      (_id: string, _lat?: number, _lng?: number, opts?: { signal?: AbortSignal }) => {
        if (opts?.signal) signals.push(opts.signal)
        return new Promise<AirQualityData>(() => {})
      }
    )

    const [idA, idB] = [uniqueId('abort-A'), uniqueId('abort-B')]
    const { rerender } = render(<Probe regionId={idA} />)
    await waitFor(() => expect(signals).toHaveLength(1))

    rerender(<Probe regionId={idB} />)
    await waitFor(() => expect(signals).toHaveLength(2))

    expect(signals[0].aborted).toBe(true)
  })

  it('취소된 요청의 에러는 화면에 표시하지 않는다', async () => {
    getAirQualityByRegion.mockRejectedValue(new RequestCancelledError())

    render(<Probe regionId={uniqueId('cancelled')} />)
    await waitFor(() => expect(getAirQualityByRegion).toHaveBeenCalled())

    expect(screen.getByTestId('error').textContent).toBe('')
  })
})

describe('useAirQuality — 실패 처리', () => {
  // 예전에는 `...prev`로 data를 유지해서 오류 배너와 (다른 지역의) 완성된 대시보드가
  // 동시에 표시됐고, 사용자는 화면의 점수가 어느 지역 것인지 알 수 없었다.
  it('실패하면 이전 지역 데이터를 남기지 않는다', async () => {
    getAirQualityByRegion.mockResolvedValueOnce(data('A 측정소'))
    const { rerender } = render(<Probe regionId={uniqueId('fail-A')} />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe('A 측정소'))

    getAirQualityByRegion.mockRejectedValue(new Error('대기질 정보 조회 중 오류가 발생했습니다.'))
    rerender(<Probe regionId={uniqueId('fail-B')} />)

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('대기질 정보 조회 중 오류가 발생했습니다.')
    })
    expect(screen.getByTestId('region').textContent).toBe('none')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })
})

describe('useAirQuality — 캐시', () => {
  // 캐시가 useRef에 있으면 훅 인스턴스마다 갈라져, 두 번째 사용처가 생기는 순간
  // 같은 지역을 각자 다시 받아 오고(상류 호출 한도를 두 배로 태운다) 값이 어긋난다.
  it('캐시를 훅 인스턴스 사이에 공유한다', async () => {
    const regionId = uniqueId('shared')
    getAirQualityByRegion.mockResolvedValue(data('공유 측정소'))

    const first = render(<Probe regionId={regionId} />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe('공유 측정소'))
    expect(getAirQualityByRegion).toHaveBeenCalledTimes(1)
    first.unmount()

    // 다른 훅 인스턴스에서 같은 지역을 조회한다 — 캐시가 공유되면 상류를 다시 타지 않는다.
    render(<Probe regionId={regionId} />)
    await waitFor(() => expect(screen.getByTestId('region').textContent).toBe('공유 측정소'))
    expect(getAirQualityByRegion).toHaveBeenCalledTimes(1)
  })

  // 상류가 하나라도 정상이 아니면 짧게만 캐싱해야 한다. 그러지 않으면 상류가 복구된
  // 뒤에도 사용자는 5분 동안 빈 화면을 본다.
  it('degraded 응답은 5분이 아니라 1분만 캐싱한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const regionId = uniqueId('degraded')
      getAirQualityByRegion.mockResolvedValue(
        data('저하 측정소', { serviceStatus: { airKorea: 'error', weather: 'ok' } })
      )

      const first = render(<Probe regionId={regionId} />)
      await waitFor(() => expect(screen.getByTestId('region').textContent).toBe('저하 측정소'))
      expect(getAirQualityByRegion).toHaveBeenCalledTimes(1)
      first.unmount()

      // 1분 TTL을 넘긴다 (정상 응답이면 5분이라 아직 캐시가 살아 있어야 한다).
      await act(async () => {
        vi.advanceTimersByTime(90_000)
      })

      render(<Probe regionId={regionId} />)
      await waitFor(() => expect(getAirQualityByRegion).toHaveBeenCalledTimes(2))
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useAirQuality — 연결 불가', () => {
  // fetch가 서버 미기동·주소 오류·CORS 차단을 모두 TypeError('Failed to fetch')로 던지는데,
  // 그 문구를 그대로 띄우면 원인을 전혀 좁힐 수 없다. 실제로 VITE_API_BASE_URL이 다른
  // 서비스의 포트를 가리키는 설정 오류를 이 문구만으로는 구분할 수 없었다.
  it('연결 실패는 확인할 지점을 알려 주는 문구로 표시한다', async () => {
    getAirQualityByRegion.mockRejectedValue(new ApiUnreachableError('http://localhost:8080'))

    render(<Probe regionId={uniqueId('unreachable')} />)

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('http://localhost:8080')
    })
    expect(screen.getByTestId('error').textContent).toContain('VITE_API_BASE_URL')
    expect(screen.getByTestId('error').textContent).not.toContain('Failed to fetch')
  })
})
