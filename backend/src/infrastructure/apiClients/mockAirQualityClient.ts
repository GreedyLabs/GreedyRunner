/**
 * Mock 클라이언트 — AIR_KOREA_API_KEY 미설정 시 폴백으로 사용.
 * airKoreaClient.ts와 동일한 비동기 인터페이스를 제공합니다.
 */
import type { AirQualityData, AirQualityMetrics } from '../../domain/entities/airQuality'
import type { Region } from '../../domain/entities/region'
import { getRunningIndex } from '../../domain/useCases/getRunningIndex'

const MOCK_REGIONS: Region[] = [
  { id: 'seoul-gangnam',    name: '서울 강남구', shortName: '강남구', city: '서울',  lat: 37.5172, lng: 127.0473 },
  { id: 'seoul-mapo',       name: '서울 마포구', shortName: '마포구', city: '서울',  lat: 37.5663, lng: 126.9017 },
  { id: 'seoul-songpa',     name: '서울 송파구', shortName: '송파구', city: '서울',  lat: 37.5146, lng: 127.1059 },
  { id: 'seoul-jung',       name: '서울 중구',   shortName: '중구',   city: '서울',  lat: 37.5641, lng: 126.9979 },
  { id: 'seoul-yongsan',    name: '서울 용산구', shortName: '용산구', city: '서울',  lat: 37.5326, lng: 126.9904 },
  { id: 'busan-haeundae',   name: '부산 해운대구', shortName: '해운대구', city: '부산', lat: 35.1631, lng: 129.1635 },
  { id: 'busan-jung',       name: '부산 중구',   shortName: '중구',   city: '부산',  lat: 35.1036, lng: 129.0322 },
  { id: 'incheon-namdong',  name: '인천 남동구', shortName: '남동구', city: '인천',  lat: 37.4469, lng: 126.7316 },
  { id: 'incheon-yeonsu',   name: '인천 연수구', shortName: '연수구', city: '인천',  lat: 37.4101, lng: 126.6783 },
  { id: 'daegu-suseong',    name: '대구 수성구', shortName: '수성구', city: '대구',  lat: 35.8582, lng: 128.6308 },
  { id: 'daejeon-yuseong',  name: '대전 유성구', shortName: '유성구', city: '대전',  lat: 36.3624, lng: 127.3564 },
  { id: 'gwangju-seo',      name: '광주 서구',   shortName: '서구',   city: '광주',  lat: 35.1522, lng: 126.8908 },
  { id: 'suwon-paldal',     name: '수원 팔달구', shortName: '팔달구', city: '수원',  lat: 37.2747, lng: 127.0214 },
  { id: 'seongnam-bundang', name: '성남 분당구', shortName: '분당구', city: '성남',  lat: 37.3845, lng: 127.1234 },
  { id: 'jeju',             name: '제주 제주시', shortName: '제주시', city: '제주',  lat: 33.4996, lng: 126.5312 },
]

const REGION_BASE: Record<string, [number, number]> = {
  'seoul-gangnam':    [28, 45],
  'seoul-mapo':       [22, 38],
  'seoul-songpa':     [25, 42],
  'seoul-jung':       [35, 58],
  'seoul-yongsan':    [20, 34],
  'busan-haeundae':   [12, 22],
  'busan-jung':       [18, 32],
  'incheon-namdong':  [30, 52],
  'incheon-yeonsu':   [24, 40],
  'daegu-suseong':    [16, 28],
  'daejeon-yuseong':  [14, 26],
  'gwangju-seo':      [13, 24],
  'suwon-paldal':     [26, 44],
  'seongnam-bundang': [19, 32],
  'jeju':             [8,  15],
}

export async function searchRegions(query: string): Promise<Region[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MOCK_REGIONS.filter(
    r => r.name.includes(q) || r.city.includes(q) || r.shortName.includes(q)
  ).slice(0, 6)
}

export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  return MOCK_REGIONS.reduce((prev, curr) =>
    Math.hypot(curr.lat - lat, curr.lng - lng) <
    Math.hypot(prev.lat - lat, prev.lng - lng) ? curr : prev
  )
}

export async function getAirQuality(regionId: string, _lat?: number, _lng?: number): Promise<AirQualityData> {
  const region = MOCK_REGIONS.find(r => r.id === regionId) ?? MOCK_REGIONS[0]
  const now = new Date()
  const currentHour = now.getHours()

  const currentAirQuality = makeMetrics(regionId)
  const currentRunningIndex = getRunningIndex(currentAirQuality)

  const hourlyForecast = Array.from({ length: 24 }, (_, hour) => {
    const airQuality = makeHourlyMetrics(regionId, hour, currentHour)
    return { hour, airQuality, runningIndex: getRunningIndex(airQuality) }
  })

  const bestRunningHours = [...hourlyForecast]
    .filter(h => h.runningIndex.score >= 60)
    .sort((a, b) => b.runningIndex.score - a.runningIndex.score)
    .slice(0, 3)
    .map(h => h.hour)
    .sort((a, b) => a - b)

  return {
    regionName: region.name,
    updatedAt: now,
    current: {
      airQuality: currentAirQuality,
      runningIndex: currentRunningIndex,
    },
    hourlyForecast,
    bestRunningHours,
  }
}

// ── 내부 유틸 ──────────────────────────────────────────────

function makeMetrics(regionId: string): AirQualityMetrics {
  const [pm25Base, pm10Base] = REGION_BASE[regionId] ?? [20, 35]
  return {
    pm25: jitter(pm25Base, 5),
    pm10: jitter(pm10Base, 10),
    o3:   parseFloat((Math.random() * 0.06 + 0.01).toFixed(3)),
    no2:  parseFloat((Math.random() * 0.03 + 0.005).toFixed(3)),
    co:   parseFloat((Math.random() * 0.8 + 0.2).toFixed(2)),
  }
}

function makeHourlyMetrics(regionId: string, hour: number, currentHour: number): AirQualityMetrics {
  const [pm25Base, pm10Base] = REGION_BASE[regionId] ?? [20, 35]
  const rush = isRushHour(hour) ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0
  const noise = hour > currentHour ? 0.15 : 0.08
  return {
    pm25: jitter(pm25Base * rush, pm25Base * noise),
    pm10: jitter(pm10Base * rush, pm10Base * noise),
    o3:   parseFloat((Math.random() * 0.06 + 0.01).toFixed(3)),
    no2:  parseFloat((Math.random() * 0.03 + 0.005).toFixed(3)),
    co:   parseFloat((Math.random() * 0.8 + 0.2).toFixed(2)),
  }
}

function isRushHour(h: number) { return (h >= 7 && h <= 9) || (h >= 17 && h <= 19) }
function isEarlyMorning(h: number) { return h >= 3 && h <= 6 }
function jitter(base: number, range: number) {
  return Math.max(0, Math.round((base + (Math.random() - 0.5) * 2 * range) * 10) / 10)
}
