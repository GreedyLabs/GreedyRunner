import { cn } from '../../../lib/cn'
import type { RunningIndex, AirQualityMetrics } from '../../../domain/entities/airQuality.types'

interface RunningIndexCardProps {
  runningIndex: RunningIndex
  airQuality: AirQualityMetrics
  regionName: string
  updatedAt: Date
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
  regionName,
  updatedAt,
}: RunningIndexCardProps) {
  const config = STATUS_CONFIG[runningIndex.status]

  const formattedTime = updatedAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="animate-slide-up">
      {/* 메인 카드: 지금 달려도 되나요? */}
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 sm:p-8 text-white shadow-lg',
          config.bg
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
            <span className="text-white/60 text-xs">{formattedTime} 기준</span>
          </div>

          {/* 핵심 질문 + 답변 */}
          <p className="text-white/80 text-sm mb-1">지금 여기서 달려도 되나요?</p>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{config.icon}</span>
            <h2 className="text-3xl sm:text-4xl font-bold">{config.answer}</h2>
          </div>

          {/* 러닝 지수 + 메시지 */}
          <p className="text-white/80 text-sm mb-5">{runningIndex.message}</p>

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

          {/* 대기질 요약 칩 */}
          <div className="flex flex-wrap gap-2 mt-5">
            <AirChip label="PM2.5" value={airQuality.pm25} unit="μg/m³" threshold={[15, 35, 75]} />
            <AirChip label="PM10" value={airQuality.pm10} unit="μg/m³" threshold={[30, 80, 150]} />
            <AirChip label="O₃" value={Math.round(airQuality.o3 * 1000)} unit="ppb" threshold={[30, 60, 90]} />
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
  const chipColor =
    value <= threshold[0]
      ? 'bg-white/30'
      : value <= threshold[1]
      ? 'bg-amber-300/40'
      : value <= threshold[2]
      ? 'bg-orange-400/40'
      : 'bg-red-500/40'

  return (
    <div className={cn('rounded-xl px-3 py-1.5 text-center', chipColor)}>
      <p className="text-white/70 text-xs">{label}</p>
      <p className="text-white font-bold text-sm">
        {value} <span className="font-normal text-white/60 text-xs">{unit}</span>
      </p>
    </div>
  )
}
