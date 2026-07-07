import { describe, expect, it } from 'vitest'
import { getGearRecommendation } from './getGearRecommendation'
import type { AirQualityMetrics, WeatherInfo } from '../domain/entities/airQuality.types'

const goodAir: AirQualityMetrics = { pm25: 10, pm10: 20, o3: 0.02, no2: 0.01, co: 0.3 }
const badAir: AirQualityMetrics = { pm25: 50, pm10: 100, o3: 0.03, no2: 0.02, co: 0.4 }
const veryBadAir: AirQualityMetrics = { pm25: 90, pm10: 200, o3: 0.03, no2: 0.02, co: 0.4 }
const unknownAir: AirQualityMetrics = { pm25: null, pm10: null, o3: null, no2: null, co: null }

function weather(overrides: Partial<WeatherInfo> = {}): WeatherInfo {
  return { temperature: 24, humidity: 58, windSpeed: 2, precipitation: 'none', uvIndex: 5, ...overrides }
}

describe('getGearRecommendation', () => {
  it('recommends short sleeves and moderate-UV headwear on a warm day with moderate UV', () => {
    const rec = getGearRecommendation(weather(), goodAir)
    expect(rec.items[0].title).toBe('반팔 · 반바지')
    expect(rec.items.some((i) => i.icon === 'glasses')).toBe(true)
    expect(rec.extras).toContain('자외선 차단제')
  })

  it('recommends warm layers on a cold day', () => {
    const rec = getGearRecommendation(weather({ temperature: -2 }), goodAir)
    expect(rec.items[0].title).toBe('기모 긴팔 + 장갑')
  })

  it('recommends waterproof gear and skips UV headwear in the rain', () => {
    const rec = getGearRecommendation(weather({ precipitation: 'rain', uvIndex: 7 }), goodAir)
    expect(rec.items[0].title).toContain('방수')
    expect(rec.items.some((i) => i.icon === 'glasses')).toBe(false)
  })

  it('recommends a mask when air quality is bad', () => {
    const rec = getGearRecommendation(weather(), badAir)
    expect(rec.items.some((i) => i.icon === 'shield')).toBe(true)
  })

  it('escalates mask wording when air quality is very bad', () => {
    const rec = getGearRecommendation(weather(), veryBadAir)
    const mask = rec.items.find((i) => i.icon === 'shield')
    expect(mask?.title).toContain('KF80')
  })

  it('does not fabricate a mask recommendation when air quality is unknown', () => {
    const rec = getGearRecommendation(weather(), unknownAir)
    expect(rec.items.some((i) => i.icon === 'shield')).toBe(false)
  })

  it('marks water as optional on a cool, dry day', () => {
    const rec = getGearRecommendation(weather({ temperature: 15, humidity: 40 }), goodAir)
    const water = rec.items.find((i) => i.icon === 'droplets')
    expect(water?.title).toBe('물 (선택)')
  })

  describe('without weather data (mock-mode air-quality-only path)', () => {
    it('still recommends a mask when air quality is bad', () => {
      const rec = getGearRecommendation(undefined, badAir)
      expect(rec.items.some((i) => i.icon === 'shield')).toBe(true)
    })

    it('falls back to a generic clothing note instead of crashing', () => {
      const rec = getGearRecommendation(undefined, goodAir)
      expect(rec.items[0].icon).toBe('shirt')
      expect(rec.items.some((i) => i.icon === 'shield')).toBe(false)
    })
  })
})
