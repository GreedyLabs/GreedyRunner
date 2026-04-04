import type { AirQualityMetrics, RunningIndex, RunningStatus, WeatherInfo } from '../entities/airQuality'

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

/**
 * 대기질 + 기상 정보로 달리기 지수(0~100)를 계산합니다.
 *
 * 가중치 배분:
 *   대기질 70% — PM2.5(35%), PM10(20%), O₃(15%)
 *   기상   30% — 기온(15%), 습도(10%), 강수(5%)
 *
 * weather가 없으면 대기질만으로 100점 만점 계산 (기존 호환)
 */
export function getRunningIndex(
  metrics: AirQualityMetrics,
  weather?: WeatherInfo
): RunningIndex {
  const score = calculateScore(metrics, weather)
  const status = scoreToStatus(score)

  // 비/눈이면 메시지 오버라이드
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
  const pm25P = pm25Penalty(m.pm25)
  const pm10P = pm10Penalty(m.pm10)
  const o3P   = o3Penalty(m.o3)

  if (!w) {
    // 기상 데이터 없으면 대기질만으로 계산 (기존 호환)
    const basePenalty = pm25P * 0.5 + pm10P * 0.3 + o3P * 0.2
    const totalPenalty = applyCompoundPenalty(basePenalty, [pm25P, pm10P, o3P])
    return Math.max(0, Math.min(100, Math.round(100 - totalPenalty)))
  }

  const tempP   = temperaturePenalty(w.temperature)
  const humP    = humidityPenalty(w.humidity)
  const windP   = windSpeedPenalty(w.windSpeed)
  const precipP = precipitationPenalty(w.precipitation)

  // 대기질 70% + 기상 30%
  const basePenalty =
    pm25P * 0.35 + pm10P * 0.20 + o3P * 0.15 +
    tempP * 0.12 + humP  * 0.08 + windP * 0.05 + precipP * 0.05

  const compoundPenalty = applyCompoundPenalty(
    basePenalty,
    [pm25P, pm10P, o3P, tempP, humP, windP, precipP]
  )

  // 강수 강제 감점 (가중치와 별개로 적용)
  const precipBonus = precipitationForcePenalty(w.precipitation)

  return Math.max(0, Math.min(100, Math.round(100 - compoundPenalty - precipBonus)))
}

/**
 * 복합 악화 보정: 개별 페널티 > 25인 항목이 2개 이상이면 추가 감점.
 * 여러 항목이 동시에 나쁠수록 감점 폭이 커집니다.
 */
function applyCompoundPenalty(basePenalty: number, rawPenalties: number[]): number {
  const significant = rawPenalties.filter(p => p > 25)
  if (significant.length < 2) return basePenalty

  const avgSeverity = significant.reduce((a, b) => a + b, 0) / (significant.length * 100)
  const compound = significant.length * avgSeverity * 20

  return basePenalty + compound
}

// ── 대기질 페널티 (0~100) ────────────────────────────────────

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

// ── 기상 페널티 (0~100) ──────────────────────────────────────

/** 기온 최적: 12~22°C, 10°C 미만 또는 28°C 초과에서 급격히 감점 */
function temperaturePenalty(temp: number): number {
  if (temp >= 12 && temp <= 22) return 0
  if (temp >= 5 && temp < 12) return ((12 - temp) / 7) * 30
  if (temp > 22 && temp <= 28) return ((temp - 22) / 6) * 30
  if (temp >= 0 && temp < 5) return 30 + ((5 - temp) / 5) * 40
  if (temp > 28 && temp <= 35) return 30 + ((temp - 28) / 7) * 40
  return 100  // 영하 or 35°C 이상
}

/** 습도 최적: 40~60%, 너무 높거나 낮으면 감점 */
function humidityPenalty(hum: number): number {
  if (hum >= 40 && hum <= 60) return 0
  if (hum >= 30 && hum < 40) return ((40 - hum) / 10) * 20
  if (hum > 60 && hum <= 80) return ((hum - 60) / 20) * 30
  if (hum > 80) return 30 + ((Math.min(hum, 100) - 80) / 20) * 70
  return 30 // 30% 미만
}

/** 풍속: 3m/s 이하 쾌적, 7m/s 이상 불편, 10m/s 이상 위험 */
function windSpeedPenalty(ws: number): number {
  if (ws <= 3) return 0
  if (ws <= 7) return ((ws - 3) / 4) * 20
  if (ws <= 10) return 20 + ((ws - 7) / 3) * 30
  return 50 + ((Math.min(ws, 15) - 10) / 5) * 50
}

/** 비/눈이면 큰 감점 */
function precipitationPenalty(precip: 'none' | 'rain' | 'snow' | 'sleet'): number {
  switch (precip) {
    case 'none': return 0
    case 'rain': return 80
    case 'sleet': return 90
    case 'snow': return 100
  }
}

/** 강수 강제 감점 — 가중치와 별개로 직접 차감 */
function precipitationForcePenalty(precip: 'none' | 'rain' | 'snow' | 'sleet'): number {
  switch (precip) {
    case 'rain': return 15
    case 'sleet': return 25
    case 'snow': return 30
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
