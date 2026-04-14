import { Link, useSearchParams } from 'react-router-dom'
import { RUNNING_TIPS } from '../../lib/runningTips'
import type { RunningTip } from '../../lib/runningTips'
import { Card } from '../components/ui/Card'
import { cn } from '../../lib/cn'

type Category = RunningTip['category']

const CATEGORIES: Array<Category | '전체'> = [
  '전체',
  '페이스',
  '기상',
  '영양',
  '장비',
  '회복',
  '호흡',
]

const CATEGORY_COLOR: Record<string, string> = {
  '페이스': 'bg-blue-100 text-blue-600',
  '기상':   'bg-sky-100 text-sky-600',
  '영양':   'bg-emerald-100 text-emerald-600',
  '장비':   'bg-violet-100 text-violet-600',
  '회복':   'bg-amber-100 text-amber-600',
  '호흡':   'bg-teal-100 text-teal-600',
}

export function RunningTipsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('q') ?? ''
  const selectedCategory = (searchParams.get('cat') ?? '전체') as Category | '전체'

  function setKeyword(value: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function setSelectedCategory(cat: Category | '전체') {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (cat === '전체') next.delete('cat')
      else next.set('cat', cat)
      return next
    }, { replace: true })
  }

  const filtered = RUNNING_TIPS.filter(tip => {
    const matchCategory =
      selectedCategory === '전체' || tip.category === selectedCategory

    const trimmed = keyword.trim().toLowerCase()
    const matchKeyword =
      trimmed === '' ||
      tip.title.toLowerCase().includes(trimmed) ||
      tip.summary.toLowerCase().includes(trimmed) ||
      tip.category.toLowerCase().includes(trimmed)

    return matchCategory && matchKeyword
  })

  return (
    <div className="space-y-4 animate-slide-up">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800">러닝 팁</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
          더 잘 달리기 위한 {RUNNING_TIPS.length}가지 팁
        </p>
      </div>

      {/* 검색 인풋 */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="search"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="팁 검색…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition"
        />
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 팁 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-3xl mb-3">🔍</span>
          <p className="text-sm font-semibold text-gray-500">검색 결과가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">다른 키워드나 카테고리로 검색해 보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tip => {
            const categoryColor = CATEGORY_COLOR[tip.category] ?? 'bg-gray-100 text-gray-600'
            return (
              <Link key={tip.id} to={`/tips/${tip.id}`} state={{ backUrl: `/tips${searchParams.toString() ? `?${searchParams.toString()}` : ''}` }} className="block">
                <Card className="hover:border-blue-200 hover:shadow-sm transition-all active:scale-[0.99]">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 leading-none mt-0.5">{tip.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', categoryColor)}>
                          {tip.category}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 leading-snug mb-1">
                        {tip.title}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {tip.summary}
                      </p>
                    </div>
                    <svg
                      className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
