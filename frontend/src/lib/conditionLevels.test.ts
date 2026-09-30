import { describe, expect, it } from 'vitest'
import { pm25Level, pm10Level, o3Level, uvLevel, windLevel, humidityLevel, tempLevel, precipitationLevel } from './conditionLevels'

/**
 * running-index-algorithm.md의 '대기질 등급 분류' 표를 고정한다.
 *
 * 홈 화면의 컨디션 그리드(이 파일)와 대기질 상세 패널(AirQualityDetails.tsx)은 같은 문서의
 * 6단계 표를 각각 3단계·6단계로 나눠 쓴다. 두 곳이 손으로 동기화되고 있어 한쪽만 고치면
 * 같은 숫자에 서로 다른 등급이 표시된다 — 실제로 오존 61~90 ppb가 그리드에서는 '보통',
 * 상세에서는 '나쁨'으로 나오고 있었다. 경계값을 테스트로 못 박는다.
 *
 * 매핑 규칙: 최고·좋음 → accent, 보통·민감군주의 → warn, 나쁨·매우나쁨 → critical.
 */

describe('pm25Level — 문서 경계 (좋음 ≤15, 민감군주의 ≤35)', () => {
  it.each([
    [0, 'accent'],
    [15, 'accent'],
    [16, 'warn'],
    [35, 'warn'],
    [36, 'critical'],
    [200, 'critical'],
  ])('PM2.5 %s μg/m³ → %s', (value, tone) => {
    expect(pm25Level(value).tone).toBe(tone)
  })

  it('결측은 측정 불가로 표시한다', () => {
    expect(pm25Level(null)).toEqual({ label: '측정 불가', tone: 'muted' })
  })
})

describe('pm10Level — 문서 경계 (좋음 ≤30, 민감군주의 ≤80)', () => {
  it.each([
    [0, 'accent'],
    [30, 'accent'],
    [31, 'warn'],
    [80, 'warn'],
    [81, 'critical'],
    [400, 'critical'],
  ])('PM10 %s μg/m³ → %s', (value, tone) => {
    expect(pm10Level(value).tone).toBe(tone)
  })

  it('결측은 측정 불가로 표시한다', () => {
    expect(pm10Level(null)).toEqual({ label: '측정 불가', tone: 'muted' })
  })
})

describe('o3Level — ppm 입력, 문서 표는 ppb (좋음 ≤30, 민감군주의 ≤60)', () => {
  it.each([
    [0.015, 'accent'],
    [0.03, 'accent'],
    [0.031, 'warn'],
    [0.06, 'warn'],
    // 61 ppb부터는 문서상 '나쁨'이다. 예전에는 warnMax가 90 ppb여서 여기가 '보통'이었다.
    [0.061, 'critical'],
    [0.09, 'critical'],
    [0.12, 'critical'],
  ])('O3 %s ppm → %s', (value, tone) => {
    expect(o3Level(value).tone).toBe(tone)
  })

  it('결측은 측정 불가로 표시한다', () => {
    expect(o3Level(null)).toEqual({ label: '측정 불가', tone: 'muted' })
  })
})

describe('uvLevel — 문서 등급 (0~2 낮음, 3~5 보통, 6+ 높음)', () => {
  it.each([
    [0, 'accent'],
    [2, 'accent'],
    [3, 'warn'],
    [5, 'warn'],
    [6, 'critical'],
    [11, 'critical'],
  ])('UV %s → %s', (value, tone) => {
    expect(uvLevel(value).tone).toBe(tone)
  })

  // UV는 결측이 흔하다(발표 시각·지역 한계). 0으로 표시하면 '낮음'이라는 실제 값이 된다.
  it('UV 결측은 측정 불가로 표시한다', () => {
    expect(uvLevel(undefined)).toEqual({ label: '측정 불가', tone: 'muted' })
  })
})

describe('windLevel — getRunningIndex의 windSpeedPenalty와 같은 경계', () => {
  it.each([
    [0, 'accent'],
    [3, 'accent'],
    [3.1, 'warn'],
    [7, 'warn'],
    [7.1, 'critical'],
  ])('풍속 %s m/s → %s', (value, tone) => {
    expect(windLevel(value).tone).toBe(tone)
  })
})

describe('humidityLevel / tempLevel — 문서의 최적 구간', () => {
  it('습도 40~60%는 쾌적', () => {
    expect(humidityLevel(40).tone).toBe('accent')
    expect(humidityLevel(60).tone).toBe('accent')
  })

  it('습도 20% 미만·80% 초과는 주의', () => {
    expect(humidityLevel(19).tone).toBe('critical')
    expect(humidityLevel(81).tone).toBe('critical')
  })

  it('기온 12~22°C는 쾌적', () => {
    expect(tempLevel(12).tone).toBe('accent')
    expect(tempLevel(22).tone).toBe('accent')
  })

  it('영하·29°C 이상은 주의', () => {
    expect(tempLevel(-1).tone).toBe('critical')
    expect(tempLevel(29).tone).toBe('critical')
  })
})

describe('precipitationLevel', () => {
  it('강수가 없으면 쾌적', () => {
    expect(precipitationLevel('none')).toEqual({ value: '없음', level: { label: '쾌적', tone: 'accent' } })
  })

  // 알고리즘이 점수 상한을 가장 세게 거는 요인이라 있으면 항상 주의로 표시한다.
  it.each(['rain', 'snow', 'sleet'] as const)('%s는 주의', (precip) => {
    expect(precipitationLevel(precip).level.tone).toBe('critical')
  })
})
