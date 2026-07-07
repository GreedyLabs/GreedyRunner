import { useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import type { HourlyForecast as HourlyForecastType } from '../../../domain/entities/airQuality.types';
import { cn } from '../../../lib/cn';

interface BestHour {
  hour: number;
  isNextDay: boolean;
}

interface HourlyForecastProps {
  forecast: HourlyForecastType[];
  bestHours: BestHour[];
  selectedHour: number | null;
  onHourSelect: (hourData: HourlyForecastType) => void;
}

const BAR_MAX = 92;

export function HourlyForecast({
  forecast,
  bestHours,
  selectedHour,
  onHourSelect,
}: HourlyForecastProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentBarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !currentBarRef.current) return;
    const container = scrollRef.current;
    const bar = currentBarRef.current;
    const scrollLeft = bar.offsetLeft - container.clientWidth / 2 + bar.clientWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [forecast]);

  function isBestHour(hour: number, isNextDay?: boolean): boolean {
    return bestHours.some((b) => b.hour === hour && b.isNextDay === !!isNextDay);
  }

  return (
    <Card className="animate-slide-up">
      {/* 바 차트 */}
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto -mx-1 px-1">
        <div style={{ minWidth: '540px' }} className="pt-7">
          {/* 바 영역 */}
          <div className="flex items-end gap-[3px] sm:gap-1.5" style={{ height: BAR_MAX }}>
            {forecast.map((hourData, index) => {
              const { hour, runningIndex, isNextDay } = hourData;
              const isNow = index === 0;
              const isBest = isBestHour(hour, isNextDay);
              const isSelected = selectedHour === hour;
              const barH = Math.max(6, (runningIndex.score / 100) * BAR_MAX);

              // 색은 프로토타입과 동일한 3단계: 추천→accent, 현재→ink, 그 외→bar(중립 회색)
              const barColor = isBest ? 'bg-accent' : isNow ? 'bg-ink' : 'bg-bar';
              const showScore = isNow || isBest || isSelected;

              const prevItem = index > 0 ? forecast[index - 1] : null;
              const showDayDivider = isNextDay && prevItem && !prevItem.isNextDay;
              const dayPrefix = isNextDay ? '내일 ' : '';

              return (
                <button
                  key={`${isNextDay ? 'next' : 'today'}-${hour}`}
                  ref={isNow ? currentBarRef : undefined}
                  type="button"
                  aria-label={`${dayPrefix}${hour}시 러닝지수 ${runningIndex.score}점`}
                  className={cn(
                    'group relative flex-1 flex flex-col items-center gap-1.5 cursor-pointer',
                    showDayDivider && 'border-l border-dashed border-line pl-[2px]',
                  )}
                  onClick={() => onHourSelect(hourData)}
                >
                  {/* 점수 (현재/추천/선택 시간) */}
                  {showScore && (
                    <span
                      className={cn(
                        'absolute -top-5 text-[10px] font-bold leading-none',
                        isBest ? 'text-accent' : 'text-ink',
                      )}
                    >
                      {runningIndex.score}
                    </span>
                  )}

                  {/* 바 */}
                  <div
                    className={cn(
                      'w-full rounded-[5px] transition-all duration-300',
                      barColor,
                      isSelected && 'ring-2 ring-ink ring-offset-2 ring-offset-panel',
                      !isSelected && 'group-hover:opacity-80',
                    )}
                    style={{ height: `${barH}px` }}
                  />
                </button>
              );
            })}
          </div>

          {/* 시간 라벨 */}
          <div className="flex gap-[3px] sm:gap-1.5 mt-1.5">
            {forecast.map(({ hour, isNextDay }, index) => {
              const isNow = index === 0;
              const isSelected = selectedHour === hour;
              const isBest = isBestHour(hour, isNextDay);

              const prevItem = index > 0 ? forecast[index - 1] : null;
              const showNextDayLabel = isNextDay && prevItem && !prevItem.isNextDay;

              return (
                <div key={`label-${isNextDay ? 'next' : 'today'}-${hour}`} className="flex-1 flex justify-center">
                  <span
                    className={cn(
                      'text-center text-[9px] leading-none h-3',
                      isNow ? 'text-ink font-bold'
                        : isBest ? 'text-accent font-bold'
                        : isSelected ? 'text-ink font-semibold'
                        : showNextDayLabel ? 'text-muted font-semibold'
                        : 'text-faint',
                    )}
                  >
                    {showNextDayLabel ? '내일'
                      : isSelected || isNow || isBest ? hour
                      : hour % 3 === 0 ? hour
                      : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex gap-3.5 mt-4 pt-3.5 border-t border-line">
        {([
          { c: 'bg-accent', label: '추천' },
          { c: 'bg-ink', label: '현재' },
          { c: 'bg-bar', label: '그 외' },
        ] as const).map(({ c, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('w-2.5 h-2.5 rounded-[3px]', c)} />
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}
