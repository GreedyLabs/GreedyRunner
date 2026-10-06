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

// ─────────────────────────────────────────────────────────────────────────────
// running-index-algorithm.md의 수치를 직접 고정하는 테스트.
//
// 위의 테스트들은 "A가 B보다 낮다" 같은 관계만 검사한다. 그것만으로는 문서의 계산식과
// 코드가 함께 틀려도 통과하므로, 문서가 명시한 구간·상한·감점 폭을 값으로 못 박는다.
// 문서를 고칠 때는 이 테스트도 같이 고쳐야 한다 — 그게 의도된 마찰이다.
// ─────────────────────────────────────────────────────────────────────────────

/** 대기질만으로 계산하는 경로 (기상 데이터 없음 → PM2.5 50%, PM10 30%, O₃ 20%). */
function airOnly(pm25: number, pm10: number, o3: number | null = null, hour?: number) {
  return getRunningIndex({ pm25, pm10, o3, no2: null, co: null }, undefined, hour)
}

describe('문서 고정 — 대기질 페널티 구간', () => {
  it('PM2.5 15 이하·PM10 30 이하는 페널티 0 (문서: 좋음 구간)', () => {
    expect(airOnly(15, 30).score).toBe(100)
  })

  it('PM2.5 0·PM10 0도 100점이다 (0은 결측이 아니라 실제 청정값)', () => {
    expect(airOnly(0, 0, 0).score).toBe(100)
  })

  it('O₃ 0.03 ppm 이하는 페널티 0', () => {
    expect(airOnly(10, 20, 0.03).score).toBe(100)
  })

  it('O₃만 결측이면 계산을 이어간다 (문서 결측값 규칙 3)', () => {
    const r = airOnly(10, 20, null)
    expect(r.status).toBe('great')
    expect(r.score).toBe(100)
  })

  it('PM2.5 또는 PM10이 결측이면 unknown·0점 (문서 결측값 규칙 3)', () => {
    expect(getRunningIndex({ pm25: null, pm10: 20, o3: 0.02, no2: null, co: null }).status).toBe('unknown')
    expect(getRunningIndex({ pm25: 10, pm10: null, o3: 0.02, no2: null, co: null }).status).toBe('unknown')
    expect(getRunningIndex({ pm25: null, pm10: null, o3: null, no2: null, co: null }).score).toBe(0)
  })
})

describe('문서 고정 — PM 극단값 상한 (선형 보간)', () => {
  // 문서의 예시값을 그대로 옮긴 것이다: PM2.5 36→55, 75→35 / PM10 81→55, 139→38, 150→35
  it.each([
    [36, 55],
    [55, 45],
    [75, 35],
    [100, 35],
  ])('PM2.5 %s → 상한 %s', (pm25, cap) => {
    expect(airOnly(pm25, 20).score).toBe(cap)
  })

  it.each([
    [81, 55],
    [125, 42],
    [139, 38],
    [150, 35],
    [200, 35],
  ])('PM10 %s → 상한 %s', (pm10, cap) => {
    expect(airOnly(10, pm10).score).toBe(cap)
  })

  // 문서: "기상 데이터가 없어도 PM2.5·PM10 상한은 반드시 적용됩니다."
  it('기상 데이터가 없어도 PM10 > 150은 good 이상이 나올 수 없다', () => {
    expect(airOnly(10, 151).score).toBeLessThan(60)
  })
})

describe('문서 고정 — O₃ 야간 감경 (20~06시, 페널티 ×0.3)', () => {
  it('같은 O₃ 농도가 야간에는 덜 감점된다', () => {
    const day = airOnly(10, 20, 0.09, 14).score
    const night = airOnly(10, 20, 0.09, 22).score
    expect(day).toBe(90)
    expect(night).toBe(97)
  })

  it('감경 구간의 경계는 20시와 07시다', () => {
    expect(airOnly(10, 20, 0.09, 19).score).toBe(90) // 19시는 주간
    expect(airOnly(10, 20, 0.09, 20).score).toBe(97) // 20시부터 감경
    expect(airOnly(10, 20, 0.09, 6).score).toBe(97) // 06시는 아직 감경
    expect(airOnly(10, 20, 0.09, 7).score).toBe(90) // 07시부터 주간
  })

  it('hour를 넘기지 않으면 감경하지 않는다', () => {
    expect(airOnly(10, 20, 0.09).score).toBe(90)
  })
})

describe('문서 고정 — 강수 강제 감점과 상한', () => {
  const mild = { temperature: 18, humidity: 50, windSpeed: 2 } as const

  // 문서: 비 → 상한 45(caution), 진눈깨비·눈 → 상한 30(bad)
  it.each([
    ['none', 100, 'great'],
    ['rain', 45, 'caution'],
    ['sleet', 30, 'bad'],
    ['snow', 30, 'bad'],
  ] as const)('강수 %s → %s점 (%s)', (precipitation, score, status) => {
    const r = getRunningIndex({ pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null }, { ...mild, precipitation }, 14)
    expect(r.score).toBe(score)
    expect(r.status).toBe(status)
  })

  it('강수가 있으면 메시지를 강수 안내로 덮어쓴다', () => {
    const r = getRunningIndex({ pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null }, { ...mild, precipitation: 'rain' }, 14)
    expect(r.message).toContain('비')
  })
})

describe('문서 고정 — 야간 감점 (23~04시, 20점 직접 차감)', () => {
  const clean = { pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null }
  const mild = { temperature: 18, humidity: 50, windSpeed: 2, precipitation: 'none' } as const

  it.each([
    [22, 100],
    [23, 80],
    [3, 80],
    [4, 100],
  ])('%s시 → %s점', (hour, score) => {
    expect(getRunningIndex(clean, mild, hour).score).toBe(score)
  })

  // 문서: "순서는 야간 감점 → 강수 감점 순이며 둘 다 적용될 수 있다"
  it('야간 감점과 강수 감점이 함께 적용된다', () => {
    const r = getRunningIndex(clean, { ...mild, precipitation: 'rain' }, 23)
    expect(r.score).toBeLessThan(45) // 비 상한(45)보다 야간 감점이 더 낮춘다
    expect(r.message).toContain('야간') // 메시지 우선순위: 야간 > 강수
  })
})

describe('문서 고정 — 복합 악화 보정 예시', () => {
  // 문서 '복합 악화 보정' 절의 예시를 현재 가중치로 다시 계산한 값이다.
  //   PM2.5 40 → 45, PM10 55 → 20, O₃ 0.05 → 16.67, 기온 18 → 0, 습도 85 → 47.5, 풍속 2 → 0
  //   기본 가중 페널티 = 45×0.35 + 20×0.20 + 16.67×0.15 + 0×0.12 + 47.5×0.08 = 26.05
  //   significant(>25) = [45, 47.5] → count 2, avgSeverity 0.4625, compound 18.5
  //   최종 페널티 44.55 → 55점, PM2.5 상한 52.5가 걸려 53점
  it('PM2.5 40 + 습도 85 조합은 53점 caution이다', () => {
    const r = getRunningIndex(
      { pm25: 40, pm10: 55, o3: 0.05, no2: 0.018, co: 0.6 },
      { temperature: 18, humidity: 85, windSpeed: 2, precipitation: 'none' },
      14
    )
    expect(r.score).toBe(53)
    expect(r.status).toBe('caution')
  })

  it('개별 페널티가 25 초과인 항목이 하나뿐이면 추가 감점이 없다', () => {
    // PM2.5 40(45) 하나만 significant → compound 0. 상한만 걸려 53점.
    expect(airOnly(40, 20, 0.02).score).toBe(53)
  })
})

describe('문서 고정 — 점수 → 상태 매핑과 canRun', () => {
  const clean = { pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null }
  const mild = { temperature: 18, humidity: 50, windSpeed: 2, precipitation: 'none' } as const

  // 각 경계를 정확히 찍을 수 있는 경로로 검사한다.
  //   100 → 쾌적 조건, 80 → 야간 감점(23시), 55/45/35 → PM2.5·강수 상한, 30 → 눈 상한
  it.each([
    [getRunningIndex(clean, mild, 14).score, 100, 'great'],
    [getRunningIndex(clean, mild, 23).score, 80, 'great'],
    [airOnly(36, 20).score, 55, 'caution'],
    [getRunningIndex(clean, { ...mild, precipitation: 'rain' }, 14).score, 45, 'caution'],
    [airOnly(75, 20).score, 35, 'bad'],
    [getRunningIndex(clean, { ...mild, precipitation: 'snow' }, 14).score, 30, 'bad'],
  ])('%s점은 %s점이고 경계 상태가 맞다', (actual, expected) => {
    expect(actual).toBe(expected)
  })

  it('경계값의 상태 라벨이 문서 표와 같다', () => {
    expect(getRunningIndex(clean, mild, 23).status).toBe('great') // 80 → great
    expect(airOnly(36, 20).status).toBe('caution') // 55 → caution
    expect(airOnly(75, 20).status).toBe('bad') // 35 → bad
    expect(airOnly(200, 200).status).toBe('worst') // 0 → worst
    expect(getRunningIndex(clean, mild, 23).label).toBe('달리기 최적')
    expect(airOnly(36, 20).label).toBe('주의 필요')
  })

  it('canRun은 40점 이상에서만 true이고 unknown은 항상 false', () => {
    const rain = getRunningIndex(
      { pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null },
      { temperature: 18, humidity: 50, windSpeed: 2, precipitation: 'rain' },
      14
    )
    expect(rain.score).toBe(45)
    expect(rain.canRun).toBe(true)

    const snow = getRunningIndex(
      { pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null },
      { temperature: 18, humidity: 50, windSpeed: 2, precipitation: 'snow' },
      14
    )
    expect(snow.score).toBe(30)
    expect(snow.canRun).toBe(false)

    expect(getRunningIndex({ pm25: null, pm10: null, o3: null, no2: null, co: null }).canRun).toBe(false)
  })
})

describe('문서 고정 — UV 가중치 분기', () => {
  const clean = { pm25: 10, pm10: 20, o3: 0.02, no2: null, co: null }
  const base = { temperature: 18, humidity: 50, windSpeed: 2, precipitation: 'none' } as const

  // 문서: UV가 없으면 기온 12%·습도 8%를 유지하고, 있으면 각각 10%·5%로 줄여 UV에 5%를 준다.
  it('UV가 있으면 기온·습도 가중치가 줄어 점수가 달라진다', () => {
    // 쾌적 조건에서는 두 경로 모두 페널티가 0이라 차이가 관측되지 않는다.
    expect(getRunningIndex(clean, base, 14).score).toBe(100)
    expect(getRunningIndex(clean, { ...base, uvIndex: 0 }, 14).score).toBe(100)

    // 기온·습도가 나쁘고 **상한이 걸리지 않는** 조건이어야 가중치 차이가 드러난다.
    // (무더위 상한이 걸리는 31°C에서는 둘 다 54점으로 눌려 차이가 사라진다)
    const cool = { ...base, temperature: 10, humidity: 85 } as const
    expect(getRunningIndex(clean, cool, 14).score).toBe(95) // 기온 12% + 습도 8%
    expect(getRunningIndex(clean, { ...cool, uvIndex: 0 }, 14).score).toBe(97) // 기온 10% + 습도 5% + UV 5%
  })

  it('야간에는 UV 페널티와 UV 상한이 적용되지 않는다', () => {
    expect(getRunningIndex(clean, { ...base, uvIndex: 11 }, 14).score).toBe(35) // 문서: UV 11+ 주간 → 상한 35
    expect(getRunningIndex(clean, { ...base, uvIndex: 11 }, 22).score).toBe(100) // 야간 → UV 무영향
  })
})
