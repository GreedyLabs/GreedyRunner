import type { AirQualityMetrics, RunningIndex, RunningStatus, WeatherInfo } from '../entities/airQuality.types'

/**
 * 대기질 + 기상 정보로 러닝 지수(0~100)를 계산합니다.
 * 점수가 높을수록 달리기 좋은 환경입니다.
 *
 * 가중치: 대기질 70% (PM2.5 35%, PM10 20%, O₃ 15%) + 기상 30% (기온 15%, 습도 10%, 강수 5%)
 * weather가 없으면 대기질만으로 100점 만점 계산 (기존 호환)
 */
export function getRunningIndex(
  metrics: AirQualityMetrics,
  weather?: WeatherInfo
): RunningIndex {
  const score = calculateScore(metrics, weather)
  const status = scoreToStatus(score)

  let message = STATUS_MESSAGES[status]
  if (weather && weather.precipitation !== 'none') {
    const precipLabel = weather.precipitation === 'rain' ? '비' : weather.precipitation === 'snow' ? '눈' : '진눈깨비'
    message = `현재 ${precipLabel}가 내리고 있어 실내 운동을 추천합니다.`
  }

  return {
    score,
    status,
    label: STATUS_LABELS[status],
    message,
    canRun: score >= 40,
  }
}

function calculateScore(m: AirQualityMetrics, w?: WeatherInfo): number {
  if (!w) {
    const penalty =
      getPm25Penalty(m.pm25) * 0.5 +
      getPm10Penalty(m.pm10) * 0.3 +
      getO3Penalty(m.o3)     * 0.2
    return Math.max(0, Math.min(100, Math.round(100 - penalty)))
  }

  const airPenalty =
    getPm25Penalty(m.pm25) * 0.35 +
    getPm10Penalty(m.pm10) * 0.20 +
    getO3Penalty(m.o3)     * 0.15

  const wxPenalty =
    temperaturePenalty(w.temperature) * 0.15 +
    humidityPenalty(w.humidity)       * 0.10 +
    precipitationPenalty(w.precipitation) * 0.05

  return Math.max(0, Math.min(100, Math.round(100 - airPenalty - wxPenalty)))
}

// ── 대기질 페널티 ────────────────────────────────────────────

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

// ── 기상 페널티 ──────────────────────────────────────────────

function temperaturePenalty(temp: number): number {
  if (temp >= 12 && temp <= 22) return 0
  if (temp >= 5 && temp < 12) return ((12 - temp) / 7) * 30
  if (temp > 22 && temp <= 28) return ((temp - 22) / 6) * 30
  if (temp >= 0 && temp < 5) return 30 + ((5 - temp) / 5) * 40
  if (temp > 28 && temp <= 35) return 30 + ((temp - 28) / 7) * 40
  return 100
}

function humidityPenalty(hum: number): number {
  if (hum >= 40 && hum <= 60) return 0
  if (hum >= 30 && hum < 40) return ((40 - hum) / 10) * 20
  if (hum > 60 && hum <= 80) return ((hum - 60) / 20) * 30
  if (hum > 80) return 30 + ((Math.min(hum, 100) - 80) / 20) * 70
  return 30
}

function precipitationPenalty(precip: string): number {
  switch (precip) {
    case 'none': return 0
    case 'rain': return 80
    case 'sleet': return 90
    case 'snow': return 100
    default: return 0
  }
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
