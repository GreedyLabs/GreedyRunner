import { useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import type { HourlyForecast as HourlyForecastType } from '../../../domain/entities/airQuality.types';
import { cn } from '../../../lib/cn';

interface HourlyForecastProps {
  forecast: HourlyForecastType[];
  bestHours: number[];
  selectedHour: number | null;
  onHourSelect: (hourData: HourlyForecastType) => void;
}

const STATUS_COLOR = {
  great: { bar: 'bg-emerald-400', text: 'text-emerald-600' },
  good: { bar: 'bg-blue-400', text: 'text-blue-600' },
  caution: { bar: 'bg-amber-400', text: 'text-amber-600' },
  bad: { bar: 'bg-orange-400', text: 'text-orange-600' },
  worst: { bar: 'bg-red-400', text: 'text-red-600' },
};

const STATUS_LEGEND: Record<string, string> = {
  great: '최적',
  good: '좋음',
  caution: '주의',
  bad: '자제',
  worst: '금지',
};

const BAR_MAX = 56;

export function HourlyForecast({
  forecast,
  bestHours,
  selectedHour,
  onHourSelect,
}: HourlyForecastProps) {
  const currentHour = new Date().getHours();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentBarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !currentBarRef.current) return;
    const container = scrollRef.current;
    const bar = currentBarRef.current;
    const scrollLeft = bar.offsetLeft - container.clientWidth / 2 + bar.clientWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [forecast]);

  const bestHourLabel =
    bestHours.length > 0
      ? bestHours.map((h) => `${h}시`).join(', ')
      : '오늘은 좋은 시간대가 없어요';

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-base">오늘의 러닝 타임라인</h3>
        <span className="text-xs text-gray-400">24시간 예보</span>
      </div>

      {bestHours.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-2">
          {/* <span className="text-lg">⏰</span> */}
          <div>
            <p className="text-xs text-blue-500 font-medium">언제 달리는 게 더 좋을까요?</p>
            <p className="text-sm font-bold text-blue-700">{bestHourLabel}가 최적입니다</p>
          </div>
        </div>
      )}

      {/* 바 차트 */}
      <div ref={scrollRef} className="overflow-x-auto -mx-1 px-1 pb-1">
        <div style={{ minWidth: '540px' }}>
          {/* 바 영역 */}
          <div
            className="flex items-end gap-[3px] sm:gap-1"
            style={{ height: BAR_MAX + 20 }}
          >
            {forecast.map((hourData) => {
              const { hour, runningIndex } = hourData;
              const isNow = hour === currentHour;
              const isBest = bestHours.includes(hour);
              const isSelected = selectedHour === hour;
              const isPast = hour < currentHour && !isSelected;
              const color = STATUS_COLOR[runningIndex.status];
              const barH = Math.max(4, (runningIndex.score / 100) * BAR_MAX);

              return (
                <button
                  key={hour}
                  ref={isNow ? currentBarRef : undefined}
                  type="button"
                  className="flex-1 flex flex-col items-center justify-end gap-0.5 cursor-pointer group"
                  onClick={() => onHourSelect(hourData)}
                >
                  {/* 점수 (현재/선택 시간만) */}
                  {(isNow || isSelected) && (
                    <span
                      className={cn(
                        'text-[9px] sm:text-[10px] font-bold leading-none',
                        isSelected ? 'text-violet-600' : 'text-blue-600',
                      )}
                    >
                      {runningIndex.score}
                    </span>
                  )}

                  {/* 추천 표시 */}
                  {isBest && !isNow && !isSelected && (
                    <span className="text-[8px] leading-none">⭐</span>
                  )}

                  {/* 바 */}
                  <div
                    className={cn(
                      'w-full rounded-md transition-all duration-300',
                      color.bar,
                      isSelected && 'ring-1.5 ring-violet-500 ring-offset-1 brightness-110',
                      isNow && !isSelected && 'ring-1.5 ring-blue-500 ring-offset-1',
                      isPast && 'opacity-35',
                      !isNow && !isSelected && 'group-hover:opacity-80 group-hover:brightness-110',
                    )}
                    style={{ height: `${barH}px` }}
                  />
                </button>
              );
            })}
          </div>

          {/* 시간 라벨 (고정 높이, 바와 분리) */}
          <div className="flex gap-[3px] sm:gap-1 mt-1.5">
            {forecast.map(({ hour }) => {
              const isNow = hour === currentHour;
              const isSelected = selectedHour === hour;
              return (
                <span
                  key={hour}
                  className={cn(
                    'flex-1 text-center text-[9px] sm:text-[10px] leading-none h-3',
                    isSelected ? 'text-violet-600 font-semibold'
                      : isNow ? 'text-blue-600 font-semibold'
                      : 'text-gray-300',
                  )}
                >
                  {isSelected || isNow ? hour : hour % 3 === 0 ? hour : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-between sm:justify-start sm:gap-3 mt-3 pt-3 border-t border-gray-100">
        {Object.entries(STATUS_COLOR).map(([status, { bar, text }]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-[3px]', bar)} />
            <span className={cn('text-[10px] sm:text-xs', text)}>{STATUS_LEGEND[status]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
