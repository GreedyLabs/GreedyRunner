import type { StatusTone } from './runningStatusColors'

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
