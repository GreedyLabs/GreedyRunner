import { useRef, useState, useId } from 'react'
import { MapPin, Search, LocateFixed, TriangleAlert } from 'lucide-react'
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
  const { query, results, isSearching, error, setQuery, closeDropdown } = useRegionSearch()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listboxId = `${inputId}-listbox`

  function handleSelect(region: Region) {
    onRegionSelect(region)
    setQuery(region.name)
    closeDropdown()
    setIsDropdownOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setIsDropdownOpen(true)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        handleSelect(results[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false)
      setActiveIndex(-1)
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // 드롭다운 클릭 시 blur 이벤트 무시
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return
    setTimeout(() => setIsDropdownOpen(false), 150)
  }

  // 결과 0건과 실패도 드롭다운을 열어 둔다.
  // 예전 조건(isSearching || results.length > 0)에서는 결과가 비면 드롭다운이 조용히 닫혀
  // "결과가 없음"과 "검색이 실패함"을 구분할 수 없었고, 아래의 '검색 결과가 없습니다'
  // 분기는 어떤 상태에서도 도달하지 않는 죽은 코드였다.
  // 검색어가 있고 드롭다운이 열려 있으면 항상 보여 준다 — 상태(검색 중·결과·없음·실패)는
  // 드롭다운 안에서 구분한다.
  const showDropdown = isDropdownOpen && query.trim().length > 0

  return (
    <div className="bg-panel rounded-2xl border border-line p-4 sm:p-5">
      {/* 현재 선택된 지역 표시 */}
      {selectedRegion && (
        <div className="flex items-center gap-2 mb-3 text-xs sm:text-sm text-muted">
          <MapPin className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium text-ink">{selectedRegion.name}</span>
          <span className="hidden sm:inline text-line">|</span>
          <span className="hidden sm:inline">지역을 변경하려면 아래에서 검색하세요</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 입력 */}
        <div className="relative flex-1">
          <label htmlFor={inputId} className="sr-only">
            지역 검색
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="동이름 또는 도시명으로 검색 (예: 역삼동, 부산)"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-paper text-ink border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
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
              className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-panel border border-line rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto"
            >
              {isSearching && results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted text-center" role="status">검색 중...</div>
              ) : error ? (
                <div className="px-4 py-3 text-sm text-critical text-center" role="status">
                  {error}
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted text-center" role="status">
                  검색 결과가 없습니다
                </div>
              ) : (
                <ul id={listboxId} role="listbox">
                  {/*
                    항목을 <li role="option">에 직접 달고 포커스 가능한 <button>은 두지 않는다.
                    예전에는 li 안에 button이 있어 (1) 그 button이 탭 순서에 들어가는데
                    onMouseDown만 받아 포커스된 상태에서 Enter·Space가 무반응이었고(WCAG 2.1.1),
                    (2) role="option" 안에 포커스 가능한 요소가 들어가 ARIA 구조 규칙을 위반했다.
                    조작은 입력창의 ArrowUp/ArrowDown + Enter(handleKeyDown)가 담당한다.
                  */}
                  {results.map((region, index) => (
                    <li
                      key={region.id}
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseDown={() => handleSelect(region)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'cursor-pointer px-4 py-2.5 text-sm transition-colors flex items-center gap-3',
                        activeIndex === index || selectedRegion?.id === region.id
                          ? 'bg-accent-soft text-accent'
                          : 'hover:bg-accent-soft'
                      )}
                    >
                      <MapPin className="w-3.5 h-3.5 text-faint" />
                      <span>
                        <span className="font-medium text-ink">{region.shortName}</span>
                        <span className="text-muted ml-1.5">{region.city}</span>
                      </span>
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
          {!isLocating && <LocateFixed className="w-4 h-4" />}
          현재 위치
        </Button>
      </div>

      {/* 위치 오류 메시지 */}
      {locationError && (
        <p className="mt-2 text-xs text-critical flex items-center gap-1">
          <TriangleAlert className="w-3.5 h-3.5" />
          {locationError}
        </p>
      )}
    </div>
  )
}
