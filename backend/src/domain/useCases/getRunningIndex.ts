import type { AirQualityMetrics, RunningIndex, RunningStatus } from '../entities/airQuality'

const STATUS_LABELS: Record<RunningStatus, string> = {
  great:   '달리기 최적',
  good:    '달리기 좋음',
  caution: '주의 필요',
  bad:     '달리기 자제',
  worst:   '달리기 금지',
}

const STATUS_MESSAGES: Record<RunningStatus, string> = {
  great:   '지금 바로 달리세요! 최적의 공기 상태입니다.',
  good:    '달리기에 좋은 환경입니다.',
  caution: '민감한 분들은 주의하세요. 짧은 러닝 권장.',
  bad:     '오늘은 실내 운동을 권장합니다.',
  worst:   '야외 활동을 자제해 주세요.',
}

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
  const penalty =
    pm25Penalty(m.pm25) * 0.5 +
    pm10Penalty(m.pm10) * 0.3 +
    o3Penalty(m.o3)     * 0.2
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}

function pm25Penalty(v: number): number {
  if (v <= 15) return 0
  if (v <= 35) return ((v - 15) / 20) * 40
  if (v <= 75) return 40 + ((v - 35) / 40) * 40
  return 100
}

function pm10Penalty(v: number): number {
  if (v <= 30)  return 0
  if (v <= 80)  return ((v - 30) / 50) * 40
  if (v <= 150) return 40 + ((v - 80) / 70) * 40
  return 100
}

function o3Penalty(v: number): number {
  if (v <= 0.03) return 0
  if (v <= 0.09) return ((v - 0.03) / 0.06) * 50
  return 100
}

function scoreToStatus(score: number): RunningStatus {
  if (score >= 80) return 'great'
  if (score >= 60) return 'good'
  if (score >= 40) return 'caution'
  if (score >= 20) return 'bad'
  return 'worst'
}
