import { getRunningIndex } from './getRunningIndex'
import type { AirQualityMetrics, WeatherInfo } from '../entities/airQuality'

/** 대기질이 완벽에 가까운 기준값 — 기상 요인만 점수에 영향을 주도록 고정한다. */
const CLEAN_AIR: AirQualityMetrics = { pm25: 10, pm10: 20, o3: 0.02, no2: 0.01, co: 0.3 }

function weather(overrides: Partial<WeatherInfo> = {}): WeatherInfo {
  return {
    temperature: 18,
    humidity: 50,
    windSpeed: 2,
    precipitation: 'none',
    uvIndex: 3,
    ...overrides,
  }
}

describe('getRunningIndex — 기본 동작', () => {
  it('PM2.5/PM10이 결측이면 unknown을 반환한다', () => {
    const r = getRunningIndex({ ...CLEAN_AIR, pm25: null }, weather())
    expect(r.status).toBe('unknown')
    expect(r.canRun).toBe(false)
  })

  it('쾌적한 조건(18°C·습도50·저UV)은 great', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 18, humidity: 50, uvIndex: 3 }), 10)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.status).toBe('great')
  })

  it('canRun은 40점 이상일 때만 true', () => {
    const great = getRunningIndex(CLEAN_AIR, weather(), 10)
    expect(great.canRun).toBe(true)
    // 눈은 상한 30이라 40점 미만 → canRun false (비는 상한 45라 '주의'로 canRun true)
    const snowy = getRunningIndex(CLEAN_AIR, weather({ temperature: 0, precipitation: 'snow' }), 14)
    expect(snowy.canRun).toBe(false)
  })

  it('야간(23~04시)에는 감점되어 시야 경고 메시지를 준다', () => {
    const day = getRunningIndex(CLEAN_AIR, weather(), 10)
    const night = getRunningIndex(CLEAN_AIR, weather(), 2)
    expect(night.score).toBeLessThan(day.score)
    expect(night.message).toContain('야간')
  })
})

describe('무더위 상한(heat cap) — 기온만으로 최종 점수 상한을 낮춘다', () => {
  // 회귀: 기온 가중치가 10%뿐이라 상한이 없으면 28°C 청정 공기가 90점대 '최적'으로 나왔다.
  it('28°C·저UV·청정 공기는 great가 아니라 good에 머문다 (상한 72)', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 60, uvIndex: 3 }), 10)
    expect(r.score).toBe(72)
    expect(r.status).toBe('good')
  })

  it('저녁이라 UV가 0이어도 무더위 상한은 그대로 적용된다', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 60, uvIndex: 0 }), 19)
    expect(r.score).toBeLessThanOrEqual(72)
    expect(r.status).not.toBe('great')
  })

  it('기온이 높을수록 상한이 낮아진다 (28 > 30 > 33)', () => {
    const t28 = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 55, uvIndex: 0 }), 19).score
    const t30 = getRunningIndex(CLEAN_AIR, weather({ temperature: 30, humidity: 55, uvIndex: 0 }), 19).score
    const t33 = getRunningIndex(CLEAN_AIR, weather({ temperature: 33, humidity: 55, uvIndex: 0 }), 19).score
    expect(t28).toBeGreaterThan(t30)
    expect(t30).toBeGreaterThan(t33)
  })

  it('25°C 미만은 무더위 상한의 영향을 받지 않는다', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 22, humidity: 50, uvIndex: 3 }), 10)
    expect(r.score).toBe(100)
  })
})

describe('습열(체감 더위) 강제 감점 — 기온·습도 결합, UV 무관', () => {
  // 회귀: 습도 가중치가 5~8%뿐이라 "흐린 고온다습"이 UV 없이는 거의 감점되지 않았다.
  it('같은 28°C라도 습도가 높으면 더 낮다 (건조 vs 습함)', () => {
    const dry = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 45, uvIndex: 0 }), 19).score
    const humid = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 85, uvIndex: 0 }), 19).score
    expect(dry).toBeGreaterThan(humid)
    expect(humid).toBeLessThanOrEqual(55) // 무더위+고습 → 최소 '주의'
  })

  it('흐린 고온다습(26°C·습도85·UV0)은 최적이 아니다', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 26, humidity: 85, uvIndex: 0 }), 11)
    expect(r.status).not.toBe('great')
    expect(r.score).toBeLessThan(80)
  })

  it('시원하지만 습한 날(20°C·습도95)은 감점하지 않는다 (열스트레스 미미)', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 20, humidity: 95, uvIndex: 0 }), 8)
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.status).toBe('great')
  })

  it('강한 자외선+더위의 엄격함은 보존된다 (28°C·UV8 주간 → 자제)', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 28, humidity: 60, uvIndex: 8 }), 14)
    expect(r.score).toBeLessThanOrEqual(30)
    expect(['bad', 'worst']).toContain(r.status)
  })

  it('한여름 폭염 고온다습(33°C·습도80·흐림)은 bad', () => {
    const r = getRunningIndex(CLEAN_AIR, weather({ temperature: 33, humidity: 80, uvIndex: 0 }), 20)
    expect(r.status).toBe('bad')
  })
})
