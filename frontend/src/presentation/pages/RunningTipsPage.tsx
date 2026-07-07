import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
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
        <h1 className="text-[23px] font-extrabold leading-snug tracking-tight">러닝 팁</h1>
        <p className="text-[13px] text-muted mt-1">
          더 잘 달리기 위한 {RUNNING_TIPS.length}가지 팁
        </p>
      </div>

      {/* 검색 인풋 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
        <input
          type="search"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="팁 검색…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-paper text-ink border border-line rounded-xl placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
        />
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
              selectedCategory === cat
                ? 'bg-accent text-white'
                : 'bg-panel border border-line text-muted hover:text-ink',
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
          <p className="text-sm font-semibold text-ink">검색 결과가 없습니다</p>
          <p className="text-xs text-muted mt-1">다른 키워드나 카테고리로 검색해 보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tip => (
            <Link key={tip.id} to={`/tips/${tip.id}`} state={{ backUrl: `/tips${searchParams.toString() ? `?${searchParams.toString()}` : ''}` }} className="block">
              <Card padding="none" className="px-[15px] py-[13px] hover:bg-paper/50 transition-colors active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <span className="flex-none w-[34px] h-[34px] rounded-[10px] bg-accent-soft flex items-center justify-center text-lg mt-0.5">
                    {tip.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent mb-1">
                      {tip.category}
                    </span>
                    <p className="text-sm font-semibold text-ink leading-snug mb-1">
                      {tip.title}
                    </p>
                    <p className="text-xs text-muted leading-relaxed line-clamp-2">
                      {tip.summary}
                    </p>
                  </div>
                  <ChevronRight className="w-[15px] h-[15px] text-faint shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
