import { useEffect, useRef } from 'react'
import { Card } from '../ui/Card'
import type { HourlyForecast as HourlyForecastType } from '../../../domain/entities/airQuality.types'
import { cn } from '../../../lib/cn'

interface HourlyForecastProps {
  forecast: HourlyForecastType[]
  bestHours: number[]
  selectedHour: number | null
  onHourSelect: (hourData: HourlyForecastType) => void
}

const STATUS_BAR_COLOR = {
  great:   'bg-emerald-400',
  good:    'bg-blue-400',
  caution: 'bg-amber-400',
  bad:     'bg-orange-400',
  worst:   'bg-red-400',
}

const STATUS_TEXT_COLOR = {
  great:   'text-emerald-600',
  good:    'text-blue-600',
  caution: 'text-amber-600',
  bad:     'text-orange-600',
  worst:   'text-red-600',
}

export function HourlyForecast({ forecast, bestHours, selectedHour, onHourSelect }: HourlyForecastProps) {
  const now = new Date()
  const currentHour = now.getHours()
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentBarRef = useRef<HTMLButtonElement>(null)

  // 데이터 로드 시 현재 시간 바를 가운데로 스크롤
  useEffect(() => {
    if (!scrollRef.current || !currentBarRef.current) return
    const container = scrollRef.current
    const bar = currentBarRef.current
    const scrollLeft = bar.offsetLeft - container.clientWidth / 2 + bar.clientWidth / 2
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [forecast])

  const bestHourLabel = bestHours.length > 0
    ? bestHours.map(h => `${h}시`).join(', ')
    : '오늘은 좋은 시간대가 없어요'

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-base">오늘의 러닝 타임라인</h3>
        <span className="text-xs text-gray-400">24시간 예보</span>
      </div>

      {/* 추천 시간대 배너 */}
      {bestHours.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-lg">⏰</span>
          <div>
            <p className="text-xs text-emerald-600 font-medium">언제 달리는 게 더 좋을까요?</p>
            <p className="text-sm font-bold text-emerald-700">{bestHourLabel}가 최적입니다</p>
          </div>
        </div>
      )}

      {/* 시간별 바 차트 */}
      <div ref={scrollRef} className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-end gap-1 min-w-max pb-1" style={{ minWidth: '600px' }}>
          {forecast.map((hourData) => {
            const { hour, runningIndex } = hourData
            const isNow = hour === currentHour
            const isBest = bestHours.includes(hour)
            const isSelected = selectedHour === hour
            const barHeight = Math.max(8, runningIndex.score * 0.6)

            return (
              <button
                key={hour}
                ref={isNow ? currentBarRef : undefined}
                type="button"
                className="flex flex-col items-center gap-1 w-6 cursor-pointer"
                onClick={() => onHourSelect(hourData)}
              >
                {/* 점수 라벨 (현재 시간 또는 선택된 시간) */}
                {(isNow || isSelected) && (
                  <span className={cn(
                    'text-xs font-bold',
                    isSelected ? 'text-violet-600' : 'text-blue-600'
                  )}>{runningIndex.score}</span>
                )}

                {/* 추천 별 표시 */}
                {isBest && !isNow && !isSelected && (
                  <span className="text-xs">⭐</span>
                )}

                {/* 바 */}
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all',
                    STATUS_BAR_COLOR[runningIndex.status],
                    isSelected && 'ring-2 ring-violet-500 ring-offset-1',
                    isNow && !isSelected && 'ring-2 ring-blue-500 ring-offset-1',
                    hour < currentHour && !isSelected && 'opacity-40'
                  )}
                  style={{ height: `${barHeight}px` }}
                  title={`${hour}시 - 러닝 지수 ${runningIndex.score}`}
                />

                {/* 시각 라벨 (6시간 단위) */}
                <span
                  className={cn(
                    'text-xs leading-none',
                    isSelected ? 'text-violet-600 font-bold' : isNow ? 'text-blue-600 font-bold' : 'text-gray-400'
                  )}
                >
                  {isSelected ? `${hour}` : hour % 6 === 0 ? `${hour}` : isNow ? '▲' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-between sm:justify-start sm:gap-3 mt-4 pt-3 border-t border-gray-100">
        {(Object.entries(STATUS_BAR_COLOR) as [keyof typeof STATUS_BAR_COLOR, string][]).map(
          ([status, colorClass]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={cn('w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm', colorClass)} />
              <span className={cn('text-[11px] sm:text-xs', STATUS_TEXT_COLOR[status])}>
                {STATUS_LEGEND[status]}
              </span>
            </div>
          )
        )}
      </div>
    </Card>
  )
}

const STATUS_LEGEND = {
  great:   '최적',
  good:    '좋음',
  caution: '주의',
  bad:     '자제',
  worst:   '금지',
}
