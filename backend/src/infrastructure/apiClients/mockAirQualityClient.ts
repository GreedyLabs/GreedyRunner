/**
 * Mock 클라이언트 — AIR_KOREA_API_KEY 미설정 시 폴백으로 사용.
 *
 * airKoreaClient.ts와 **같은 계약**을 지킨다. 예전에는 셋이 달랐고, 그래서 로컬과 테스트가
 * 운영에 없는 동작을 검증했다:
 *   - regionId 형식: `seoul-gangnam` 같은 자체 네임스페이스였다. mock으로 쓰다가 실키를 넣으면
 *     localStorage에 남은 옛 id가 실 클라이언트에서 "알 수 없는 regionId 형식"이 되어 502가 났다.
 *     → 실 클라이언트와 같은 `station:{측정소명}` 형식을 쓴다.
 *   - hourlyForecast 순서: 0~23시 달력순이었다. 프론트엔드 타임라인은 index 0을 "현재"로 그리므로
 *     mock 모드에서는 자정 바가 현재로 표시됐다. → "지금부터 24시간"으로 맞춘다.
 *   - getRunningIndex에 hour를 넘기지 않아 야간 감점·O₃ 야간 감경·UV 상한이 전부 빠졌다.
 *     → 실 경로와 같이 hour를 넘긴다.
 *   - 매 호출 Math.random()이라 같은 요청이 매번 다른 점수를 줬다. → regionId·시각으로 결정된다.
 */
import type { AirQualityData, AirQualityMetrics } from '../../domain/entities/airQuality'
import type { Region } from '../../domain/entities/region'
import { getRunningIndex } from '../../domain/useCases/getRunningIndex'
import { buildHourlyForecast, selectBestRunningHours } from '../../domain/useCases/buildForecast'

interface MockRegion extends Region {
  /** [pm25, pm10] 기준 농도 */
  base: [number, number]
}

/** id는 실 클라이언트의 `station:` 형식을 그대로 쓴다 (측정소명 = shortName). */
function mockRegion(name: string, shortName: string, city: string, lat: number, lng: number, base: [number, number]): MockRegion {
  return { id: `station:${shortName}`, name, shortName, city, lat, lng, base }
}

const MOCK_REGIONS: MockRegion[] = [
  mockRegion('서울 강남구', '강남구', '서울', 37.5172, 127.0473, [28, 45]),
  mockRegion('서울 마포구', '마포구', '서울', 37.5663, 126.9017, [22, 38]),
  mockRegion('서울 송파구', '송파구', '서울', 37.5146, 127.1059, [25, 42]),
  mockRegion('서울 중구', '중구', '서울', 37.5641, 126.9979, [35, 58]),
  mockRegion('서울 용산구', '용산구', '서울', 37.5326, 126.9904, [20, 34]),
  mockRegion('부산 해운대구', '해운대구', '부산', 35.1631, 129.1635, [12, 22]),
  mockRegion('부산 수영구', '수영구', '부산', 35.1455, 129.1132, [18, 32]),
  mockRegion('인천 남동구', '남동구', '인천', 37.4469, 126.7316, [30, 52]),
  mockRegion('인천 연수구', '연수구', '인천', 37.4101, 126.6783, [24, 40]),
  mockRegion('대구 수성구', '수성구', '대구', 35.8582, 128.6308, [16, 28]),
  mockRegion('대전 유성구', '유성구', '대전', 36.3624, 127.3564, [14, 26]),
  mockRegion('광주 서구', '서구', '광주', 35.1522, 126.8908, [13, 24]),
  mockRegion('수원 팔달구', '팔달구', '경기', 37.2747, 127.0214, [26, 44]),
  mockRegion('성남 분당구', '분당구', '경기', 37.3845, 127.1234, [19, 32]),
  mockRegion('제주 제주시', '제주시', '제주', 33.4996, 126.5312, [8, 15]),
]

function toRegion(r: MockRegion): Region {
  const { base: _base, ...region } = r
  return region
}

export async function searchRegions(query: string): Promise<Region[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const score = (r: MockRegion) => {
    if (r.shortName.toLowerCase() === q) return 4
    if (r.shortName.toLowerCase().startsWith(q)) return 3
    if (r.shortName.toLowerCase().includes(q)) return 2
    if (r.city.toLowerCase().includes(q)) return 1
    return 0
  }
  return MOCK_REGIONS.filter((r) => score(r) > 0)
    .sort((a, b) => score(b) - score(a))
    .map(toRegion)
}

export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  const nearest = MOCK_REGIONS.reduce((prev, curr) =>
    Math.hypot(curr.lat - lat, curr.lng - lng) < Math.hypot(prev.lat - lat, prev.lng - lng) ? curr : prev
  )
  // 실 클라이언트의 /by-coords와 동일하게 "측정소" 이름을 돌려준다.
  return { ...toRegion(nearest), name: `${nearest.shortName} 측정소` }
}

export async function getAirQuality(regionId: string, _lat?: number, _lng?: number): Promise<AirQualityData> {
  const region = MOCK_REGIONS.find((r) => r.id === regionId) ?? MOCK_REGIONS[0]
  const now = new Date()
  const currentHour = now.getHours()

  const currentAirQuality = makeMetrics(region, currentHour)
  const currentRunningIndex = getRunningIndex(currentAirQuality, undefined, currentHour)

  // 실 클라이언트와 **같은 domain 함수**를 쓴다 — 계약 일치가 규칙이 아니라 구조다.
  // (지금부터 24시간, index 0 = 현재, 점수 내림차순 상위 3개, 오늘 먼저 채우기)
  const hourlyForecast = buildHourlyForecast({
    currentHour,
    currentMetrics: currentAirQuality,
    currentRunningIndex,
  })

  const bestRunningHours = selectBestRunningHours(hourlyForecast)

  return {
    regionName: region.name,
    updatedAt: now,
    serviceStatus: { airKorea: 'ok', weather: 'unavailable' },
    current: { airQuality: currentAirQuality, runningIndex: currentRunningIndex },
    hourlyForecast,
    bestRunningHours,
  }
}

// ── 내부 유틸 ──────────────────────────────────────────────

/**
 * regionId + 시각으로 결정되는 흔들림 값 [0,1).
 * Math.random() 대신 쓰는 이유: 같은 요청이 매번 다른 점수를 주면 개발 중 화면 변화가
 * 내 수정 때문인지 난수 때문인지 구분할 수 없고, 테스트도 경계값에서 간헐적으로 깨진다.
 */
function noise(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/**
 * 현재 시각의 "실측값"을 흉내낸다.
 *
 * 시간대 패턴 배수를 여기서 적용하지 **않는다.** 실 클라이언트의 현재값은 에어코리아가 준
 * 가공되지 않은 측정값이고, 미래 바의 배수는 domain의 `predictMetrics`가 한 번만 적용한다.
 * 여기서 배수를 또 걸면 mock의 미래 바가 배수를 두 번 먹어 실 경로와 달라진다.
 */
function makeMetrics(region: MockRegion, hour: number): AirQualityMetrics {
  const [pm25Base, pm10Base] = region.base
  const jitter = (base: number, range: number, key: string) =>
    Math.max(0, Math.round((base + (noise(`${region.id}:${hour}:${key}`) - 0.5) * 2 * range) * 10) / 10)
  return {
    pm25: jitter(pm25Base, pm25Base * 0.12, 'pm25'),
    pm10: jitter(pm10Base, pm10Base * 0.12, 'pm10'),
    o3: parseFloat((noise(`${region.id}:${hour}:o3`) * 0.06 + 0.01).toFixed(3)),
    no2: parseFloat((noise(`${region.id}:${hour}:no2`) * 0.03 + 0.005).toFixed(3)),
    co: parseFloat((noise(`${region.id}:${hour}:co`) * 0.8 + 0.2).toFixed(2)),
  }
}

