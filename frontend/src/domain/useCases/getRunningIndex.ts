import type { AirQualityMetrics, RunningIndex, RunningStatus } from '../entities/airQuality.types'

/**
 * 대기질 수치로 러닝 지수(0~100)를 계산합니다.
 * 점수가 높을수록 달리기 좋은 환경입니다.
 */
export function getRunningIndex(metrics: AirQualityMetrics): RunningIndex {
  const score = calculateScore(metrics)
  const status = scoreToStatus(score)

  return {
    score,
    status,
    label: STATUS_LABELS[status],
    message: STATUS_MESSAGES[status],
    canRun: score >= 40,
  }
}

function calculateScore(m: AirQualityMetrics): number {
  // PM2.5 페널티 (가중치 50%)
  const pm25Penalty = getPm25Penalty(m.pm25) * 0.5

  // PM10 페널티 (가중치 30%)
  const pm10Penalty = getPm10Penalty(m.pm10) * 0.3

  // O3 페널티 (가중치 20%)
  const o3Penalty = getO3Penalty(m.o3) * 0.2

  const totalPenalty = pm25Penalty + pm10Penalty + o3Penalty
  return Math.max(0, Math.min(100, Math.round(100 - totalPenalty)))
}

function getPm25Penalty(pm25: number): number {
  if (pm25 <= 15) return 0
  if (pm25 <= 35) return ((pm25 - 15) / 20) * 40
  if (pm25 <= 75) return 40 + ((pm25 - 35) / 40) * 40
  return 100
}

function getPm10Penalty(pm10: number): number {
  if (pm10 <= 30) return 0
  if (pm10 <= 80) return ((pm10 - 30) / 50) * 40
  if (pm10 <= 150) return 40 + ((pm10 - 80) / 70) * 40
  return 100
}

function getO3Penalty(o3: number): number {
  if (o3 <= 0.03) return 0
  if (o3 <= 0.09) return ((o3 - 0.03) / 0.06) * 50
  return 100
}

function scoreToStatus(score: number): RunningStatus {
  if (score >= 80) return 'great'
  if (score >= 60) return 'good'
  if (score >= 40) return 'caution'
  if (score >= 20) return 'bad'
  return 'worst'
}

const STATUS_LABELS: Record<RunningStatus, string> = {
  great: '달리기 최적',
  good: '달리기 좋음',
  caution: '주의 필요',
  bad: '달리기 자제',
  worst: '달리기 금지',
}

const STATUS_MESSAGES: Record<RunningStatus, string> = {
  great: '지금 바로 달리세요! 최적의 공기 상태입니다.',
  good: '달리기에 좋은 환경입니다.',
  caution: '민감한 분들은 주의하세요. 짧은 러닝 권장.',
  bad: '오늘은 실내 운동을 권장합니다.',
  worst: '야외 활동을 자제해 주세요.',
}
