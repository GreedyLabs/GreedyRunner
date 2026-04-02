import { useState, useCallback, useRef } from 'react'
import type { Region } from '../../domain/entities/region.types'
import { searchRegions } from '../../infrastructure/api/airQualityApi'

interface UseRegionSearchReturn {
  query: string
  results: Region[]
  isSearching: boolean
  setQuery: (q: string) => void
  clearResults: () => void
  closeDropdown: () => void  // 검색어는 유지하고 결과만 닫기
}

export function useRegionSearch(): UseRegionSearchReturn {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<Region[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setQuery = useCallback((q: string) => {
    setQueryState(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchRegions(q)
        setResults(found)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const clearResults = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
    setQueryState('')
  }, [])

  // 검색어는 그대로 두고 드롭다운 결과만 닫을 때 사용
  const closeDropdown = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
    setIsSearching(false)
  }, [])

  return { query, results, isSearching, setQuery, clearResults, closeDropdown }
}
