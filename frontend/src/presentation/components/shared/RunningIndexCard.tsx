import { cn } from '../../../lib/cn'
import type { RunningIndex, AirQualityMetrics, WeatherInfo } from '../../../domain/entities/airQuality.types'
import { RunnerAvatar } from './RunnerAvatar'

interface RunningIndexCardProps {
  runningIndex: RunningIndex
  airQuality: AirQualityMetrics
  weather?: WeatherInfo
  regionName: string
  updatedAt: Date
  selectedHour: number | null
  onResetHour?: () => void
}

const STATUS_CONFIG = {
  great: {
    bg: 'from-emerald-400 to-emerald-600',
    ring: 'ring-emerald-300',
    icon: '🏃',
    answer: '달려도 됩니다!',
    answerColor: 'text-white',
  },
  good: {
    bg: 'from-blue-400 to-blue-600',
    ring: 'ring-blue-300',
    icon: '👟',
    answer: '달리기 좋아요',
    answerColor: 'text-white',
  },
  caution: {
    bg: 'from-amber-400 to-amber-500',
    ring: 'ring-amber-300',
    icon: '⚠️',
    answer: '주의하며 달리세요',
    answerColor: 'text-white',
  },
  bad: {
    bg: 'from-orange-400 to-orange-600',
    ring: 'ring-orange-300',
    icon: '😷',
    answer: '달리기 자제 권장',
    answerColor: 'text-white',
  },
  worst: {
    bg: 'from-red-500 to-red-700',
    ring: 'ring-red-300',
    icon: '🚫',
    answer: '오늘은 쉬세요',
    answerColor: 'text-white',
  },
}

export function RunningIndexCard({
  runningIndex,
  airQuality,
  weather,
  regionName,
  updatedAt,
  selectedHour,
  onResetHour,
}: RunningIndexCardProps) {
  const config = STATUS_CONFIG[runningIndex.status]

  const formattedTime = updatedAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const isHourSelected = selectedHour !== null
  const timeLabel = isHourSelected ? `${selectedHour}시 예보` : `${formattedTime} 기준`
  const questionLabel = isHourSelected ? `${selectedHour}시에 달려도 되나요?` : '지금 여기서 달려도 되나요?'

  return (
    <div className="animate-slide-up">
      {/* 메인 카드: 지금 달려도 되나요? */}
      <div
        role={isHourSelected ? 'button' : undefined}
        tabIndex={isHourSelected ? 0 : undefined}
        onClick={onResetHour}
        onKeyDown={onResetHour ? (e) => { if (e.key === 'Enter' || e.key === ' ') onResetHour() } : undefined}
        className={cn(
          'relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 sm:p-8 text-white shadow-lg',
          config.bg,
          isHourSelected && 'cursor-pointer ring-2 ring-violet-300 ring-offset-2'
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
            <span className="text-3xl sm:text-4xl shrink-0">{config.icon}</span>
            <h2 className="text-2xl sm:text-4xl font-bold leading-tight">{config.answer}</h2>
          </div>

          {/* 러닝 지수 + 메시지 */}
          <p className="text-white/80 text-xs sm:text-sm mb-4 sm:mb-5 leading-relaxed">{runningIndex.message}</p>

          {/* 점수 게이지 */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white/70 text-xs">러닝 지수</span>
              <span className="text-white font-bold text-lg">{runningIndex.score}</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${runningIndex.score}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/50 text-xs">0</span>
              <span className="text-white/50 text-xs">100</span>
            </div>
          </div>

          {/* 시간 선택 안내 */}
          {isHourSelected && (
            <p className="text-white/60 text-xs mt-1">카드를 탭하면 현재 시간 기준으로 돌아갑니다</p>
          )}

          {/* 대기질 + 기상 요약 칩 */}
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 mt-4 sm:mt-5">
            <AirChip label="초미세" value={airQuality.pm25} unit="μg/m³" threshold={[15, 35, 75]} />
            <AirChip label="미세" value={airQuality.pm10} unit="μg/m³" threshold={[30, 80, 150]} />
            <AirChip label="오존" value={Math.round(airQuality.o3 * 1000)} unit="ppb" threshold={[30, 60, 90]} />
            {weather && (
              <>
                <WeatherChip label="기온" value={`${weather.temperature}°C`} icon={weather.temperature >= 28 ? '🌡️' : weather.temperature <= 5 ? '🥶' : '🌤️'} dot={weather.temperature >= 12 && weather.temperature <= 22 ? 'bg-emerald-300' : weather.temperature >= 5 && weather.temperature <= 28 ? 'bg-amber-300' : 'bg-red-300'} />
                <WeatherChip label="습도" value={`${weather.humidity}%`} icon="💧" dot={weather.humidity >= 40 && weather.humidity <= 60 ? 'bg-emerald-300' : weather.humidity >= 30 && weather.humidity <= 80 ? 'bg-amber-300' : 'bg-red-300'} />
                <WeatherChip label="풍속" value={`${weather.windSpeed}m/s`} icon={weather.windSpeed >= 7 ? '💨' : '🍃'} dot={weather.windSpeed <= 3 ? 'bg-emerald-300' : weather.windSpeed <= 7 ? 'bg-amber-300' : 'bg-red-300'} />
                {weather.precipitation !== 'none' && (
                  <WeatherChip label="강수" value={PRECIP_LABEL[weather.precipitation]} icon={PRECIP_ICON[weather.precipitation]} dot="bg-red-300" />
                )}
              </>
            )}
          {/* 추천 옷차림 */}
          {weather && (
            <div className="mt-4 sm:mt-5 pt-4 border-t border-white/15">
              <RunnerAvatar weather={weather} />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AirChipProps {
  label: string
  value: number
  unit: string
  threshold: [number, number, number] // [good, caution, bad]
}

function AirChip({ label, value, unit, threshold }: AirChipProps) {
  const dot =
    value <= threshold[0]
      ? 'bg-emerald-300'
      : value <= threshold[1]
      ? 'bg-amber-300'
      : value <= threshold[2]
      ? 'bg-orange-300'
      : 'bg-red-300'

  return (
    <div className="rounded-xl px-2 sm:px-3 py-1.5 text-center min-w-0 bg-black/20 backdrop-blur-sm">
      <p className="text-white/90 text-[10px] sm:text-xs font-medium flex items-center justify-center gap-1">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dot)} />
        {label}
      </p>
      <p className="text-white font-bold text-xs sm:text-sm">
        {value} <span className="font-normal text-white/60 text-[10px] sm:text-xs">{unit}</span>
      </p>
    </div>
  )
}

interface WeatherChipProps {
  label: string
  value: string
  dot: string
  icon: string
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
  )
}

const PRECIP_LABEL: Record<string, string> = {
  rain: '비',
  snow: '눈',
  sleet: '진눈깨비',
}

// 향후 강수 아이콘 표시에 사용
const PRECIP_ICON: Record<string, string> = {
  rain: '🌧️',
  snow: '❄️',
  sleet: '🌨️',
}
