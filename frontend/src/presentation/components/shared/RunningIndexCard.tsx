import { cn } from '../../../lib/cn';
import { STATUS_COLORS } from '../../../lib/runningStatusColors';
import type {
  RunningIndex,
  AirQualityMetrics,
  WeatherInfo,
} from '../../../domain/entities/airQuality.types';
import { RunnerAvatar } from './RunnerAvatar';

interface RunningIndexCardProps {
  runningIndex: RunningIndex;
  airQuality: AirQualityMetrics;
  weather?: WeatherInfo;
  regionName: string;
  updatedAt: Date;
  selectedHour: number | null;
  selectedDayLabel?: '내일';
  onResetHour?: () => void;
}

const STATUS_CONTENT = {
  great: { icon: '🏃', answer: '달리기 좋아요!' },
  good: { icon: '👟', answer: '달려도 괜찮아요' },
  caution: { icon: '⚠️', answer: '주의하며 달리세요' },
  bad: { icon: '😷', answer: '달리기 자제 권장' },
  worst: { icon: '🚫', answer: '오늘은 쉬세요' },
  unknown: { icon: '❔', answer: '측정 불가' },
};

export function RunningIndexCard({
  runningIndex,
  airQuality,
  weather,
  regionName,
  updatedAt,
  selectedHour,
  selectedDayLabel,
  onResetHour,
}: RunningIndexCardProps) {
  const colors = STATUS_COLORS[runningIndex.status];
  const content = STATUS_CONTENT[runningIndex.status];

  const formattedTime = updatedAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isHourSelected = selectedHour !== null;
  const dayPrefix = selectedDayLabel ? `${selectedDayLabel} ` : '';
  const timeLabel = isHourSelected ? `${dayPrefix}${selectedHour}시 예보` : `${formattedTime} 측정`;
  const questionLabel = isHourSelected
    ? `${dayPrefix}${selectedHour}시에 달려도 되나요?`
    : '지금 여기서 달려도 되나요?';

  return (
    <div className="animate-slide-up">
      {/* 메인 카드: 지금 달려도 되나요? */}
      <div
        role={isHourSelected ? 'button' : undefined}
        tabIndex={isHourSelected ? 0 : undefined}
        onClick={onResetHour}
        onKeyDown={
          onResetHour
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onResetHour();
              }
            : undefined
        }
        className={cn(
          'relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 sm:p-8 text-white shadow-lg',
          colors.gradient,
          isHourSelected && 'cursor-pointer ring-2 ring-violet-300 ring-offset-2',
        )}
      >
        {/* 배경 장식 원 */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />

        <div className="relative z-10">
          {/* 지역명 + 업데이트 시각 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-sm">📍</span>
              <span className="text-white/90 text-sm font-medium">{regionName}</span>
            </div>
            <span className="text-white/60 text-xs">{timeLabel}</span>
          </div>

          {/* 핵심 질문 + 답변 */}
          <p className="text-white/80 text-xs sm:text-sm mb-1">{questionLabel}</p>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <span className="text-3xl sm:text-4xl shrink-0">{content.icon}</span>
            <h2 className="text-2xl sm:text-4xl font-bold leading-tight">{content.answer}</h2>
          </div>

          {/* 러닝 지수 + 메시지 */}
          <p className="text-white/80 text-xs sm:text-sm mb-4 sm:mb-5 leading-relaxed">
            {runningIndex.message}
          </p>

          {/* 점수 게이지 — 'unknown'일 때는 게이지를 비우고 점수 대신 '—'를 표시 */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white/70 text-xs">러닝 지수</span>
              <span className="text-white font-bold text-lg">
                {runningIndex.status === 'unknown' ? '—' : runningIndex.score}
              </span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: runningIndex.status === 'unknown' ? '0%' : `${runningIndex.score}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/50 text-xs">0</span>
              <span className="text-white/50 text-xs">100</span>
            </div>
          </div>

          {/* 시간 선택 안내 */}
          {isHourSelected && (
            <p className="text-white/60 text-xs mt-1">
              카드를 탭하면 현재 시간 기준으로 돌아갑니다
            </p>
          )}

          {/* 대기질 + 기상 요약 칩 */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-4 sm:mt-5">
            <AirChip label="초미세" value={airQuality.pm25} unit="μg/m³" threshold={[15, 35, 75]} />
            <AirChip label="미세" value={airQuality.pm10} unit="μg/m³" threshold={[30, 80, 150]} />
            <AirChip
              label="오존"
              value={airQuality.o3 == null ? null : Math.round(airQuality.o3 * 1000)}
              unit="ppb"
              threshold={[30, 60, 90]}
            />
            {weather && (
              <>
                <WeatherChip
                  label="기온"
                  value={`${weather.temperature}°C`}
                  icon={weather.temperature >= 28 ? '🌡️' : weather.temperature <= 5 ? '🥶' : '🌤️'}
                  dot={
                    weather.temperature >= 12 && weather.temperature <= 22
                      ? 'bg-emerald-300'
                      : weather.temperature >= 5 && weather.temperature <= 28
                        ? 'bg-amber-300'
                        : 'bg-red-300'
                  }
                />
                <WeatherChip
                  label="습도"
                  value={`${weather.humidity}%`}
                  icon="💧"
                  dot={
                    weather.humidity >= 40 && weather.humidity <= 60
                      ? 'bg-emerald-300'
                      : weather.humidity >= 30 && weather.humidity <= 80
                        ? 'bg-amber-300'
                        : 'bg-red-300'
                  }
                />
                <WeatherChip
                  label="풍속"
                  value={`${weather.windSpeed}m/s`}
                  icon={weather.windSpeed >= 7 ? '💨' : '🍃'}
                  dot={
                    weather.windSpeed <= 3
                      ? 'bg-emerald-300'
                      : weather.windSpeed <= 7
                        ? 'bg-amber-300'
                        : 'bg-red-300'
                  }
                />
                {weather.precipitation !== 'none' && (
                  <WeatherChip
                    label="강수"
                    value={PRECIP_LABEL[weather.precipitation]}
                    icon={PRECIP_ICON[weather.precipitation]}
                    dot="bg-red-300"
                  />
                )}
                {weather.uvIndex != null && (
                  <WeatherChip
                    label="UV"
                    value={String(weather.uvIndex)}
                    icon={weather.uvIndex >= 8 ? '🔥' : weather.uvIndex >= 6 ? '☀️' : '🌤️'}
                    dot={
                      weather.uvIndex <= 2
                        ? 'bg-emerald-300'
                        : weather.uvIndex <= 5
                          ? 'bg-amber-300'
                          : weather.uvIndex <= 7
                            ? 'bg-orange-300'
                            : 'bg-red-300'
                    }
                  />
                )}
              </>
            )}
          </div>

          {/* 추천 옷차림 */}
          {weather && (
            <div className="mt-4 sm:mt-5 pt-4 border-t border-white/15">
              <RunnerAvatar weather={weather} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AirChipProps {
  label: string;
  /** `null`이면 "측정 불가"로 표시 (측정소 결측 상태) */
  value: number | null;
  unit: string;
  threshold: [number, number, number]; // [good, caution, bad]
}

function AirChip({ label, value, unit, threshold }: AirChipProps) {
  const isMissing = value == null;
  const dot = isMissing
    ? 'bg-gray-300'
    : value <= threshold[0]
      ? 'bg-emerald-300'
      : value <= threshold[1]
        ? 'bg-amber-300'
        : value <= threshold[2]
          ? 'bg-orange-300'
          : 'bg-red-300';

  return (
    <div className="rounded-xl px-2 sm:px-3 py-1.5 text-center min-w-0 bg-black/20 backdrop-blur-sm">
      <p className="text-white/90 text-[10px] sm:text-xs font-medium flex items-center justify-center gap-1">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dot)} />
        {label}
      </p>
      <p className="text-white font-bold text-xs sm:text-sm">
        {isMissing ? '—' : value}{' '}
        <span className="font-normal text-white/60 text-[10px] sm:text-xs">
          {isMissing ? '측정 불가' : unit}
        </span>
      </p>
    </div>
  );
}

interface WeatherChipProps {
  label: string;
  value: string;
  dot: string;
  icon: string;
}

function WeatherChip({ label, value, dot, icon }: WeatherChipProps) {
  return (
    <div className="rounded-xl px-2 sm:px-3 py-1.5 text-center bg-black/20 backdrop-blur-sm min-w-0">
      <p className="text-white/90 text-[10px] sm:text-xs font-medium flex items-center justify-center gap-1">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dot)} />
        {label}
      </p>
      <p className="text-white font-bold text-xs sm:text-sm">
        {icon} {value}
      </p>
    </div>
  );
}

const PRECIP_LABEL: Record<string, string> = {
  rain: '비',
  snow: '눈',
  sleet: '진눈깨비',
};

// 향후 강수 아이콘 표시에 사용
const PRECIP_ICON: Record<string, string> = {
  rain: '🌧️',
  snow: '❄️',
  sleet: '🌨️',
};
