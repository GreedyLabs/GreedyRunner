/**
 * 러닝 지수 상태 색상 시스템
 *
 * 연결된 플로우 리디자인(홈·시간대·준비물·팁)은 중립 뉴트럴 + 에메랄드 액센트
 * 한 벌로 통일한다. 상태는 아래 3단계 톤(accent/warn/critical/muted)으로만
 * 매핑하며, 색을 바꾸려면 이 파일과 index.css의 CSS 변수만 수정하면 된다.
 * (이전의 blue/emerald/amber/orange/red 5색 스케일은 프로토타입과 어긋나
 *  제거됨 — 시간대 차트는 추천/현재/그 외 3색으로 단순화.)
 */

export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst' | 'unknown'

/**
 * Flat 3-tone semantic mapping used by the redesigned connected flow (score
 * card, condition grid, gear/tip screens, hourly timeline).
 */
export type StatusTone = 'accent' | 'warn' | 'critical' | 'muted'

export const STATUS_TONE: Record<RunningStatus, StatusTone> = {
  great: 'accent',
  good: 'accent',
  caution: 'warn',
  bad: 'critical',
  worst: 'critical',
  unknown: 'muted',
}

export const TONE_CLASSES: Record<StatusTone, { text: string; badgeBg: string; bar: string }> = {
  accent: { text: 'text-accent', badgeBg: 'bg-accent-soft', bar: 'bg-accent' },
  warn: { text: 'text-warn', badgeBg: 'bg-warn-soft', bar: 'bg-warn' },
  critical: { text: 'text-critical', badgeBg: 'bg-critical-soft', bar: 'bg-critical' },
  muted: { text: 'text-muted', badgeBg: 'bg-panel', bar: 'bg-bar' },
}
