import type { AirQualityData, AirQualityMetrics, HourlyForecast } from '../../domain/entities/airQuality.types'
import type { Region } from '../../domain/entities/region.types'
import { getRunningIndex } from '../../domain/useCases/getRunningIndex'

const MOCK_REGIONS: Region[] = [
  { id: 'seoul-gangnam', name: '서울 강남구', shortName: '강남구', city: '서울', lat: 37.5172, lng: 127.0473 },
  { id: 'seoul-mapo', name: '서울 마포구', shortName: '마포구', city: '서울', lat: 37.5663, lng: 126.9017 },
  { id: 'seoul-songpa', name: '서울 송파구', shortName: '송파구', city: '서울', lat: 37.5146, lng: 127.1059 },
  { id: 'seoul-jung', name: '서울 중구', shortName: '중구', city: '서울', lat: 37.5641, lng: 126.9979 },
  { id: 'seoul-yongsan', name: '서울 용산구', shortName: '용산구', city: '서울', lat: 37.5326, lng: 126.9904 },
  { id: 'busan-haeundae', name: '부산 해운대구', shortName: '해운대구', city: '부산', lat: 35.1631, lng: 129.1635 },
  { id: 'busan-jung', name: '부산 중구', shortName: '중구', city: '부산', lat: 35.1036, lng: 129.0322 },
  { id: 'incheon-namdong', name: '인천 남동구', shortName: '남동구', city: '인천', lat: 37.4469, lng: 126.7316 },
  { id: 'incheon-yeonsu', name: '인천 연수구', shortName: '연수구', city: '인천', lat: 37.4101, lng: 126.6783 },
  { id: 'daegu-suseong', name: '대구 수성구', shortName: '수성구', city: '대구', lat: 35.8582, lng: 128.6308 },
  { id: 'daejeon-yuseong', name: '대전 유성구', shortName: '유성구', city: '대전', lat: 36.3624, lng: 127.3564 },
  { id: 'gwangju-seo', name: '광주 서구', shortName: '서구', city: '광주', lat: 35.1522, lng: 126.8908 },
  { id: 'suwon-paldal', name: '수원 팔달구', shortName: '팔달구', city: '수원', lat: 37.2747, lng: 127.0214 },
  { id: 'seongnam-bundang', name: '성남 분당구', shortName: '분당구', city: '성남', lat: 37.3845, lng: 127.1234 },
  { id: 'jeju', name: '제주 제주시', shortName: '제주시', city: '제주', lat: 33.4996, lng: 126.5312 },
]

/** 지역명으로 검색 */
export async function searchRegions(query: string): Promise<Region[]> {
  await delay(300)
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return MOCK_REGIONS.filter(
    r => r.name.includes(q) || r.city.includes(q) || r.shortName.includes(q)
  ).slice(0, 6)
}

/** 위도/경도로 가장 가까운 지역 반환 */
export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  await delay(600)
  // 가장 가까운 지역 계산
  const region = MOCK_REGIONS.reduce((prev, curr) => {
    const prevDist = Math.hypot(prev.lat - lat, prev.lng - lng)
    const currDist = Math.hypot(curr.lat - lat, curr.lng - lng)
    return currDist < prevDist ? curr : prev
  })
  return region
}

/** 지역 ID로 대기질 데이터 조회 */
export async function getAirQualityByRegion(regionId: string): Promise<AirQualityData> {
  await delay(800)

  const region = MOCK_REGIONS.find(r => r.id === regionId) ?? MOCK_REGIONS[0]
  const currentMetrics = generateMetrics(regionId)
  const currentIndex = getRunningIndex(currentMetrics)
  const now = new Date()
  const currentHour = now.getHours()

  const hourlyForecast: HourlyForecast[] = Array.from({ length: 24 }, (_, hour) => {
    const metrics = generateHourlyMetrics(regionId, hour, currentHour)
    return {
      hour,
      airQuality: metrics,
      runningIndex: getRunningIndex(metrics),
    }
  })

  const bestRunningHours = hourlyForecast
    .filter(h => h.runningIndex.score >= 60)
    .sort((a, b) => b.runningIndex.score - a.runningIndex.score)
    .slice(0, 3)
    .map(h => h.hour)
    .sort((a, b) => a - b)

  return {
    regionName: region.name,
    updatedAt: now,
    current: {
      airQuality: currentMetrics,
      runningIndex: currentIndex,
    },
    hourlyForecast,
    bestRunningHours,
  }
}

// ── 내부 유틸 ──────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 지역별 기본 오염 수치 seed */
const REGION_BASE: Record<string, Partial<AirQualityMetrics>> = {
  'seoul-gangnam':    { pm25: 28, pm10: 45 },
  'seoul-mapo':       { pm25: 22, pm10: 38 },
  'seoul-songpa':     { pm25: 25, pm10: 42 },
  'seoul-jung':       { pm25: 35, pm10: 58 },
  'seoul-yongsan':    { pm25: 20, pm10: 34 },
  'busan-haeundae':   { pm25: 12, pm10: 22 },
  'busan-jung':       { pm25: 18, pm10: 32 },
  'incheon-namdong':  { pm25: 30, pm10: 52 },
  'incheon-yeonsu':   { pm25: 24, pm10: 40 },
  'daegu-suseong':    { pm25: 16, pm10: 28 },
  'daejeon-yuseong':  { pm25: 14, pm10: 26 },
  'gwangju-seo':      { pm25: 13, pm10: 24 },
  'suwon-paldal':     { pm25: 26, pm10: 44 },
  'seongnam-bundang': { pm25: 19, pm10: 32 },
  'jeju':             { pm25: 8,  pm10: 15 },
}

function generateMetrics(regionId: string): AirQualityMetrics {
  const base = REGION_BASE[regionId] ?? { pm25: 20, pm10: 35 }
  return {
    pm25: jitter(base.pm25 ?? 20, 5),
    pm10: jitter(base.pm10 ?? 35, 10),
    o3: parseFloat((Math.random() * 0.06 + 0.01).toFixed(3)),
    no2: parseFloat((Math.random() * 0.03 + 0.005).toFixed(3)),
    co: parseFloat((Math.random() * 0.8 + 0.2).toFixed(2)),
  }
}

function generateHourlyMetrics(regionId: string, hour: number, currentHour: number): AirQualityMetrics {
  const base = REGION_BASE[regionId] ?? { pm25: 20, pm10: 35 }
  // 출퇴근 시간(7~9, 17~19)에 오염도 상승, 새벽(3~6)에 낮음
  const rushFactor = isRushHour(hour) ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0
  // 현재 시간 이후는 약간의 예측 불확실성 추가
  const uncertainty = hour > currentHour ? 0.15 : 0.08

  return {
    pm25: jitter((base.pm25 ?? 20) * rushFactor, (base.pm25 ?? 20) * uncertainty),
    pm10: jitter((base.pm10 ?? 35) * rushFactor, (base.pm10 ?? 35) * uncertainty),
    o3: parseFloat((Math.random() * 0.06 + 0.01).toFixed(3)),
    no2: parseFloat((Math.random() * 0.03 + 0.005).toFixed(3)),
    co: parseFloat((Math.random() * 0.8 + 0.2).toFixed(2)),
  }
}

function isRushHour(hour: number) {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)
}

function isEarlyMorning(hour: number) {
  return hour >= 3 && hour <= 6
}

function jitter(base: number, range: number): number {
  return Math.max(0, Math.round(base + (Math.random() - 0.5) * 2 * range))
}
