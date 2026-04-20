/**
 * 러닝 지수 상태별 색상 토큰
 *
 * 색상 체계:
 *   great   (최적) → blue
 *   good    (좋음) → emerald
 *   caution (주의) → amber
 *   bad     (자제) → orange
 *   worst   (금지) → red
 *
 * 색상을 변경하려면 이 파일만 수정하면 됩니다.
 */

export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst' | 'unknown'

export interface StatusColorToken {
  /** 카드 배경 그라디언트 (bg-gradient-to-br와 함께 사용) */
  gradient: string
  /** 카드 링 (ring-*) */
  ring: string
  /** 타임라인 바 배경 */
  bar: string
  /** 범례·텍스트 */
  text: string
  /** 약간 연한 텍스트 */
  textMuted: string
  /** 도트 인디케이터 */
  dot: string
  /** 글로우 그림자 */
  glow: string
}

export const STATUS_COLORS: Record<RunningStatus, StatusColorToken> = {
  great: {
    gradient: 'from-blue-400 to-blue-600',
    ring: 'ring-blue-300',
    bar: 'bg-blue-400',
    text: 'text-blue-600',
    textMuted: 'text-blue-500',
    dot: 'bg-blue-400',
    glow: 'shadow-[0_0_6px_rgba(59,130,246,0.6)]',
  },
  good: {
    gradient: 'from-emerald-400 to-emerald-600',
    ring: 'ring-emerald-300',
    bar: 'bg-emerald-400',
    text: 'text-emerald-600',
    textMuted: 'text-emerald-500',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_6px_rgba(52,211,153,0.6)]',
  },
  caution: {
    gradient: 'from-amber-400 to-amber-500',
    ring: 'ring-amber-300',
    bar: 'bg-amber-400',
    text: 'text-amber-600',
    textMuted: 'text-amber-500',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_6px_rgba(251,191,36,0.6)]',
  },
  bad: {
    gradient: 'from-orange-400 to-orange-600',
    ring: 'ring-orange-300',
    bar: 'bg-orange-400',
    text: 'text-orange-600',
    textMuted: 'text-orange-500',
    dot: 'bg-orange-400',
    glow: 'shadow-[0_0_6px_rgba(251,146,60,0.6)]',
  },
  worst: {
    gradient: 'from-red-500 to-red-700',
    ring: 'ring-red-300',
    bar: 'bg-red-400',
    text: 'text-red-600',
    textMuted: 'text-red-500',
    dot: 'bg-red-400',
    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.6)]',
  },
  unknown: {
    gradient: 'from-gray-400 to-gray-600',
    ring: 'ring-gray-300',
    bar: 'bg-gray-300',
    text: 'text-gray-600',
    textMuted: 'text-gray-500',
    dot: 'bg-gray-400',
    glow: 'shadow-[0_0_6px_rgba(156,163,175,0.5)]',
  },
}

/**
 * 특수 UI 색상 (상태와 무관)
 * 최적 시간대 강조는 great(최적)와 동일하게 blue 사용
 */
export const BEST_HOUR_COLORS = {
  text: STATUS_COLORS.great.text,
  textMuted: STATUS_COLORS.great.textMuted,
  dot: STATUS_COLORS.great.dot,
  glow: STATUS_COLORS.great.glow,
  bannerBg: 'bg-blue-50',
  bannerText: 'text-blue-700',
  bannerTextMuted: 'text-blue-500',
} as const

export const CURRENT_HOUR_COLORS = {
  text: 'text-blue-600',
  ring: 'ring-blue-500',
} as const

export const SELECTED_HOUR_COLORS = {
  text: 'text-violet-600',
  ring: 'ring-violet-500',
  ringCard: 'ring-violet-300',
} as const
