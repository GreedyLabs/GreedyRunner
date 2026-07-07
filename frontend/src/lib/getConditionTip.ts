import type { AirQualityMetrics, WeatherInfo } from '../domain/entities/airQuality.types'
import type { RunningTip } from './runningTips'

/**
 * Condition-aware tip for the connected flow's Tip screen — replaces the old
 * `RunningTipCard`'s `Math.random()` pick with a rule-based one tied to
 * today's actual conditions. This does NOT reimplement the backend's
 * `getRunningIndex` scoring (which has no per-factor breakdown exposed to the
 * API) — it's an independent, simpler "what's most worth mentioning today"
 * heuristic used only to pick which contextual coaching tip to surface.
 *
 * `weather` is optional because the mock air-quality client (used whenever
 * `AIR_KOREA_API_KEY`/`KMA_API_KEY` aren't set) never returns weather data —
 * this must still produce a sensible air-quality-only tip in that case.
 */

export interface ConditionTip {
  category: RunningTip['category']
  title: string
  body: string
  checklist: { text: string; ok: boolean }[]
  closing: string
}

function o3Tip(o3Ppm: number): ConditionTip {
  const o3ppb = Math.round(o3Ppm * 1000)
  return {
    category: '페이스',
    title: '오존이 보통일 땐 페이스를 한 단계 낮추세요',
    body: `지금 오존 ${o3ppb}ppb(보통 이상). 격렬하게 달리면 호흡량이 늘어 오존을 더 많이 들이마시게 됩니다. 오늘은 강도를 살짝 내리는 게 좋아요. 오존은 햇빛이 강한 낮에 높아졌다가 해가 지면서 빠르게 떨어집니다.`,
    checklist: [
      { text: '대화가 가능한 편안한 조깅 페이스', ok: true },
      { text: '30-40분 이내로 시간 조절', ok: true },
      { text: '전력 질주 인터벌은 저녁 이후로', ok: false },
    ],
    closing: '타임라인에서 오존이 내려가는 시간대를 확인하고 그때 강도를 올려보세요.',
  }
}

function precipTip(precipitation: WeatherInfo['precipitation']): ConditionTip {
  const isSnow = precipitation === 'snow' || precipitation === 'sleet'
  return {
    category: '기상',
    title: isSnow ? '눈길에서는 페이스보다 접지가 먼저예요' : '비 오는 날엔 시야와 접지에 유의하세요',
    body: isSnow
      ? '노면이 얼어붙거나 미끄러울 수 있어요. 무리한 페이스보다 안전한 보폭과 접지력이 우선입니다.'
      : '노면이 미끄럽고 시야가 줄어들어요. 밝은 옷을 입고 평소보다 페이스를 낮추세요.',
    checklist: [
      { text: '그립이 좋은 신발 착용', ok: true },
      { text: '밝은 색·반사 소재 옷 착용', ok: true },
      { text: '내리막·코너에서 전력 질주는 피하기', ok: false },
    ],
    closing: '날씨가 갤 때까지 실내 운동으로 대체하는 것도 좋은 선택이에요.',
  }
}

function pmTip(pm25: number | null, pm10: number | null): ConditionTip {
  return {
    category: '장비',
    title: '미세먼지가 나쁠 땐 실내 러닝도 고려하세요',
    body: `초미세먼지 ${pm25 ?? '-'}·미세먼지 ${pm10 ?? '-'}. 장시간 고강도 운동은 호흡기 부담을 늘립니다. 짧고 가볍게, 혹은 실내 트레드밀로 대체해보세요.`,
    checklist: [
      { text: '30분 이내 저강도로 단축', ok: true },
      { text: '마스크(KF80 이상) 착용 고려', ok: true },
      { text: '장시간 인터벌·템포런은 다음으로 미루기', ok: false },
    ],
    closing: '대기질은 바람이 불거나 비가 오면 빠르게 개선돼요.',
  }
}

function uvTip(uvIndex: number): ConditionTip {
  return {
    category: '장비',
    title: '자외선이 강한 시간대엔 그늘 코스로',
    body: `지금 자외선 지수 ${uvIndex}(높음 이상). 장시간 직사광선 노출은 피부와 눈에 부담을 줍니다. 가로수길이나 그늘이 많은 코스를 고르세요.`,
    checklist: [
      { text: '자외선 차단제 노출 부위에 도포', ok: true },
      { text: '캡·선글라스 착용', ok: true },
      { text: '정오~오후 3시 장시간 야외 세션은 피하기', ok: false },
    ],
    closing: '해가 기울면 자외선 지수가 빠르게 낮아져요.',
  }
}

function heatTip(temperature: number): ConditionTip {
  return {
    category: '영양',
    title: '더운 날엔 페이스보다 수분 보충이 먼저예요',
    body: `기온 ${temperature}°C. 땀 배출만으로 체온 조절이 어려운 구간입니다. 그늘·급수 지점이 있는 코스를 고르고 페이스를 늦추세요.`,
    checklist: [
      { text: '물을 자주, 조금씩 섭취', ok: true },
      { text: '그늘·급수대 있는 코스 선택', ok: true },
      { text: '한낮 장거리·고강도 세션은 피하기', ok: false },
    ],
    closing: '해 질 무렵으로 갈수록 체감온도가 내려가요.',
  }
}

function coldTip(temperature: number): ConditionTip {
  return {
    category: '기상',
    title: '쌀쌀한 날엔 준비 운동을 평소보다 길게',
    body: `기온 ${temperature}°C. 근육과 관절이 덜 풀린 상태로 바로 달리면 부상 위험이 커져요. 워밍업을 충분히 하고 레이어드로 체온을 관리하세요.`,
    checklist: [
      { text: '5-10분 동적 스트레칭으로 워밍업', ok: true },
      { text: '겹쳐 입어 체온 조절', ok: true },
      { text: '준비 운동 없이 전력 질주는 피하기', ok: false },
    ],
    closing: '몸이 풀리고 나면 평소 페이스로 올려도 괜찮아요.',
  }
}

function genericTip(): ConditionTip {
  return {
    category: '페이스',
    title: '오늘은 평소 페이스로 달리기 좋은 날이에요',
    body: '대기질·기온·자외선 모두 무난한 수준입니다. 컨디션에 맞춰 평소 루틴대로 달려보세요.',
    checklist: [
      { text: '원하는 페이스로 자유롭게', ok: true },
      { text: '몸 상태에 따라 거리 조절', ok: true },
      { text: '무리한 페이스만 아니라면 제약 없음', ok: true },
    ],
    closing: '지금 같은 조건은 오래 유지되지 않을 수 있으니 컨디션이 괜찮다면 지금 나가보세요.',
  }
}

function pmBadness(airQuality: AirQualityMetrics): number {
  return Math.max(
    airQuality.pm25 != null ? Math.max(0, airQuality.pm25 - 15) : 0,
    airQuality.pm10 != null ? Math.max(0, airQuality.pm10 - 30) * 0.5 : 0
  )
}

function o3Badness(airQuality: AirQualityMetrics): number {
  const o3ppb = airQuality.o3 != null ? airQuality.o3 * 1000 : null
  return o3ppb != null ? Math.max(0, o3ppb - 30) : 0
}

function pmQualifies(airQuality: AirQualityMetrics): boolean {
  return (airQuality.pm25 != null && airQuality.pm25 > 35) || (airQuality.pm10 != null && airQuality.pm10 > 80)
}

function o3Qualifies(airQuality: AirQualityMetrics): boolean {
  const o3ppb = airQuality.o3 != null ? airQuality.o3 * 1000 : null
  return o3ppb != null && o3ppb > 30
}

/** Air-quality-only fallback, used whenever weather data is unavailable (mock mode always, real mode on KMA failure). */
function pickAirQualityTip(airQuality: AirQualityMetrics): ConditionTip {
  const pmScore = pmQualifies(airQuality) ? pmBadness(airQuality) : -1
  const o3Score = o3Qualifies(airQuality) ? o3Badness(airQuality) : -1

  if (pmScore < 0 && o3Score < 0) return genericTip()
  if (pmScore >= o3Score) return pmTip(airQuality.pm25, airQuality.pm10)
  return o3Tip(airQuality.o3 ?? 0)
}

export function getConditionTip(weather: WeatherInfo | undefined, airQuality: AirQualityMetrics): ConditionTip {
  if (!weather) return pickAirQualityTip(airQuality)

  // Precipitation is a hard safety override (slippery footing, poor
  // visibility) — it takes priority regardless of relative badness score,
  // matching how the backend's own precipitation penalty is a forced
  // deduction rather than part of the weighted average.
  if (weather.precipitation !== 'none') return precipTip(weather.precipitation)

  type Factor = 'o3' | 'pm' | 'uv' | 'heat' | 'cold'
  const scores: Record<Factor, number> = {
    o3: o3Qualifies(airQuality) ? o3Badness(airQuality) : -1,
    pm: pmQualifies(airQuality) ? pmBadness(airQuality) : -1,
    uv: weather.uvIndex != null && weather.uvIndex >= 6 ? (weather.uvIndex - 2) * 12 : -1,
    heat: weather.temperature >= 28 ? (weather.temperature - 28) * 8 : -1,
    cold: weather.temperature <= 5 ? (5 - weather.temperature) * 8 : -1,
  }
  const winner = (Object.keys(scores) as Factor[]).sort((a, b) => scores[b] - scores[a])[0]
  if (scores[winner] < 0) return genericTip()

  switch (winner) {
    case 'o3':
      return o3Tip(airQuality.o3 ?? 0)
    case 'pm':
      return pmTip(airQuality.pm25, airQuality.pm10)
    case 'uv':
      return uvTip(weather.uvIndex ?? 0)
    case 'heat':
      return heatTip(weather.temperature)
    case 'cold':
      return coldTip(weather.temperature)
  }
}
