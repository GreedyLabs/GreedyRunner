import type { AirQualityMetrics, RunningIndex, RunningStatus, WeatherInfo } from '../entities/airQuality'

const STATUS_LABELS: Record<RunningStatus, string> = {
  great:   '달리기 최적',
  good:    '달리기 좋음',
  caution: '주의 필요',
  bad:     '달리기 자제',
  worst:   '달리기 금지',
  unknown: '측정 불가',
}

const STATUS_MESSAGES: Record<RunningStatus, string> = {
  great:   '지금 바로 달리세요! 최적의 공기 상태입니다.',
  good:    '달리기에 좋은 환경입니다.',
  caution: '민감한 분들은 주의하세요. 짧은 러닝 권장.',
  bad:     '오늘은 실내 운동을 권장합니다.',
  worst:   '야외 활동을 자제해 주세요.',
  unknown: '측정소 점검 등으로 대기질 데이터를 가져올 수 없습니다.',
}

const UNKNOWN_RUNNING_INDEX: RunningIndex = {
  score: 0,
  status: 'unknown',
  label: STATUS_LABELS.unknown,
  message: STATUS_MESSAGES.unknown,
  canRun: false,
}

/**
 * 대기질 + 기상 정보로 달리기 지수(0~100)를 계산합니다.
 *
 * 가중치 배분:
 *   대기질 70% — PM2.5(35%), PM10(20%), O₃(15%)
 *   기상   30% — 기온(15%), 습도(10%), 강수(5%)
 *
 * weather가 없으면 대기질만으로 100점 만점 계산 (기존 호환)
 *
 * hour를 전달하면 야간(20~06시) O₃ 페널티를 감경합니다.
 * — 광화학 반응이 멎어 실제 O₃ 농도가 낮 대비 매우 낮고, 러닝 중 생리적 영향도 작아
 *   고정 임계값을 그대로 적용하면 센서 잔류값이나 교외 배경 농도에 과도하게 감점됩니다.
 */
export function getRunningIndex(
  metrics: AirQualityMetrics,
  weather?: WeatherInfo,
  hour?: number,
): RunningIndex {
  // 대기질 핵심 지표(PM2.5·PM10)가 결측이면 점수를 계산할 수 없다.
  // 0으로 간주하면 "깨끗한 공기"로 오해석되어 잘못된 100점이 나올 수 있으므로,
  // 'unknown' 상태로 반환해 UI가 별도로 표시하게 한다.
  if (metrics.pm25 == null || metrics.pm10 == null) {
    return UNKNOWN_RUNNING_INDEX
  }

  let score = calculateScore(metrics, weather, hour)

  // 야간 감점 (23~04시) — 시야 불량·안전 위험으로 추천에서 밀려나도록
  const isNight = hour !== undefined && (hour >= 23 || hour < 4)
  if (isNight) {
    score = Math.max(0, score - 20)
  }

  const status = scoreToStatus(score)

  // 메시지 오버라이드: 야간 > 강수 > 기본
  let message = STATUS_MESSAGES[status]
  if (isNight) {
    message = '야간 시간대입니다. 시야 확보가 어려워 주의가 필요합니다.'
  } else if (weather && weather.precipitation !== 'none') {
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

function calculateScore(m: AirQualityMetrics, w?: WeatherInfo, hour?: number): number {
  // 호출부(getRunningIndex)에서 pm25/pm10 null 케이스는 이미 'unknown' 반환으로 걸렀으므로
  // 이 지점에서는 둘 다 number라고 가정할 수 있다. o3는 결측이면 0 페널티(미기여)로 처리.
  const pm25P = pm25Penalty(m.pm25 as number)
  const pm10P = pm10Penalty(m.pm10 as number)
  const o3P   = m.o3 != null ? o3Penalty(m.o3, hour) : 0

  if (!w) {
    // 기상 데이터 없으면 대기질만으로 계산 (가중치 재분배: PM2.5 50%, PM10 30%, O3 20%)
    const basePenalty = pm25P * 0.5 + pm10P * 0.3 + o3P * 0.2
    const totalPenalty = applyCompoundPenalty(basePenalty, [pm25P, pm10P, o3P])
    const rawScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)))
    // 극단값 cap은 기상 유무와 무관하게 적용되어야 한다.
    // (예: PM10 > 150이면 기상 데이터가 없어도 '달리기 자제' 이하로 제한)
    return applyExtremeCap(rawScore, m, undefined, hour)
  }

  const tempP   = temperaturePenalty(w.temperature)
  const humP    = humidityPenalty(w.humidity)
  const windP   = windSpeedPenalty(w.windSpeed)
  const precipP = precipitationPenalty(w.precipitation)
  const uvP     = w.uvIndex != null ? uvPenalty(w.uvIndex, hour) : null

  // 대기질 70% + 기상 30%
  // UV 데이터가 있으면 기온·습도에서 5%를 덜어 UV에 배분
  const basePenalty = uvP != null
    ? pm25P * 0.35 + pm10P * 0.20 + o3P * 0.15 +
      tempP * 0.10 + humP  * 0.05 + windP * 0.05 + precipP * 0.05 + uvP * 0.05
    : pm25P * 0.35 + pm10P * 0.20 + o3P * 0.15 +
      tempP * 0.12 + humP  * 0.08 + windP * 0.05 + precipP * 0.05

  const allPenalties = uvP != null
    ? [pm25P, pm10P, o3P, tempP, humP, windP, precipP, uvP]
    : [pm25P, pm10P, o3P, tempP, humP, windP, precipP]

  const compoundPenalty = applyCompoundPenalty(basePenalty, allPenalties)

  // 강수 강제 감점 (가중치와 별개로 적용)
  const precipBonus = precipitationForcePenalty(w.precipitation)

  // UV-열 복합 강제 감점 (가중치와 별개로 적용)
  const uvHeatBonus = uvHeatForcePenalty(w.temperature, w.uvIndex, w.humidity, hour)

  const rawScore = Math.max(0, Math.min(100, Math.round(100 - compoundPenalty - precipBonus - uvHeatBonus)))
  return applyExtremeCap(rawScore, m, w, hour)
}

/**
 * 단일 항목이 극단적일 때 최종 점수의 상한을 제한한다.
 * 가중치 합산만으로는 한 항목이 극심(예: PM2.5 > 75)이어도 다른 값이 좋으면
 * '달리기 좋음'이 나올 수 있어, 실제 위험을 반영하지 못하는 문제를 보정한다.
 */
function applyExtremeCap(score: number, m: AirQualityMetrics, w?: WeatherInfo, hour?: number): number {
  let cap = 100

  // 미세먼지 — "나쁨" 구간 내에서도 "매우나쁨" 경계에 가까울수록 cap을 선형으로 낮춘다.
  // 계단식(81~150 전부 cap 55) 방식은 경계값(예: PM10=139)을 과소평가하는 문제가 있어
  // 구간 내에서도 부드럽게 35까지 내려가도록 보간한다.
  // (pm25/pm10 null은 getRunningIndex에서 'unknown'으로 걸러지므로 여기서는 number 보장)
  if (m.pm25 != null) cap = Math.min(cap, pm25Cap(m.pm25))
  if (m.pm10 != null) cap = Math.min(cap, pm10Cap(m.pm10))

  if (!w) return Math.round(Math.min(score, cap))

  // 자외선 — 낮 시간대에만 (야간에는 물리적으로 0)
  const isDaytime = hour === undefined || (hour >= 6 && hour < 20)
  if (w.uvIndex != null && isDaytime) {
    if (w.uvIndex >= 11) cap = Math.min(cap, 35)
    else if (w.uvIndex >= 8) cap = Math.min(cap, 55)
  }

  // 강수 — 눈/진눈깨비는 노면 위험이 커 bad, 비는 caution
  if (w.precipitation === 'snow' || w.precipitation === 'sleet') cap = Math.min(cap, 30)
  else if (w.precipitation === 'rain') cap = Math.min(cap, 45)

  // 극한 기온 — 영하 또는 35°C 이상
  if (w.temperature <= 0 || w.temperature >= 35) cap = Math.min(cap, 30)

  return Math.round(Math.min(score, cap))
}

/**
 * PM2.5 값에 따른 최종 점수 상한.
 * 35(나쁨 시작)에서 55, 75(매우나쁨 경계)에서 35로 선형 보간 후 이후는 35 고정.
 *   PM2.5 =  36 → cap 55   (caution 상단)
 *   PM2.5 =  55 → cap 45   (caution 하단)
 *   PM2.5 =  75 → cap 35   (bad 진입)
 *   PM2.5 >  75 → cap 35
 */
function pm25Cap(v: number): number {
  if (v <= 35) return 100
  if (v >= 75) return 35
  return 55 - ((v - 35) / 40) * 20
}

/**
 * PM10 값에 따른 최종 점수 상한.
 * 80(나쁨 시작)에서 55, 150(매우나쁨 경계)에서 35로 선형 보간 후 이후는 35 고정.
 *   PM10 =  81 → cap 55   (caution 상단)
 *   PM10 = 139 → cap 38   (bad)
 *   PM10 = 150 → cap 35   (bad)
 *   PM10 > 150 → cap 35
 */
function pm10Cap(v: number): number {
  if (v <= 80) return 100
  if (v >= 150) return 35
  return 55 - ((v - 80) / 70) * 20
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

/**
 * 야간(20~06시)에는 광화학 반응이 멎어 실제 O₃ 농도가 낮 대비 매우 낮다.
 * 고정 임계값(0.03 ppm~)을 그대로 적용하면 센서 잔류값·교외 배경 농도에 과도 감점되므로
 * hour가 야간 구간일 때 페널티를 30%로 감경한다.
 */
function o3Penalty(v: number, hour?: number): number {
  const base =
    v <= 0.03 ? 0
    : v <= 0.09 ? ((v - 0.03) / 0.06) * 50
    : 100

  if (hour !== undefined && (hour >= 20 || hour < 7)) {
    return base * 0.3
  }
  return base
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

/**
 * 습도 최적: 40~60%
 * 저습(건조)은 목·기도 자극이 있지만 체온 조절에는 오히려 유리하므로 감점을 낮게 잡는다.
 * 고습은 땀 증발이 안 돼 열사병 위험이 커지므로 감점을 크게 잡는다.
 */
function humidityPenalty(hum: number): number {
  if (hum >= 40 && hum <= 60) return 0
  if (hum >= 30 && hum < 40) return ((40 - hum) / 10) * 10   // 0~10 (경미)
  if (hum >= 20 && hum < 30) return 10 + ((30 - hum) / 10) * 10 // 10~20 (건조)
  if (hum < 20) return 20                                      // 극건조 상한 20
  if (hum > 60 && hum <= 80) return ((hum - 60) / 20) * 30    // 0~30
  return 30 + ((Math.min(hum, 100) - 80) / 20) * 70           // 30~100 (고습 위험)
}

/** 풍속: 3m/s 이하 쾌적, 7m/s 이상 불편, 10m/s 이상 위험 */
function windSpeedPenalty(ws: number): number {
  if (ws <= 3) return 0
  if (ws <= 7) return ((ws - 3) / 4) * 20
  if (ws <= 10) return 20 + ((ws - 7) / 3) * 30
  return 50 + ((Math.min(ws, 15) - 10) / 5) * 50
}

/**
 * 자외선지수 페널티 (0~100).
 * 야간(20~06시)에는 UV가 물리적으로 0이므로 페널티를 0으로 고정한다.
 * 등급: 0~2 낮음, 3~5 보통, 6~7 높음, 8~10 매우높음, 11+ 위험
 */
function uvPenalty(uv: number, hour?: number): number {
  // 야간 → UV 물리적 0
  if (hour !== undefined && (hour >= 20 || hour < 6)) return 0

  if (uv <= 2) return 0
  if (uv <= 5) return ((uv - 2) / 3) * 20          // 0~20
  if (uv <= 7) return 20 + ((uv - 5) / 2) * 30     // 20~50
  if (uv <= 10) return 50 + ((uv - 7) / 3) * 30    // 50~80
  return 100                                         // 11+
}

/**
 * UV-열 복합 강제 감점.
 * UV가 높은(≥6) 날 기온이 20°C 이상이면 피부 온도 상승으로 체온 조절 부담이 커져
 * 체감 더위가 기온 수치 이상으로 올라간다.
 * 고습(>70%)이면 땀 증발이 억제돼 체온 조절이 더 어려워지므로 추가 증폭한다.
 * 가중치 시스템과 별개로 직접 차감해 체감을 반영한다.
 *
 * UV 등급(높음/매우높음/위험) × 20°C 초과분 선형 증가 × 습도 증폭(최대 1.5배).
 */
function uvHeatForcePenalty(temp: number, uvIndex?: number, humidity?: number, hour?: number): number {
  if (uvIndex == null || uvIndex < 6) return 0
  if (temp < 17) return 0
  // 야간에는 UV 없음
  if (hour !== undefined && (hour >= 20 || hour < 6)) return 0

  // UV 심각도 단계: 높음(6~7)=1, 매우높음(8~10)=2, 위험(11+)=3
  const uvTier = uvIndex <= 7 ? 1 : uvIndex <= 10 ? 2 : 3
  // 17°C 초과분 (32°C 기준 최대 15°C 캡)
  const tempExcess = Math.min(temp - 17, 15)
  // 습도 증폭: 70% 초과 시 최대 1.5배 (70~100% → 1.0~1.5배)
  const humFactor = humidity != null && humidity > 70
    ? 1 + Math.min((humidity - 70) / 60, 0.5)
    : 1.0

  return Math.round(uvTier * tempExcess * 2.5 * humFactor)
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

/** 강수 강제 감점 — 가중치와 별개로 직접 차감. 비/눈은 노면 위험 + 시야 저하로 보수적 판단 */
function precipitationForcePenalty(precip: 'none' | 'rain' | 'snow' | 'sleet'): number {
  switch (precip) {
    case 'rain': return 30
    case 'sleet': return 45
    case 'snow': return 50
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
