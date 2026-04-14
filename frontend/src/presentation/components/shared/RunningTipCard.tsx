import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { RUNNING_TIPS } from '../../../lib/runningTips'
import { Card } from '../ui/Card'

const CATEGORY_COLOR: Record<string, string> = {
  '페이스': 'bg-blue-100 text-blue-600',
  '기상':   'bg-sky-100 text-sky-600',
  '영양':   'bg-emerald-100 text-emerald-600',
  '장비':   'bg-violet-100 text-violet-600',
  '회복':   'bg-amber-100 text-amber-600',
  '호흡':   'bg-teal-100 text-teal-600',
}

export function RunningTipCard() {
  // 세션 내 동일 팁이 반복되지 않도록 마운트 시 한 번만 랜덤 선택
  const tip = useMemo(() => {
    const idx = Math.floor(Math.random() * RUNNING_TIPS.length)
    return RUNNING_TIPS[idx]
  }, [])

  const categoryColor = CATEGORY_COLOR[tip.category] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="animate-slide-up">
      <Link to={`/tips/${tip.id}`} className="block">
        <Card className="hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor}`}>
                  {tip.category}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400">러닝 팁</span>
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base mb-1.5 leading-snug">
                {tip.emoji} {tip.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-3">
                {tip.summary}
              </p>
            </div>
            <svg
              className="w-4 h-4 text-gray-300 shrink-0 mt-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-[10px] text-gray-300 mt-3">탭하면 자세히 볼 수 있어요</p>
        </Card>
      </Link>
      <div className="flex justify-end mt-1.5 px-1">
        <Link
          to="/tips"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
        >
          모든 팁 보기
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
