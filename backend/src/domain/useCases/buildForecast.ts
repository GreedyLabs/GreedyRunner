/**
 * 24시간 예보 조립 — running-index-algorithm.md의 '24시간 타임라인 예보' 절 구현.
 *
 * 이 로직이 domain에 있는 이유: 시간대 패턴 배수와 최적 시간 선정 규칙은 둘 다 기준 문서가
 * 소유하는 알고리즘인데, 예전에는 `infrastructure/apiClients/airKoreaClient.ts` 안에 있었다.
 * 그래서 mock 클라이언트가 같은 규칙을 **따로 구현**했고 (0~23시 달력순, 임계값 65,
 * getRunningIndex에 hour 미전달) 로컬·테스트가 운영에 없는 동작을 검증했다.
 * 여기로 옮겨 두 클라이언트가 같은 함수를 부르게 하면, 계약 일치가 규칙이 아니라 구조가 된다.
 */
import type {
  AirQualityMetrics,
  HourlyForecast,
  RunningIndex,
  WeatherInfo,
} from '../entities/airQuality'
import { BEST_HOUR_MIN_SCORE, getRunningIndex } from './getRunningIndex'

/**
 * 시간대 패턴 배수 (문서: '시간대 패턴' 표).
 *   출퇴근 7~9·17~19시 ×1.4 / 새벽 3~6시 ×0.6 / 그 외 ×1.0
 *
 * O₃만 출퇴근에 ×1.2를 쓴다 — 지표면 오존은 교통량이 늘면 오히려 NO 적정
 * (NO + O₃ → NO₂)으로 소모되어 미세먼지처럼 함께 치솟지 않으므로, 같은 ×1.4를
 * 적용하면 출퇴근 시간대를 과대 감점한다.
 *
 * base 값이 null이면 예측값도 null(측정 불가) — 0으로 조작하지 않는다.
 */
export function predictMetrics(base: AirQualityMetrics, hour: number): AirQualityMetrics {
  const rush = isRushHour(hour)
  const factor = rush ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0
  const scale = (v: number | null, f: number, decimals: number) =>
    v == null ? null : parseFloat((v * f).toFixed(decimals))
  return {
    pm25: scale(base.pm25, factor, 1),
    pm10: scale(base.pm10, factor, 1),
    o3: scale(base.o3, rush ? 1.2 : factor, 3),
    no2: scale(base.no2, factor, 3),
    co: scale(base.co, factor, 2),
  }
}

export function isRushHour(h: number): boolean {
  return (h >= 7 && h <= 9) || (h >= 17 && h <= 19)
}

export function isEarlyMorning(h: number): boolean {
  return h >= 3 && h <= 6
}

interface BuildHourlyForecastParams {
  /** 기준 시각(0~23). 에어코리아 dataTime에서 온 값이며 서버 벽시계가 아니다. */
  currentHour: number
  currentMetrics: AirQualityMetrics
  currentWeather?: WeatherInfo
  /** 카드와 차트 첫 바가 항상 일치하도록 계산된 현재 지수를 그대로 재사용한다. */
  currentRunningIndex: RunningIndex
  /**
   * i번째 바의 기상 정보. `undefined`를 돌려주면 현재 기상으로 폴백한다.
   * 날짜 계산(자정 넘김)은 호출부가 자기 기준 시각으로 하므로 여기서 관여하지 않는다.
   */
  weatherAt?: (i: number, hour: number, isNextDay: boolean) => WeatherInfo | undefined
}

/**
 * "지금부터 +24시간" 바 목록.
 * `[0]`은 현재 시각 바이고 `current`와 같은 값을 재사용한다. 자정을 넘어가면 `isNextDay`가 켜진다.
 */
export function buildHourlyForecast({
  currentHour,
  currentMetrics,
  currentWeather,
  currentRunningIndex,
  weatherAt,
}: BuildHourlyForecastParams): HourlyForecast[] {
  return Array.from({ length: 24 }, (_, i) => {
    const rawHour = currentHour + i
    const hour = rawHour % 24
    const isNextDay = rawHour >= 24

    if (i === 0) {
      return {
        hour,
        isNextDay: undefined,
        airQuality: currentMetrics,
        weather: currentWeather,
        runningIndex: currentRunningIndex,
      }
    }

    const metrics = predictMetrics(currentMetrics, hour)
    const weather = weatherAt?.(i, hour, isNextDay) ?? currentWeather
    return {
      hour,
      isNextDay: isNextDay || undefined,
      airQuality: metrics,
      weather,
      runningIndex: getRunningIndex(metrics, weather, hour),
    }
  })
}

/**
 * 최적 시간 선정 (문서: '최적 시간 선정').
 *
 * - 점수 ≥ BEST_HOUR_MIN_SCORE
 * - 현재 시각 바(index 0)는 제외
 * - 오늘 안에서 먼저 채우고 3개가 안 되면 내일로 보충
 * - 반환 순서는 **점수 내림차순**(오늘 구간 → 내일 구간). 이 순서가 프론트엔드와의 계약이다.
 */
export function selectBestRunningHours(
  forecast: HourlyForecast[]
): Array<{ hour: number; isNextDay: boolean }> {
  const candidates = forecast.slice(1).filter((h) => h.runningIndex.score >= BEST_HOUR_MIN_SCORE)
  const byScore = (a: HourlyForecast, b: HourlyForecast) => b.runningIndex.score - a.runningIndex.score
  return [
    ...candidates.filter((h) => !h.isNextDay).sort(byScore),
    ...candidates.filter((h) => h.isNextDay).sort(byScore),
  ]
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, isNextDay: !!h.isNextDay }))
}
