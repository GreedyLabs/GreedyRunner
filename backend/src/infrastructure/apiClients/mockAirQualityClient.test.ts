import { searchRegions, getRegionByCoords, getAirQuality } from './mockAirQualityClient'
import { BEST_HOUR_MIN_SCORE } from '../../domain/useCases/getRunningIndex'

const GANGNAM = 'station:강남구'

describe('mockAirQualityClient.searchRegions', () => {
  it('빈 검색어는 빈 배열을 반환한다', async () => {
    expect(await searchRegions('')).toEqual([])
    expect(await searchRegions('   ')).toEqual([])
  })

  it('정확히 일치하는 shortName을 최상위로 정렬한다', async () => {
    const results = await searchRegions('강남구')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].shortName).toBe('강남구')
  })

  it('도시명으로도 검색된다 (부산 → 부산 소재 지역들)', async () => {
    const results = await searchRegions('부산')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.city === '부산')).toBe(true)
  })

  it('매칭이 없으면 빈 배열을 반환한다', async () => {
    expect(await searchRegions('존재하지않는지역명')).toEqual([])
  })

  // mock과 실 클라이언트의 regionId 형식이 갈리면, mock으로 개발하다 실키를 넣은 순간
  // localStorage에 남은 옛 id가 실 클라이언트에서 인식되지 않는다.
  it('regionId는 실 클라이언트와 같은 station: 형식을 쓴다', async () => {
    const results = await searchRegions('강남구')
    expect(results[0].id).toBe(GANGNAM)
    expect(results.every((r) => /^(station:|tm:)/.test(r.id))).toBe(true)
  })
})

describe('mockAirQualityClient.getRegionByCoords', () => {
  it('좌표에 가장 가까운 지역을 station: 형식으로 반환한다', async () => {
    const region = await getRegionByCoords(37.5172, 127.0473)
    expect(region.id).toBe(GANGNAM)
  })

  it('부산 좌표는 부산 지역을 반환한다', async () => {
    const region = await getRegionByCoords(35.1631, 129.1635)
    expect(region.city).toBe('부산')
  })
})

describe('mockAirQualityClient.getAirQuality', () => {
  it('24시간 예보와 러닝 지수를 포함한 응답 형태를 반환한다', async () => {
    const data = await getAirQuality(GANGNAM)
    expect(data.regionName).toBe('서울 강남구')
    expect(data.hourlyForecast).toHaveLength(24)
    expect(data.current.runningIndex.score).toBeGreaterThanOrEqual(0)
    expect(data.current.runningIndex.score).toBeLessThanOrEqual(100)
    expect(data.serviceStatus.airKorea).toBe('ok')
  })

  // 프론트엔드 타임라인은 hourlyForecast[0]을 "현재"로 칠한다.
  // mock이 0~23시 달력순으로 채우던 시절에는 mock 모드에서 자정 바가 현재로 표시됐다.
  it('hourlyForecast[0]은 현재 시각이고 current와 같은 값을 재사용한다', async () => {
    const data = await getAirQuality(GANGNAM)
    const first = data.hourlyForecast[0]
    expect(first.hour).toBe(new Date().getHours())
    expect(first.isNextDay).toBeUndefined()
    expect(first.airQuality).toEqual(data.current.airQuality)
    expect(first.runningIndex).toEqual(data.current.runningIndex)
  })

  it('hourlyForecast는 지금부터 24시간이 이어지고 자정을 넘으면 isNextDay가 켜진다', async () => {
    const data = await getAirQuality(GANGNAM)
    const startHour = data.hourlyForecast[0].hour
    data.hourlyForecast.forEach((h, i) => {
      expect(h.hour).toBe((startHour + i) % 24)
      expect(!!h.isNextDay).toBe(startHour + i >= 24)
    })
  })

  // running-index-algorithm.md / README의 기준: 60점 이상, 상위 3개.
  it(`bestRunningHours는 ${BEST_HOUR_MIN_SCORE}점 이상만, 최대 3개`, async () => {
    const data = await getAirQuality(GANGNAM)
    expect(data.bestRunningHours.length).toBeLessThanOrEqual(3)
    for (const best of data.bestRunningHours) {
      const bar = data.hourlyForecast.find((h) => h.hour === best.hour && !!h.isNextDay === best.isNextDay)
      expect(bar).toBeDefined()
      expect(bar!.runningIndex.score).toBeGreaterThanOrEqual(BEST_HOUR_MIN_SCORE)
    }
  })

  // 순서가 계약이다 — 프론트엔드는 [0]을 헤드라인으로, 목록을 1·2·3위로 읽는다.
  it('bestRunningHours는 점수 내림차순이며 오늘이 내일보다 앞선다', async () => {
    const data = await getAirQuality(GANGNAM)
    const scores = data.bestRunningHours.map(
      (b) => data.hourlyForecast.find((h) => h.hour === b.hour && !!h.isNextDay === b.isNextDay)!.runningIndex.score
    )
    const todayCount = data.bestRunningHours.filter((b) => !b.isNextDay).length
    // 오늘 구간 내림차순
    expect(scores.slice(0, todayCount)).toEqual([...scores.slice(0, todayCount)].sort((a, b) => b - a))
    // 내일 구간 내림차순
    expect(scores.slice(todayCount)).toEqual([...scores.slice(todayCount)].sort((a, b) => b - a))
    // 오늘이 먼저
    expect(data.bestRunningHours.map((b) => b.isNextDay)).toEqual(
      [...data.bestRunningHours.map((b) => b.isNextDay)].sort((a, b) => Number(a) - Number(b))
    )
  })

  it('현재 시각은 추천에서 제외된다', async () => {
    const data = await getAirQuality(GANGNAM)
    const nowHour = data.hourlyForecast[0].hour
    expect(data.bestRunningHours.some((b) => b.hour === nowHour && !b.isNextDay)).toBe(false)
  })

  it('알 수 없는 regionId도 던지지 않고 폴백 지역으로 응답한다', async () => {
    const data = await getAirQuality('does-not-exist')
    expect(data.hourlyForecast).toHaveLength(24)
  })

  // Math.random()을 쓰던 시절에는 같은 요청이 매번 다른 점수를 줘서, 화면 변화가 내 수정
  // 때문인지 난수 때문인지 구분할 수 없었고 경계값 테스트가 간헐적으로 깨졌다.
  it('같은 regionId는 같은 측정값을 준다 (결정적)', async () => {
    const a = await getAirQuality(GANGNAM)
    const b = await getAirQuality(GANGNAM)
    expect(a.current.airQuality).toEqual(b.current.airQuality)
  })

  it('지역마다 다른 측정값을 준다', async () => {
    const gangnam = await getAirQuality(GANGNAM)
    const jeju = await getAirQuality('station:제주시')
    expect(gangnam.current.airQuality).not.toEqual(jeju.current.airQuality)
  })
})
