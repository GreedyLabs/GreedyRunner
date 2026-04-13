import { useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import type { HourlyForecast as HourlyForecastType } from '../../../domain/entities/airQuality.types';
import { cn } from '../../../lib/cn';

interface HourlyForecastProps {
  forecast: HourlyForecastType[];
  bestHours: number[];
  selectedHour: number | null;
  updatedAt: Date;
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
  updatedAt,
  onHourSelect,
}: HourlyForecastProps) {
  // 측정 시각을 기준으로 '현재' 시간 판단 (백엔드의 currentHour와 일치)
  const currentHour = updatedAt.getHours();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentBarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !currentBarRef.current) return;
    const container = scrollRef.current;
    const bar = currentBarRef.current;
    const scrollLeft = bar.offsetLeft - container.clientWidth / 2 + bar.clientWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [forecast]);

  // bestHours는 미래 시간만 포함(어제 제외됨) — 안전하게 라벨 생성
  const bestHourLabel = (() => {
    if (bestHours.length === 0) return '오늘은 좋은 시간대가 없어요';
    return bestHours.map((h) => {
      const item = forecast.find((f) => f.hour === h && !f.isPrevDay);
      const prefix = item?.isNextDay ? '내일 ' : '';
      return `${prefix}${h}시`;
    }).join(', ');
  })();

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-base">오늘의 러닝 타임라인</h3>
        <span className="text-xs text-gray-400">24시간 예보</span>
      </div>

      {bestHours.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-2">
          <div>
            <p className="text-xs text-blue-500 font-medium">언제 달리는 게 더 좋을까요?</p>
            <p className="text-sm font-bold text-blue-700">{bestHourLabel}가 최적입니다</p>
          </div>
        </div>
      )}

      {/* 바 차트 */}
      <div ref={scrollRef} className="overflow-x-auto -mx-1 px-1 pb-1">
        {/* pt-7: 호버 툴팁이 바 위에 표시될 수 있도록 여유 공간 확보 */}
        <div style={{ minWidth: '540px' }} className="pt-7">
          {/* 바 영역 */}
          <div
            className="flex items-end gap-[3px] sm:gap-1"
            style={{ height: BAR_MAX + 20 }}
          >
            {forecast.map((hourData, index) => {
              const { hour, runningIndex, isNextDay, isPrevDay } = hourData;
              const isToday = !isPrevDay && !isNextDay;
              const isNow = isToday && hour === currentHour;
              // bestHours는 백엔드에서 어제를 이미 제외하므로 hour만 매칭해도 안전
              const isBest = !isPrevDay && bestHours.includes(hour);
              const isSelected = selectedHour === hour;
              // 어제 전체 + 오늘 과거 = 흐리게
              const isPast = isPrevDay || (isToday && hour < currentHour && !isSelected);
              const color = STATUS_COLOR[runningIndex.status];
              const barH = Math.max(4, (runningIndex.score / 100) * BAR_MAX);

              // 일자 경계 구분선: 어제→오늘, 오늘→내일
              const prevItem = index > 0 ? forecast[index - 1] : null;
              const showDayDivider =
                (isToday && prevItem?.isPrevDay) ||
                (isNextDay && prevItem && !prevItem.isNextDay);

              // 툴팁 접두사
              const dayPrefix = isPrevDay ? '어제 ' : isNextDay ? '내일 ' : '';

              return (
                <button
                  key={`${isPrevDay ? 'prev' : isNextDay ? 'next' : 'today'}-${hour}`}
                  ref={isNow ? currentBarRef : undefined}
                  type="button"
                  aria-label={`${dayPrefix}${hour}시 러닝지수 ${runningIndex.score}점`}
                  className={cn(
                    'relative flex-1 flex flex-col items-center justify-end gap-0.5 cursor-pointer group',
                    showDayDivider && 'border-l border-dashed border-gray-300 pl-[2px]',
                  )}
                  onClick={() => onHourSelect(hourData)}
                >
                  {/* 호버 툴팁 */}
                  <div
                    role="tooltip"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-gray-800 text-white text-[10px] font-semibold whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                  >
                    {dayPrefix}{hour}시 · {runningIndex.score}점
                  </div>

                  {/* 점수 (현재/선택/추천 시간만 — 어제는 표시 안 함) */}
                  {!isPrevDay && (isNow || isSelected || isBest) && (
                    <span
                      className={cn(
                        'text-[9px] sm:text-[10px] font-bold leading-none',
                        isSelected ? 'text-violet-600'
                          : isNow ? 'text-blue-600'
                          : 'text-emerald-600',
                      )}
                    >
                      {runningIndex.score}
                    </span>
                  )}

                  {/* 바 */}
                  <div
                    className={cn(
                      'w-full rounded-md transition-all duration-300 relative overflow-hidden',
                      color.bar,
                      isSelected && 'ring-1.5 ring-violet-500 ring-offset-1 brightness-110',
                      isNow && !isSelected && 'ring-1.5 ring-blue-500 ring-offset-1',
                      isBest && !isSelected && !isNow && 'shadow-[0_0_6px_rgba(16,185,129,0.6)]',
                      isPast && !isBest && 'opacity-35',
                      isPast && isBest && 'opacity-60',
                      !isNow && !isSelected && 'group-hover:opacity-80 group-hover:brightness-110',
                    )}
                    style={{ height: `${barH}px` }}
                  >
                    {/* 추천 시간대 반짝임 — 어제는 제외 */}
                    {isBest && !isPrevDay && (
                      <div
                        className="absolute inset-0 bg-white rounded-md"
                        style={{
                          animation: 'shimmer 1.5s ease-in-out infinite',
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 시간 라벨 + 추천 도트 (고정 높이, 바와 분리) */}
          <div className="flex gap-[3px] sm:gap-1 mt-1.5">
            {forecast.map(({ hour, isNextDay, isPrevDay }, index) => {
              const isToday = !isPrevDay && !isNextDay;
              const isNow = isToday && hour === currentHour;
              const isSelected = selectedHour === hour;
              const isBest = !isPrevDay && bestHours.includes(hour);

              const prevItem = index > 0 ? forecast[index - 1] : null;
              const showTodayLabel = isToday && prevItem?.isPrevDay;
              const showNextDayLabel = isNextDay && prevItem && !prevItem.isNextDay;

              return (
                <div key={`label-${isPrevDay ? 'prev' : isNextDay ? 'next' : 'today'}-${hour}`} className="flex-1 flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      'text-center text-[9px] sm:text-[10px] leading-none h-3',
                      isSelected ? 'text-violet-600 font-semibold'
                        : isNow ? 'text-blue-600 font-semibold'
                        : isBest ? 'text-emerald-500 font-semibold'
                        : (showTodayLabel || showNextDayLabel) ? 'text-gray-500 font-semibold'
                        : isPrevDay ? 'text-gray-200'
                        : 'text-gray-300',
                    )}
                  >
                    {showTodayLabel ? '오늘'
                      : showNextDayLabel ? '내일'
                      : isSelected || isNow || isBest ? hour
                      : hour % 3 === 0 ? hour
                      : ''}
                  </span>
                  {isBest && (
                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  )}
                </div>
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
