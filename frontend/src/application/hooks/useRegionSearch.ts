import { useState, useCallback, useEffect, useRef } from 'react'
import type { Region } from '../../domain/entities/region.types'
import { RequestCancelledError, searchRegions } from '../../infrastructure/api/airQualityApi'

interface UseRegionSearchReturn {
  query: string
  results: Region[]
  isSearching: boolean
  /** 검색이 실패했을 때의 안내 문구. 성공·취소 시에는 null. */
  error: string | null
  setQuery: (q: string) => void
  clearResults: () => void
  closeDropdown: () => void  // 검색어는 유지하고 결과만 닫기
}

const DEBOUNCE_MS = 300

export function useRegionSearch(): UseRegionSearchReturn {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<Region[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  /**
   * 요청 순서 가드.
   *
   * 예전에는 디바운스만 있고 시퀀스 가드도 취소도 없었다. 'ㄱ' → '강' → '강남'을 빠르게
   * 입력하면 세 요청이 겹쳐 나가고, 상류 응답 시간이 요청마다 달라 '강'의 응답이 '강남'의
   * 응답보다 늦게 도착하면 최신 검색어의 결과가 옛 결과로 덮였다. 사용자에게는 "검색이
   * 될 때도 있고 안 될 때도 있다"로 보였다.
   */
  const latestRequestRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    // 진행 중인 요청을 취소한다 — 결과를 쓰지 않을 요청이 백엔드의 상류 호출 한도를
    // 태우는 것도 막는다.
    abortRef.current?.abort()

    if (!q.trim()) {
      setResults([])
      setIsSearching(false)
      setError(null)
      return
    }

    setIsSearching(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      const requestId = ++latestRequestRef.current
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const found = await searchRegions(q, { signal: controller.signal })
        // 더 최신 요청이 이미 나갔으면 이 응답은 버린다.
        if (requestId !== latestRequestRef.current || !mountedRef.current) return
        setResults(found)
        setError(null)
      } catch (err) {
        if (err instanceof RequestCancelledError) return
        if (requestId !== latestRequestRef.current || !mountedRef.current) return
        // 예전에는 catch가 아예 없어 실패가 unhandled rejection으로 사라지고, 드롭다운은
        // 조용히 닫히기만 했다. 사용자는 "결과가 없는 것"과 "검색이 실패한 것"을 구분할 수 없었다.
        setResults([])
        setError(err instanceof Error ? err.message : '지역 검색에 실패했어요. 잠시 후 다시 시도해 주세요.')
      } finally {
        if (requestId === latestRequestRef.current && mountedRef.current) setIsSearching(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  const clearResults = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    latestRequestRef.current++
    setResults([])
    setQueryState('')
    setError(null)
    setIsSearching(false)
  }, [])

  // 검색어는 그대로 두고 드롭다운 결과만 닫을 때 사용
  const closeDropdown = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    latestRequestRef.current++
    setResults([])
    setIsSearching(false)
    setError(null)
  }, [])

  return { query, results, isSearching, error, setQuery, clearResults, closeDropdown }
}
