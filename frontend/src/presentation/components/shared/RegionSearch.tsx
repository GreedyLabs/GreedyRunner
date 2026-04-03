import { useRef, useState, useId } from 'react'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { useRegionSearch } from '../../../application/hooks/useRegionSearch'
import type { Region } from '../../../domain/entities/region.types'
import { cn } from '../../../lib/cn'

interface RegionSearchProps {
  onRegionSelect: (region: Region) => void
  onLocateMe: () => void
  isLocating: boolean
  locationError: string | null
  selectedRegion: Region | null
}

export function RegionSearch({
  onRegionSelect,
  onLocateMe,
  isLocating,
  locationError,
  selectedRegion,
}: RegionSearchProps) {
  const inputId = useId()
  const { query, results, isSearching, setQuery, closeDropdown } = useRegionSearch()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function handleSelect(region: Region) {
    onRegionSelect(region)
    setQuery(region.name)   // 입력창에 선택된 지역명 표시
    closeDropdown()
    setIsDropdownOpen(false)
    inputRef.current?.blur()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setIsDropdownOpen(true)
  }

  function handleBlur(e: React.FocusEvent) {
    // 드롭다운 클릭 시 blur 이벤트 무시
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return
    setTimeout(() => setIsDropdownOpen(false), 150)
  }

  const showDropdown = isDropdownOpen && (isSearching || results.length > 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      {/* 현재 선택된 지역 표시 */}
      {selectedRegion && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <span>📍</span>
          <span className="font-medium text-gray-700">{selectedRegion.name}</span>
          <span className="text-gray-300">|</span>
          <span>지역을 변경하려면 아래에서 검색하세요</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 입력 */}
        <div className="relative flex-1">
          <label htmlFor={inputId} className="sr-only">
            지역 검색
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={handleBlur}
              placeholder="지역을 검색하세요 (예: 강남, 부산)"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </span>
            )}
          </div>

          {/* 검색 결과 드롭다운 */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
            >
              {isSearching && results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">검색 중...</div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">
                  검색 결과가 없습니다
                </div>
              ) : (
                <ul role="listbox">
                  {results.map(region => (
                    <li key={region.id} role="option" aria-selected={selectedRegion?.id === region.id}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelect(region)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-3',
                          selectedRegion?.id === region.id && 'bg-blue-50 text-blue-700'
                        )}
                      >
                        <span className="text-gray-400">📍</span>
                        <span>
                          <span className="font-medium text-gray-800">{region.shortName}</span>
                          <span className="text-gray-400 ml-1.5">{region.city}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 현재 위치 버튼 */}
        <Button
          variant="secondary"
          onClick={onLocateMe}
          isLoading={isLocating}
          className="shrink-0 whitespace-nowrap"
        >
          {!isLocating && <span>📡</span>}
          현재 위치
        </Button>
      </div>

      {/* 위치 오류 메시지 */}
      {locationError && (
        <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
          <span>⚠️</span>
          {locationError}
        </p>
      )}
    </div>
  )
}
