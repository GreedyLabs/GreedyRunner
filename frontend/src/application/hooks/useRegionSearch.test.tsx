/**
 * useRegionSearch 훅 테스트.
 *
 * 고정하는 것:
 *   - StrictMode 재마운트 후에도 결과를 반영한다 (언마운트 가드 회귀)
 *   - 늦게 도착한 옛 검색어의 응답이 최신 결과를 덮지 않는다
 *   - 실패가 삼켜지지 않고 error로 드러난다
 *   - 버려질 요청은 취소된다 (상류 호출 한도를 태우지 않도록)
 */
import { StrictMode, useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegionSearch } from './useRegionSearch'
import type { Region } from '../../domain/entities/region.types'

// vi.mock은 파일 최상단으로 호이스팅되므로, 팩토리가 참조하는 값은 모두
// vi.hoisted 안에서 만들어야 한다 (바깥에 선언하면 초기화 전 참조로 터진다).
const { searchRegions, RequestCancelledError } = vi.hoisted(() => {
  class RequestCancelledError extends Error {
    constructor() {
      super('요청이 취소되었습니다.')
      this.name = 'RequestCancelledError'
    }
  }
  return { searchRegions: vi.fn(), RequestCancelledError }
})

vi.mock('../../infrastructure/api/airQualityApi', () => ({
  searchRegions,
  RequestCancelledError,
}))

function region(shortName: string): Region {
  return {
    id: `tm:1:${shortName.length}`,
    name: `서울특별시 ${shortName}`,
    shortName,
    city: '서울특별시',
    lat: 37.5,
    lng: 127,
  }
}

/** query를 외부에서 주입하며 훅 상태를 DOM으로 드러낸다. */
function Probe({ query }: { query: string }) {
  const { results, isSearching, error, setQuery } = useRegionSearch()
  useEffect(() => {
    setQuery(query)
  }, [query, setQuery])
  return (
    <div>
      <span data-testid="results">{results.map((r) => r.shortName).join(',')}</span>
      <span data-testid="searching">{String(isSearching)}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  searchRegions.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** 디바운스(300ms)를 넘긴다. */
async function flushDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(350)
  })
}

describe('useRegionSearch — StrictMode 재마운트 (회귀)', () => {
  it('StrictMode에서 두 번 마운트되어도 검색 결과를 반영한다', async () => {
    searchRegions.mockResolvedValue([region('역삼동')])

    render(
      <StrictMode>
        <Probe query="역삼" />
      </StrictMode>
    )
    await flushDebounce()

    await waitFor(() => {
      expect(screen.getByTestId('results').textContent).toBe('역삼동')
    })
    expect(screen.getByTestId('searching').textContent).toBe('false')
  })
})

describe('useRegionSearch — 요청 경쟁 상태', () => {
  // 'ㄱ' → '강' → '강남'을 빠르게 입력하면 요청이 겹치고, 상류 응답 시간이 요청마다 달라
  // 옛 검색어의 응답이 나중에 도착할 수 있다. 그때 최신 결과가 덮이면 사용자에게는
  // "검색이 될 때도 있고 안 될 때도 있다"로 보인다.
  it('늦게 도착한 옛 검색어의 응답은 버린다', async () => {
    const resolvers: Array<(v: Region[]) => void> = []
    searchRegions.mockImplementation(() => new Promise<Region[]>((resolve) => resolvers.push(resolve)))

    const { rerender } = render(<Probe query="강" />)
    await flushDebounce()

    rerender(<Probe query="강남" />)
    await flushDebounce()

    expect(resolvers).toHaveLength(2)
    // 최신 요청('강남')이 먼저 끝나고, 옛 요청('강')이 나중에 끝난다.
    await act(async () => {
      resolvers[1]([region('강남동')])
    })
    await act(async () => {
      resolvers[0]([region('강동동')])
    })

    expect(screen.getByTestId('results').textContent).toBe('강남동')
  })

  it('새 입력이 들어오면 진행 중인 요청을 취소한다', async () => {
    const signals: AbortSignal[] = []
    searchRegions.mockImplementation((_q: string, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal) signals.push(opts.signal)
      return new Promise<Region[]>(() => {})
    })

    const { rerender } = render(<Probe query="강" />)
    await flushDebounce()
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    rerender(<Probe query="강남" />)
    await flushDebounce()

    // 첫 요청은 취소돼야 한다 — 결과를 쓰지 않을 요청이 백엔드의 상류 호출 한도를 태우지 않도록.
    expect(signals[0].aborted).toBe(true)
  })

  it('취소된 요청의 에러는 화면에 표시하지 않는다', async () => {
    searchRegions.mockRejectedValue(new RequestCancelledError())

    render(<Probe query="역삼" />)
    await flushDebounce()
    await waitFor(() => expect(searchRegions).toHaveBeenCalled())

    expect(screen.getByTestId('error').textContent).toBe('')
  })
})

describe('useRegionSearch — 실패 노출', () => {
  // 예전에는 catch가 아예 없어 실패가 unhandled rejection으로 사라지고 드롭다운만
  // 조용히 닫혔다. 사용자는 "결과가 없는 것"과 "검색이 실패한 것"을 구분할 수 없었다.
  it('검색 실패를 error로 드러내고 결과를 비운다', async () => {
    searchRegions.mockRejectedValue(new Error('지역 검색 중 오류가 발생했습니다.'))

    render(<Probe query="역삼" />)
    await flushDebounce()

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('지역 검색 중 오류가 발생했습니다.')
    })
    expect(screen.getByTestId('results').textContent).toBe('')
    expect(screen.getByTestId('searching').textContent).toBe('false')
  })

  it('실패 후 다시 입력하면 error를 지운다', async () => {
    searchRegions.mockRejectedValueOnce(new Error('실패'))
    const { rerender } = render(<Probe query="역삼" />)
    await flushDebounce()
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('실패'))

    searchRegions.mockResolvedValue([region('삼성동')])
    rerender(<Probe query="삼성" />)
    await flushDebounce()

    await waitFor(() => {
      expect(screen.getByTestId('results').textContent).toBe('삼성동')
    })
    expect(screen.getByTestId('error').textContent).toBe('')
  })
})

describe('useRegionSearch — 디바운스', () => {
  it('디바운스 시간 안에는 요청을 보내지 않는다', async () => {
    searchRegions.mockResolvedValue([])
    render(<Probe query="역삼" />)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(searchRegions).not.toHaveBeenCalled()

    await flushDebounce()
    expect(searchRegions).toHaveBeenCalledTimes(1)
  })

  it('검색어를 비우면 요청하지 않고 결과를 비운다', async () => {
    searchRegions.mockResolvedValue([region('역삼동')])
    const { rerender } = render(<Probe query="역삼" />)
    await flushDebounce()
    await waitFor(() => expect(screen.getByTestId('results').textContent).toBe('역삼동'))

    searchRegions.mockClear()
    rerender(<Probe query="   " />)
    await flushDebounce()

    expect(searchRegions).not.toHaveBeenCalled()
    expect(screen.getByTestId('results').textContent).toBe('')
    expect(screen.getByTestId('searching').textContent).toBe('false')
  })
})
