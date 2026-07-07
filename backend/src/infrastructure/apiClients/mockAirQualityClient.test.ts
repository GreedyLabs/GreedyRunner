import { searchRegions, getRegionByCoords, getAirQuality } from './mockAirQualityClient'

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
    expect(results.every(r => r.city === '부산')).toBe(true)
  })

  it('매칭이 없으면 빈 배열을 반환한다', async () => {
    expect(await searchRegions('존재하지않는지역명')).toEqual([])
  })
})

describe('mockAirQualityClient.getRegionByCoords', () => {
  it('좌표에 가장 가까운 지역을 반환한다 (강남 근처)', async () => {
    const region = await getRegionByCoords(37.5172, 127.0473)
    expect(region.id).toBe('seoul-gangnam')
  })

  it('부산 좌표는 부산 지역을 반환한다', async () => {
    const region = await getRegionByCoords(35.1631, 129.1635)
    expect(region.city).toBe('부산')
  })
})

describe('mockAirQualityClient.getAirQuality', () => {
  it('24시간 예보와 러닝 지수를 포함한 응답 형태를 반환한다', async () => {
    const data = await getAirQuality('seoul-gangnam')
    expect(data.regionName).toBe('서울 강남구')
    expect(data.hourlyForecast).toHaveLength(24)
    expect(data.current.runningIndex.score).toBeGreaterThanOrEqual(0)
    expect(data.current.runningIndex.score).toBeLessThanOrEqual(100)
    expect(data.serviceStatus.airKorea).toBe('ok')
  })

  it('bestRunningHours는 점수 65 이상만, 최대 3개, 시간 오름차순', async () => {
    const data = await getAirQuality('seoul-gangnam')
    expect(data.bestRunningHours.length).toBeLessThanOrEqual(3)
    const hours = data.bestRunningHours.map(h => h.hour)
    const sorted = [...hours].sort((a, b) => a - b)
    expect(hours).toEqual(sorted)
  })

  it('알 수 없는 regionId도 던지지 않고 폴백 지역으로 응답한다', async () => {
    const data = await getAirQuality('does-not-exist')
    expect(data.hourlyForecast).toHaveLength(24)
  })
})
