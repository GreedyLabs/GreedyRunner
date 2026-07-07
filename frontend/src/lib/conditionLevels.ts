import type { StatusTone } from './runningStatusColors'
import type { PrecipitationType } from '../domain/entities/airQuality.types'

export interface ConditionLevel {
  label: string
  tone: StatusTone
}

const UNKNOWN: ConditionLevel = { label: '측정 불가', tone: 'muted' }

// Breakpoints mirror AirQualityDetails.tsx's 6-tier thresholds (최고/좋음 -> good,
// 보통/민감군주의 -> warn, 나쁨/매우나쁨 -> critical) so the Home condition grid
// never contradicts the drill-down detail panel for the same reading.
function levelFrom(value: number | null, goodMax: number, warnMax: number): ConditionLevel {
  if (value == null) return UNKNOWN
  if (value <= goodMax) return { label: '좋음', tone: 'accent' }
  if (value <= warnMax) return { label: '보통', tone: 'warn' }
  return { label: '나쁨', tone: 'critical' }
}

export function pm25Level(value: number | null): ConditionLevel {
  return levelFrom(value, 15, 35)
}

export function pm10Level(value: number | null): ConditionLevel {
  return levelFrom(value, 30, 80)
}

// `o3Ppm` in ppm (raw AirQualityMetrics.o3 unit) — converted to ppb internally
// to match AirQualityDetails' displayed breakpoints.
export function o3Level(o3Ppm: number | null): ConditionLevel {
  return levelFrom(o3Ppm == null ? null : Math.round(o3Ppm * 1000), 30, 90)
}

export function tempLevel(temperature: number): ConditionLevel {
  if (temperature >= 12 && temperature <= 22) return { label: '쾌적', tone: 'accent' }
  if (temperature >= 5 && temperature <= 28) return { label: '보통', tone: 'warn' }
  return { label: '주의', tone: 'critical' }
}

export function humidityLevel(humidity: number): ConditionLevel {
  if (humidity >= 40 && humidity <= 60) return { label: '쾌적', tone: 'accent' }
  if (humidity >= 30 && humidity <= 80) return { label: '보통', tone: 'warn' }
  return { label: '주의', tone: 'critical' }
}

export function uvLevel(uvIndex: number | undefined): ConditionLevel {
  if (uvIndex == null) return UNKNOWN
  if (uvIndex <= 2) return { label: '낮음', tone: 'accent' }
  if (uvIndex <= 5) return { label: '보통', tone: 'warn' }
  return { label: '높음', tone: 'critical' }
}

// getRunningIndex의 windSpeedPenalty와 동일 경계: 3m/s 이하 쾌적, 7m/s 이상 불편.
export function windLevel(windSpeed: number): ConditionLevel {
  if (windSpeed <= 3) return { label: '약함', tone: 'accent' }
  if (windSpeed <= 7) return { label: '보통', tone: 'warn' }
  return { label: '강함', tone: 'critical' }
}

const PRECIP_LABELS: Record<PrecipitationType, string> = {
  none: '없음',
  rain: '비',
  snow: '눈',
  sleet: '진눈깨비',
}

// 강수는 알고리즘에서 점수 상한을 가장 세게 거는 요인이라, 있으면 항상 '주의'로 표시한다.
export function precipitationLevel(precip: PrecipitationType): {
  value: string
  level: ConditionLevel
} {
  return {
    value: PRECIP_LABELS[precip],
    level: precip === 'none' ? { label: '쾌적', tone: 'accent' } : { label: '주의', tone: 'critical' },
  }
}
