import { describe, expect, it } from 'vitest'
import { getConditionTip } from './getConditionTip'
import type { AirQualityMetrics, WeatherInfo } from '../domain/entities/airQuality.types'

const goodAir: AirQualityMetrics = { pm25: 10, pm10: 20, o3: 0.015, no2: 0.01, co: 0.3 }

function weather(overrides: Partial<WeatherInfo> = {}): WeatherInfo {
  return { temperature: 20, humidity: 50, windSpeed: 2, precipitation: 'none', uvIndex: 3, ...overrides }
}

describe('getConditionTip', () => {
  it('fires the ozone-pace tip when ozone crosses its alert threshold, even if UV nominally ranks close', () => {
    // o3=0.042ppm=42ppb (badness 12) vs uv=5 (badness 36) — UV badness is higher,
    // but UV=5 doesn't cross its own alert gate (>=6), so O3 should still fire.
    const tip = getConditionTip(weather({ uvIndex: 5 }), { ...goodAir, o3: 0.042 })
    expect(tip.title).toBe('오존이 보통일 땐 페이스를 한 단계 낮추세요')
    expect(tip.category).toBe('페이스')
    expect(tip.checklist).toHaveLength(3)
  })

  it('fires the rain tip and takes priority over other factors', () => {
    const tip = getConditionTip(weather({ precipitation: 'rain', uvIndex: 8 }), goodAir)
    expect(tip.category).toBe('기상')
    expect(tip.title).toContain('비')
  })

  it('fires the snow-specific variant of the precipitation tip', () => {
    const tip = getConditionTip(weather({ precipitation: 'snow' }), goodAir)
    expect(tip.title).toContain('눈길')
  })

  it('fires the mask/air-quality tip when PM levels are bad', () => {
    const tip = getConditionTip(weather(), { ...goodAir, pm25: 60, pm10: 120 })
    expect(tip.category).toBe('장비')
    expect(tip.title).toContain('미세먼지')
  })

  it('fires the UV tip when UV is high enough to cross its own gate', () => {
    const tip = getConditionTip(weather({ uvIndex: 8 }), goodAir)
    expect(tip.title).toContain('자외선')
  })

  it('fires the heat tip on a hot day', () => {
    const tip = getConditionTip(weather({ temperature: 31 }), goodAir)
    expect(tip.category).toBe('영양')
  })

  it('fires the cold tip on a cold day', () => {
    const tip = getConditionTip(weather({ temperature: 2 }), goodAir)
    expect(tip.title).toContain('쌀쌀')
  })

  it('falls back to the generic good-conditions tip when nothing crosses an alert threshold', () => {
    const tip = getConditionTip(weather(), goodAir)
    expect(tip.category).toBe('페이스')
    expect(tip.title).toBe('오늘은 평소 페이스로 달리기 좋은 날이에요')
  })

  it('does not crash when air quality is entirely unknown', () => {
    const unknownAir: AirQualityMetrics = { pm25: null, pm10: null, o3: null, no2: null, co: null }
    const tip = getConditionTip(weather(), unknownAir)
    expect(tip).toBeTruthy()
  })

  describe('without weather data (mock-mode air-quality-only path)', () => {
    it('falls back to a PM tip when air quality is bad and weather is unavailable', () => {
      const tip = getConditionTip(undefined, { ...goodAir, pm25: 60, pm10: 120 })
      expect(tip.category).toBe('장비')
      expect(tip.title).toContain('미세먼지')
    })

    it('falls back to the ozone tip when only ozone is bad and weather is unavailable', () => {
      const tip = getConditionTip(undefined, { ...goodAir, o3: 0.05 })
      expect(tip.title).toBe('오존이 보통일 땐 페이스를 한 단계 낮추세요')
    })

    it('falls back to the generic tip when air quality is fine and weather is unavailable', () => {
      const tip = getConditionTip(undefined, goodAir)
      expect(tip.title).toBe('오늘은 평소 페이스로 달리기 좋은 날이에요')
    })
  })
})
