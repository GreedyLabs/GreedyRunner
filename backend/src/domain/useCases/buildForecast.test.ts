import { buildHourlyForecast, predictMetrics, selectBestRunningHours } from './buildForecast'
import { BEST_HOUR_MIN_SCORE, getRunningIndex } from './getRunningIndex'
import type { AirQualityMetrics, HourlyForecast, WeatherInfo } from '../entities/airQuality'

const BASE: AirQualityMetrics = { pm25: 20, pm10: 40, o3: 0.04, no2: 0.02, co: 0.5 }

describe('predictMetrics — 문서의 시간대 패턴 표', () => {
  it('출퇴근(7~9·17~19시)은 ×1.4를 적용한다', () => {
    for (const hour of [7, 8, 9, 17, 18, 19]) {
      const m = predictMetrics(BASE, hour)
      expect(m.pm25).toBeCloseTo(28, 5)
      expect(m.pm10).toBeCloseTo(56, 5)
    }
  })

  // O₃는 교통량이 늘면 NO 적정으로 소모되므로 다른 항목과 다른 배수를 쓴다.
  it('출퇴근의 O₃만 ×1.2를 적용한다', () => {
    expect(predictMetrics(BASE, 8).o3).toBeCloseTo(0.048, 5)
    expect(predictMetrics(BASE, 8).pm25).toBeCloseTo(28, 5)
  })

  it('새벽(3~6시)은 ×0.6을 적용한다', () => {
    for (const hour of [3, 4, 5, 6]) {
      expect(predictMetrics(BASE, hour).pm25).toBeCloseTo(12, 5)
      expect(predictMetrics(BASE, hour).o3).toBeCloseTo(0.024, 5)
    }
  })

  it('그 외 시간대는 배수 없이 그대로 쓴다', () => {
    for (const hour of [0, 12, 14, 22]) {
      expect(predictMetrics(BASE, hour).pm25).toBeCloseTo(20, 5)
    }
  })

  // 문서 결측값 규칙 1: 결측은 null로 전파하며 절대 0으로 만들지 않는다.
  it('결측값은 배수를 적용해도 null로 남는다', () => {
    const m = predictMetrics({ pm25: null, pm10: null, o3: null, no2: null, co: null }, 8)
    expect(m).toEqual({ pm25: null, pm10: null, o3: null, no2: null, co: null })
  })
})

describe('buildHourlyForecast', () => {
  const currentRunningIndex = getRunningIndex(BASE, undefined, 10)

  it('24개 바를 현재 시각부터 순서대로 만든다', () => {
    const forecast = buildHourlyForecast({ currentHour: 22, currentMetrics: BASE, currentRunningIndex })
    expect(forecast).toHaveLength(24)
    expect(forecast.map((h) => h.hour)).toEqual([
      22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ])
  })

  it('자정을 넘어간 바에만 isNextDay가 켜진다', () => {
    const forecast = buildHourlyForecast({ currentHour: 22, currentMetrics: BASE, currentRunningIndex })
    expect(forecast[0].isNextDay).toBeUndefined() // 22시
    expect(forecast[1].isNextDay).toBeUndefined() // 23시
    expect(forecast[2].isNextDay).toBe(true) // 0시
    expect(forecast.filter((h) => h.isNextDay)).toHaveLength(22)
  })

  it('0시에 조회하면 하루 전체가 오늘이다', () => {
    const forecast = buildHourlyForecast({ currentHour: 0, currentMetrics: BASE, currentRunningIndex })
    expect(forecast.every((h) => !h.isNextDay)).toBe(true)
  })

  // 카드와 차트 첫 바가 어긋나면 사용자가 같은 시각에 다른 점수를 본다.
  it('index 0은 현재 지수·측정값을 그대로 재사용한다', () => {
    const forecast = buildHourlyForecast({ currentHour: 10, currentMetrics: BASE, currentRunningIndex })
    expect(forecast[0].airQuality).toBe(BASE)
    expect(forecast[0].runningIndex).toBe(currentRunningIndex)
  })

  it('weatherAt이 undefined를 주면 현재 기상으로 폴백한다', () => {
    const currentWeather: WeatherInfo = {
      temperature: 18,
      humidity: 50,
      windSpeed: 2,
      precipitation: 'none',
    }
    const forecast = buildHourlyForecast({
      currentHour: 10,
      currentMetrics: BASE,
      currentWeather,
      currentRunningIndex,
      weatherAt: (i) => (i === 1 ? { ...currentWeather, temperature: 30 } : undefined),
    })
    expect(forecast[1].weather?.temperature).toBe(30)
    expect(forecast[2].weather).toBe(currentWeather)
  })

  it('미래 바에는 hour를 넘겨 야간 감점·O₃ 감경이 적용된다', () => {
    // 23시 바는 야간 감점(20점)을 받아야 한다.
    const clean: AirQualityMetrics = { pm25: 5, pm10: 10, o3: 0.01, no2: null, co: null }
    const forecast = buildHourlyForecast({
      currentHour: 22,
      currentMetrics: clean,
      currentRunningIndex: getRunningIndex(clean, undefined, 22),
    })
    const bar23 = forecast.find((h) => h.hour === 23 && !h.isNextDay)
    expect(bar23!.runningIndex.score).toBe(80)
    expect(bar23!.runningIndex.message).toContain('야간')
  })
})

describe('selectBestRunningHours — 문서의 최적 시간 선정', () => {
  /** 점수를 직접 지정한 가짜 예보를 만든다. */
  function fakeForecast(entries: Array<{ hour: number; isNextDay?: boolean; score: number }>): HourlyForecast[] {
    return entries.map(({ hour, isNextDay, score }) => ({
      hour,
      isNextDay,
      airQuality: BASE,
      runningIndex: { score, status: 'good', label: '', message: '', canRun: true },
    }))
  }

  it('현재 시각 바(index 0)는 점수가 높아도 제외한다', () => {
    const best = selectBestRunningHours(
      fakeForecast([
        { hour: 10, score: 100 },
        { hour: 11, score: 70 },
      ])
    )
    expect(best).toEqual([{ hour: 11, isNextDay: false }])
  })

  it(`${BEST_HOUR_MIN_SCORE}점 미만은 제외한다`, () => {
    const best = selectBestRunningHours(
      fakeForecast([
        { hour: 10, score: 0 },
        { hour: 11, score: BEST_HOUR_MIN_SCORE - 1 },
        { hour: 12, score: BEST_HOUR_MIN_SCORE },
      ])
    )
    expect(best).toEqual([{ hour: 12, isNextDay: false }])
  })

  it('점수 내림차순으로 최대 3개를 돌려준다', () => {
    const best = selectBestRunningHours(
      fakeForecast([
        { hour: 10, score: 0 },
        { hour: 11, score: 70 },
        { hour: 12, score: 95 },
        { hour: 13, score: 80 },
        { hour: 14, score: 85 },
      ])
    )
    expect(best).toEqual([
      { hour: 12, isNextDay: false },
      { hour: 14, isNextDay: false },
      { hour: 13, isNextDay: false },
    ])
  })

  // 예전 규칙(22시 이후에만 내일 포함)에서는 21시에 오늘 후보가 22·23시뿐인데도
  // 내일이 막혀 추천이 사실상 사라졌다.
  it('오늘 후보가 3개 미만이면 내일로 보충한다', () => {
    const best = selectBestRunningHours(
      fakeForecast([
        { hour: 21, score: 0 },
        { hour: 22, score: 70 },
        { hour: 23, score: 75 },
        { hour: 6, isNextDay: true, score: 99 },
        { hour: 7, isNextDay: true, score: 98 },
      ])
    )
    // 오늘이 먼저(점수순), 그다음 내일(점수순)
    expect(best).toEqual([
      { hour: 23, isNextDay: false },
      { hour: 22, isNextDay: false },
      { hour: 6, isNextDay: true },
    ])
  })

  it('오늘 후보가 3개 이상이면 내일은 넣지 않는다', () => {
    const best = selectBestRunningHours(
      fakeForecast([
        { hour: 10, score: 0 },
        { hour: 11, score: 70 },
        { hour: 12, score: 71 },
        { hour: 13, score: 72 },
        { hour: 6, isNextDay: true, score: 100 },
      ])
    )
    expect(best.every((b) => !b.isNextDay)).toBe(true)
  })

  it('조건을 만족하는 시간이 없으면 빈 배열이다', () => {
    expect(selectBestRunningHours(fakeForecast([{ hour: 10, score: 0 }, { hour: 11, score: 10 }]))).toEqual([])
  })
})
