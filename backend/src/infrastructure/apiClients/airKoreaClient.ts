/**
 * 에어코리아 Open API 클라이언트 + 기상청 날씨 통합
 *
 * regionId 포맷:
 *   - `tm:{tmX}:{tmY}`      — 지역명 검색 결과 (TM 좌표 → 가장 가까운 측정소 조회)
 *   - `station:{stationName}` — 좌표 기반 조회 결과 (측정소명 직접 사용)
 */

import proj4 from 'proj4';
import type {
  AirQualityData,
  AirQualityMetrics,
  ServiceStatus,
  StationFallback,
  WeatherInfo,
} from '../../domain/entities/airQuality';
import type { Region } from '../../domain/entities/region';
import { BEST_HOUR_MIN_SCORE, getRunningIndex } from '../../domain/useCases/getRunningIndex';
import { getCurrentWeather, getHourlyWeather, kstDateKey, type HourlyWeatherMap } from './weatherClient';
import { getUVIndex, type UVData } from './uvIndexClient';
import { assertOpenApiOk, fetchOpenApi, UpstreamApiError } from './openApiResponse';

const API_KEY = process.env.AIR_KOREA_API_KEY ?? '';
const MSRS_BASE = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc';
const ARPL_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';

/**
 * 측정소별 실시간 측정정보(getMsrstnAcctoRltmMesureDnsty)의 `ver`.
 *
 * `ver`는 응답에 포함되는 항목을 정하는데, 1.0은 PM2.5(`pm25Value`)를 돌려주지 않는다.
 * 1.0으로 요청하면 `pm25Value`가 응답에 **없어** parseMeasurement가 pm25를 null로 읽고,
 * isMeasurementFaulty가 모든 후보 측정소를 비정상으로 판정한 뒤 getRunningIndex가
 * 전 시간대를 'unknown'(점수 0)으로 돌려준다 — 호출은 성공하는데 화면 전체가 "측정 불가"가 된다.
 * 1.3은 1.0의 항목을 모두 포함하는 상위집합(+ PM2.5 + 등급 항목)이라 바꿔도 잃는 필드가 없다.
 */
const MEASUREMENT_VER = '1.3';

/**
 * 요청한 지역·측정소를 특정할 수 없는 경우.
 *
 * 라우트가 404를 내려면 이 상황을 상류 장애(502)와 구분해야 한다. 예전에는 라우트가
 * 에러 **메시지에 '찾을 수 없습니다'가 들어 있는지**로 판정해서, 문구를 고치면 조용히
 * 502로 바뀌고 무관한 한글 메시지에도 오탐할 수 있었다. 타입으로 구분한다.
 */
export class RegionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegionNotFoundError';
  }
}

// 한국 중부원점 TM 좌표계 (EPSG:2097, Bessel 타원체)
proj4.defs(
  'KOREAN_TM',
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-146.43,507.89,681.46 +units=m +no_defs',
);

// ── 좌표 변환 ─────────────────────────────────────────────────

function latLngToTM(lat: number, lng: number): { tmX: number; tmY: number } {
  const [tmX, tmY] = proj4('EPSG:4326', 'KOREAN_TM', [lng, lat]);
  return { tmX, tmY };
}

function tmToLatLng(tmX: number, tmY: number): { lat: number; lng: number } {
  const [lng, lat] = proj4('KOREAN_TM', 'EPSG:4326', [tmX, tmY]);
  return { lat, lng };
}

// ── AirKorea 공통 응답 타입 ───────────────────────────────────

/**
 * 모든 단계를 옵셔널로 둔다. 상류가 `response`·`body`·`items` 중 하나를 빼고 보내는 일이 실제로
 * 있어(에러 봉투가 JSON으로 올 때), 필수로 선언하면 타입은 통과하고 런타임에서 TypeError가 난다.
 * 옵셔널로 두면 읽는 쪽이 `?? []`를 쓰도록 컴파일러가 강제한다.
 */
interface AirKoreaResponse<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: T[]; totalCount?: number };
  };
}

// ── 측정소 정보 API ──────────────────────────────────────────

interface NearbyStation {
  stationName: string;
  addr: string;
  tm: number;
}

/**
 * 주변 측정소 목록의 메모리 캐시.
 * 같은 좌표로 `/by-coords` → `/api/v1/air-quality/station:xxx` 흐름이 이어질 때
 * 두 번째 호출이 외부 API를 다시 타지 않게 한다. 비정상 측정소 폴백 시
 * "이미 조회한 주변 측정소 후보"를 재사용하기 위한 근거 자료이기도 하다.
 */
const NEARBY_CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
/**
 * 빈 결과는 짧게만 캐싱한다. 상류가 일시적으로 빈 목록을 돌려준 것을 1시간 붙들면
 * 그 격자에 들어오는 모든 요청이 60분간 "측정소를 찾을 수 없습니다"(404)가 되어,
 * 순간적인 장애가 한 시간짜리 장애로 늘어난다.
 */
const NEARBY_EMPTY_TTL_MS = 60 * 1000; // 1분
const nearbyStationCache = new Map<string, { stations: NearbyStation[]; expiresAt: number }>();

/** TM 좌표를 100m 격자로 반올림한 캐시 키 (좌표가 미세하게 달라도 히트) */
function nearbyCacheKey(tmX: number, tmY: number): string {
  return `${Math.round(tmX / 100)}:${Math.round(tmY / 100)}`;
}

function getCachedNearbyStations(tmX: number, tmY: number): NearbyStation[] | null {
  const entry = nearbyStationCache.get(nearbyCacheKey(tmX, tmY));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    nearbyStationCache.delete(nearbyCacheKey(tmX, tmY));
    return null;
  }
  return entry.stations;
}

// getAirQuality의 tm: 경로에서는 뒤에 getStationMeasurements가 직렬로 이어지므로
// 총 예산을 지키기 위해 짧게(1.5s) 제한한다. 반면 /by-coords(getRegionByCoords)는
// 뒤 호출이 없어 예산이 남으므로 호출부에서 더 관대한 값을 넘긴다 — 근접측정소 API가
// 간헐적으로 느릴 때 1.5s에서 AbortError→504로 위치 조회가 통째로 실패하던 문제를 방지.
async function getNearbyStations(
  tmX: number,
  tmY: number,
  timeoutMs = 1500,
): Promise<NearbyStation[]> {
  const cached = getCachedNearbyStations(tmX, tmY);
  if (cached) return cached;

  const url = new URL(`${MSRS_BASE}/getNearbyMsrstnList`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('tmX', tmX.toFixed(6));
  url.searchParams.set('tmY', tmY.toFixed(6));
  url.searchParams.set('ver', '1.1');

  // 실 응답은 대부분 <1s. 장애 시 재시도 1회 후 실패하고 캐시 폴백을 기대한다.
  const json = await fetchOpenApi<AirKoreaResponse<NearbyStation>>(url.toString(), {
    endpoint: 'getNearbyMsrstnList',
    timeoutMs,
  });
  assertOpenApiOk(json, 'getNearbyMsrstnList');
  const stations = json.response?.body?.items ?? [];
  nearbyStationCache.set(nearbyCacheKey(tmX, tmY), {
    stations,
    expiresAt: Date.now() + (stations.length > 0 ? NEARBY_CACHE_TTL_MS : NEARBY_EMPTY_TTL_MS),
  });
  return stations;
}

interface TmCoordResult {
  umdName: string;
  sggName: string;
  sidoName: string;
  tmX: string | number;
  tmY: string | number;
}

/**
 * TM 좌표(동 이름 → 측정소 기준 좌표) 응답 캐시.
 * 측정소 TM 좌표는 사실상 정적 데이터라 길게(24h) 캐싱해도 안전하다.
 * 빈 결과(오타 등)도 짧게 캐싱해 같은 검색어의 연속 실패가 upstream을 반복 타지 않게 한다.
 * — 검색이 upstream 지연에 좌우돼 504가 나던 문제의 완충 장치.
 */
const TM_COORDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const TM_COORDS_EMPTY_TTL_MS = 10 * 60 * 1000; // 10분
const tmCoordsCache = new Map<string, { items: TmCoordResult[]; expiresAt: number }>();

// 검색은 사용자가 스피너를 보며 기다리는 흐름이라, 짧은 타임아웃으로 실패하는 것보다
// 조금 더 기다려서라도 결과를 주는 편이 낫다 (재시도 1회 포함 최악 12s).
const TM_COORDS_TIMEOUT_MS = 6000;

async function getTMCoords(query: string): Promise<TmCoordResult[]> {
  const cacheKey = query.trim();
  const cached = tmCoordsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const url = new URL(`${MSRS_BASE}/getTMStdrCrdnt`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  // 문서(measuring-station-api.md)의 기준값인 100을 쓴다. 30이면 동명이 흔한 검색어에서
  // 상류가 끊어 보낸 앞 30건만 받고도 "제한 없음"처럼 보여, 사용자가 찾는 지역이 조용히 빠졌다.
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('umdName', query);

  const json = await fetchOpenApi<AirKoreaResponse<TmCoordResult>>(url.toString(), {
    endpoint: 'getTMStdrCrdnt',
    timeoutMs: TM_COORDS_TIMEOUT_MS,
  });
  assertOpenApiOk(json, 'getTMStdrCrdnt');
  const items = json.response?.body?.items ?? [];
  const totalCount = json.response?.body?.totalCount;
  if (totalCount != null && totalCount > items.length) {
    console.warn(`[getTMStdrCrdnt] "${query}" 결과 ${totalCount}건 중 ${items.length}건만 반환됨 (2페이지 이후 미조회)`);
  }
  tmCoordsCache.set(cacheKey, {
    items,
    expiresAt: Date.now() + (items.length > 0 ? TM_COORDS_CACHE_TTL_MS : TM_COORDS_EMPTY_TTL_MS),
  });
  return items;
}

// ── 대기오염 정보 API ─────────────────────────────────────────

/**
 * 측정값은 모두 옵셔널이다 — 어떤 항목이 오는지는 요청한 `ver`에 달려 있고, 결측 시에는
 * `'-'`가 온다. 필수로 선언하면 `ver`를 잘못 보내 키가 빠져도 컴파일러가 잡지 못한다.
 */
interface StationMeasurement {
  dataTime: string;
  pm10Value?: string;
  pm25Value?: string;
  o3Value?: string;
  no2Value?: string;
  coValue?: string;
}

async function getStationMeasurements(stationName: string): Promise<StationMeasurement[]> {
  const url = new URL(`${ARPL_BASE}/getMsrstnAcctoRltmMesureDnsty`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('numOfRows', '24');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('stationName', stationName);
  url.searchParams.set('dataTerm', 'DAILY');
  url.searchParams.set('ver', MEASUREMENT_VER);

  // getNearbyStations(1.5s) 이후 직렬로 실행되므로 3s로 제한 — 총 4.5s 예산 내 완료.
  const json = await fetchOpenApi<AirKoreaResponse<StationMeasurement>>(url.toString(), {
    endpoint: 'getMsrstnAcctoRltmMesureDnsty',
    timeoutMs: 3000,
  });
  assertOpenApiOk(json, 'getMsrstnAcctoRltmMesureDnsty');
  const items = json.response?.body?.items ?? [];
  warnIfFieldAbsent(items, stationName);
  return items;
}

/**
 * `pm25Value` 키가 응답 항목에 **아예 없는** 경우를 경고한다.
 *
 * 값이 `'-'`인 것(측정소 점검·결측)과 키가 없는 것(요청 `ver`가 그 항목을 주지 않음)은 원인이
 * 전혀 다른데, parseMeasurement를 지나면 둘 다 `null`이 되어 구분이 사라진다. 이 경고가 없으면
 * `ver`를 잘못 보내 전 지역이 "측정 불가"가 되어도 로그에는 "측정소 데이터 비정상"만 남는다.
 */
function warnIfFieldAbsent(items: StationMeasurement[], stationName: string): void {
  const first = items[0];
  if (!first) return;
  const absent = (['pm25Value', 'pm10Value', 'o3Value'] as const).filter((k) => !(k in first));
  if (absent.length > 0) {
    console.error(
      `[getMsrstnAcctoRltmMesureDnsty] ${stationName}: 응답에 ${absent.join(', ')} 키가 없음 — ` +
        `ver=${MEASUREMENT_VER} 요청이 해당 항목을 포함하지 않는다는 뜻이다 (결측 '-'와 다른 문제)`
    );
  }
}

// ── 공개 함수 ────────────────────────────────────────────────

/**
 * 도시명/광역시명 입력 시 해당 도시 내 대표 동 이름으로 추가 검색.
 * AirKorea API는 umdName(읍면동명) 검색만 지원하므로, 도시명 자체는 검색되지 않는다.
 * 도시명 감지 시 아래 대표 동 이름으로 병렬 검색 후 sidoName 필터를 걸어 해당 도시 결과만 포함.
 *
 * 도시 추가 방법: key에 검색어 키워드, value에 해당 도시의 실제 읍면동명 2~3개.
 */
const CITY_DONG_ALIASES: Record<string, { sidoKeyword: string; dongs: string[] }> = {
  '서울': { sidoKeyword: '서울', dongs: ['명동', '역삼', '마포'] },
  '부산': { sidoKeyword: '부산', dongs: ['수영', '범일', '해운대'] },
  '인천': { sidoKeyword: '인천', dongs: ['부평', '연수'] },
  '대구': { sidoKeyword: '대구', dongs: ['수성', '달서'] },
  '광주': { sidoKeyword: '광주', dongs: ['광산', '북구'] },
  '대전': { sidoKeyword: '대전', dongs: ['유성', '둔산'] },
  '울산': { sidoKeyword: '울산', dongs: ['남구', '울주'] },
  '경기': { sidoKeyword: '경기', dongs: ['수원', '성남', '고양'] },
  '강원': { sidoKeyword: '강원', dongs: ['춘천', '강릉'] },
  '제주': { sidoKeyword: '제주', dongs: ['이도', '서귀포'] },
}

/** 검색어와의 관련도 점수 (높을수록 위로) */
function relevanceScore(r: TmCoordResult, q: string): number {
  const lq = q.toLowerCase();
  const umd = r.umdName.toLowerCase();
  const sgg = r.sggName.toLowerCase();
  const sido = r.sidoName.toLowerCase();
  if (umd === lq)           return 4; // 동이름 완전 일치
  if (umd.startsWith(lq))  return 3; // 동이름 전방 일치
  if (umd.includes(lq))    return 2; // 동이름 부분 일치
  if (sgg.includes(lq))    return 1; // 시군구명 포함
  if (sido.includes(lq))   return 1; // 시도명 포함
  return 0; // 도시 alias로 들어온 결과 (쿼리와 직접 매칭 없음)
}

function tmCoordToRegion(r: TmCoordResult): Region {
  const tmX = parseFloat(String(r.tmX));
  const tmY = parseFloat(String(r.tmY));
  const { lat, lng } = tmToLatLng(tmX, tmY);
  return {
    id: `tm:${Math.round(tmX)}:${Math.round(tmY)}`,
    name: `${r.sidoName} ${r.sggName} ${r.umdName}`.replace(/\s+/g, ' ').trim(),
    shortName: r.umdName,
    city: r.sidoName,
    lat,
    lng,
  };
}

export async function searchRegions(query: string): Promise<Region[]> {
  const q = query.trim();
  if (!q) return [];

  // 도시명 키워드 감지.
  // startsWith만 쓰면 '서울대'·'부산진'처럼 도시명으로 시작하는 동네 이름이 도시 경로로 납치되어,
  // 사용자가 찾은 동은 안 나오고 그 도시의 대표 동 목록이 나왔다. 도시명 자체이거나
  // 도시명 + 행정 접미사('서울시'·'부산광역시')일 때만 도시 검색으로 본다.
  const cityAlias = Object.entries(CITY_DONG_ALIASES).find(
    ([key]) => q === key || /^(시|도|특별시|광역시|특별자치시|특별자치도)$/.test(q.slice(key.length)) && q.startsWith(key)
  );

  if (!cityAlias) {
    // 일반 동 이름 검색 — 관련도 순 정렬, 제한 없음
    const results = await getTMCoords(q);
    return results
      .sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q))
      .map(tmCoordToRegion);
  }

  const [cityKey, { sidoKeyword, dongs }] = cityAlias;

  // 원래 쿼리 + 대표 동 이름들을 병렬 검색.
  // 예전에는 primary만 .catch가 없어, 상류가 한 번 흔들리면 별칭 4건이 모두 성공했더라도
  // Promise.all이 reject되어 검색 전체가 502로 죽었다. 이제 모든 갈래를 동등하게 감싸고,
  // 전부 실패했을 때만 에러를 올린다 (한 건이라도 결과가 있으면 그걸 보여주는 편이 낫다).
  const settled = await Promise.allSettled([q, ...dongs].map((term) => getTMCoords(term)));
  const [primarySettled, ...aliasSettled] = settled;
  const firstError = settled.find((r) => r.status === 'rejected');
  if (settled.every((r) => r.status === 'rejected') && firstError?.status === 'rejected') {
    throw firstError.reason;
  }
  for (const r of settled) {
    if (r.status === 'rejected') console.warn('[search] 별칭 검색 일부 실패:', r.reason);
  }
  const primaryResults = primarySettled.status === 'fulfilled' ? primarySettled.value : [];
  const aliasResults = aliasSettled.map((r) => (r.status === 'fulfilled' ? r.value : []));

  // 별칭 결과는 해당 도시(sidoName 키워드 포함)만 유지
  const filteredAliasRaw = aliasResults
    .flat()
    .filter((r) => r.sidoName.includes(sidoKeyword));

  // primary + alias 합치고 TM 좌표 기준 중복 제거 후 관련도 순 정렬
  const allRaw = [...primaryResults, ...filteredAliasRaw];
  const seen = new Set<string>();
  const deduped = allRaw.filter((r) => {
    const key = `${Math.round(parseFloat(String(r.tmX)))}:${Math.round(parseFloat(String(r.tmY)))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[search] "${q}" → 도시 감지(${cityKey}): 직접 ${primaryResults.length}건 + 별칭 ${filteredAliasRaw.length}건`);
  return deduped
    .sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q))
    .map(tmCoordToRegion);
}

export async function getRegionByCoords(lat: number, lng: number): Promise<Region> {
  const { tmX, tmY } = latLngToTM(lat, lng);
  // 단독 호출이라 직렬 예산 제약이 없다 — 검색(getTMCoords, 6s)과 비슷하게 관대한
  // 타임아웃을 주어 upstream 지연으로 인한 간헐적 위치 조회 실패를 줄인다.
  const stations = await getNearbyStations(tmX, tmY, 5000);
  if (stations.length === 0) throw new RegionNotFoundError('주변 측정소를 찾을 수 없습니다.');

  const nearest = stations[0];
  const city = nearest.addr.split(' ')[0] ?? '';
  return {
    id: `station:${nearest.stationName}`,
    name: `${nearest.stationName} 측정소`,
    shortName: nearest.stationName,
    city,
    lat,
    lng,
  };
}

/**
 * regionId + 좌표 → 대기질 + 기상 데이터 + 달리기 지수
 * lat/lng가 있으면 기상청 API도 호출하여 통합
 */
export async function getAirQuality(
  regionId: string,
  lat?: number,
  lng?: number,
): Promise<AirQualityData> {
  const hasWeatherKey = !!process.env.KMA_API_KEY;
  const hasUVKey = !!process.env.AIR_KOREA_API_KEY;
  const hasCoords = lat != null && lng != null;

  let weatherStatus: ServiceStatus['weather'] = hasWeatherKey && hasCoords ? 'ok' : 'unavailable';

  function handleWeatherError(label: string) {
    return (err: unknown): null => {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      weatherStatus = isTimeout ? 'timeout' : 'error';
      console.warn(`[${label}]`, err);
      return null;
    };
  }

  // 측정소 조회 + 기상/UV를 **동시에** 시작
  // 기존: await 측정소 → await 기상 (직렬, 합산 시간)
  // 변경: Promise.all로 병렬 (가장 느린 쪽 기준)
  const [stationResult, currentWeather, hourlyWeather, uvData] = await Promise.all([
    resolveStationWithFallback(regionId, lat, lng),
    hasWeatherKey && hasCoords
      ? getCurrentWeather(lat, lng).catch(handleWeatherError('weather'))
      : Promise.resolve(null),
    hasWeatherKey && hasCoords
      ? getHourlyWeather(lat, lng).catch(handleWeatherError('weather-hourly'))
      : Promise.resolve(null),
    hasUVKey && hasCoords
      ? getUVIndex(lat, lng).catch((err) => {
          console.warn('[uv]', err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const { stationName, measurements, fallback, airKoreaStatus } = stationResult;
  // airKorea는 실제 결과에서 끌어온다. 예전에는 'ok' 고정이어서, 후보 측정소 전부가 실패했거나
  // 전부 결측이어도 응답은 "에어코리아 정상"이라고 주장했고 UI는 아무 경고도 띄우지 못했다.
  const serviceStatus: ServiceStatus = { airKorea: airKoreaStatus, weather: weatherStatus };
  return buildAirQualityData(stationName, measurements, currentWeather, hourlyWeather, uvData, serviceStatus, fallback);
}

// ── 내부 유틸 ──────────────────────────────────────────────

/**
 * 측정 데이터가 비정상인지 판별.
 * PM2.5·PM10 중 **하나라도** 결측이면 점수 계산에 큰 영향이 있으므로
 * 비정상으로 판단해 폴백 측정소로 전환을 시도한다.
 * (기존에는 AND 조건이어서 한쪽만 결측일 땐 폴백 없이 왜곡된 점수가 나갔다)
 */
function isMeasurementFaulty(measurements: StationMeasurement[]): boolean {
  if (measurements.length === 0) return true;
  const latest = measurements[0];
  const isMissing = (v: string | undefined) => v === '-' || v === '' || v == null;
  return isMissing(latest.pm25Value) || isMissing(latest.pm10Value);
}

/**
 * 측정소를 결정하고 측정 데이터를 반환.
 * 모든 후보 측정소를 **병렬**로 조회한 뒤 우선순위대로 정상 데이터를 선택한다.
 * (기존 직렬 루프 대비 최대 3배 빠름)
 */
async function resolveStationWithFallback(
  regionId: string,
  lat?: number,
  lng?: number,
): Promise<{
  stationName: string;
  measurements: StationMeasurement[];
  fallback?: StationFallback;
  airKoreaStatus: ServiceStatus['airKorea'];
}> {
  const stationNames = await resolveStationCandidates(regionId, lat, lng);

  // 모든 후보를 병렬로 조회.
  // allSettled를 쓰는 이유: 후보 하나가 실패해도 나머지로 폴백할 수 있어야 하는데(그래서 예전에
  // `.catch(() => [])`가 있었다), 동시에 "왜 비었는지"를 알아야 serviceStatus를 정직하게 채울 수
  // 있다. catch로 빈 배열을 만들면 '조회 실패'와 '측정소가 결측을 보고함'이 구분되지 않는다.
  const settled = await Promise.allSettled(stationNames.map((name) => getStationMeasurements(name)));

  // 한도 초과·키 오류는 특정 측정소의 문제가 아니라 계정 전체의 문제다. 나머지 후보를 더
  // 조회해도 같은 답이 오고 한도만 더 태우므로, 즉시 라우트로 올려 원인이 드러나게 한다.
  const fatal = settled.find(
    (r): r is PromiseRejectedResult =>
      r.status === 'rejected' &&
      r.reason instanceof UpstreamApiError &&
      (r.reason.kind === 'quota' || r.reason.kind === 'key'),
  );
  if (fatal) throw fatal.reason;

  const results = stationNames.map((name, i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') return { name, measurements: r.value, failed: false };
    console.warn(`[air] ${name} 측정소 조회 실패:`, r.reason);
    return { name, measurements: [] as StationMeasurement[], failed: true };
  });

  // 우선순위대로 정상 데이터 선택
  for (let i = 0; i < results.length; i++) {
    const { name, measurements, failed } = results[i];
    if (failed) continue;
    if (!isMeasurementFaulty(measurements)) {
      if (i > 0) {
        console.log(`[air] ${stationNames[0]} → ${name} 측정소로 폴백 완료`);
        return {
          stationName: name,
          measurements,
          airKoreaStatus: 'ok',
          fallback: {
            originalStation: stationNames[0],
            fallbackStation: name,
            reason: `${stationNames[0]} 측정소 데이터 비정상 (점검 중 추정)`,
          },
        };
      }
      return { stationName: name, measurements, airKoreaStatus: 'ok' };
    }
    console.warn(`[air] ${name} 측정소 데이터 비정상 (PM2.5 또는 PM10 결측)`);
  }

  // 쓸 수 있는 후보가 없다. 두 경우를 구분해 UI가 다른 문장을 띄울 수 있게 한다.
  //   - 전 후보 조회 실패 → 'error'/'timeout' (상류 문제)
  //   - 조회는 됐지만 전 후보가 결측  → 'ok' (측정소 점검. 상류는 정상이므로 거짓말하지 않는다)
  const allFailed = results.every((r) => r.failed);
  const timedOut = settled.some(
    (r) => r.status === 'rejected' && r.reason instanceof Error && r.reason.name === 'AbortError',
  );
  const status: ServiceStatus['airKorea'] = allFailed ? (timedOut ? 'timeout' : 'error') : 'ok';
  return { stationName: results[0].name, measurements: results[0].measurements, airKoreaStatus: status };
}

/** regionId에서 측정소 후보 목록을 반환 (최대 3곳) */
async function resolveStationCandidates(regionId: string, lat?: number, lng?: number): Promise<string[]> {
  if (regionId.startsWith('station:')) {
    const primary = regionId.slice('station:'.length);
    // 예전에는 캐시가 살아 있을 때만 폴백 후보를 확장해서, 같은 regionId가 캐시 온도에 따라
    // 데이터를 주거나 전부 null을 주었다 — 문서(결측값 처리 규칙 2)가 약속한 주변 측정소 폴백이
    // 서버 재시작·TTL 만료 직후에는 동작하지 않는 것이다. 이제 항상 조회해 동작을 일정하게 한다.
    // 이 호출은 1시간 캐싱되고 실패해도 1순위 측정소로 진행하므로 추가 위험은 없다.
    if (lat != null && lng != null) {
      const { tmX, tmY } = latLngToTM(lat, lng);
      const nearby = await getNearbyStations(tmX, tmY).catch((err) => {
        console.warn('[air] 폴백 후보 조회 실패 — 1순위 측정소만 사용:', err);
        return [] as NearbyStation[];
      });
      const candidates = [primary, ...nearby.map((s) => s.stationName).filter((n) => n !== primary)];
      return candidates.slice(0, 3);
    }
    return [primary];
  }
  if (regionId.startsWith('tm:')) {
    const parts = regionId.split(':');
    const tmX = parseFloat(parts[1]);
    const tmY = parseFloat(parts[2]);
    if (isNaN(tmX) || isNaN(tmY)) throw new RegionNotFoundError(`잘못된 TM 좌표: ${regionId}`);
    const stations = await getNearbyStations(tmX, tmY);
    if (stations.length === 0) throw new RegionNotFoundError('측정소를 찾을 수 없습니다.');
    return stations.slice(0, 3).map((s) => s.stationName);
  }
  throw new RegionNotFoundError(`알 수 없는 regionId 형식: ${regionId}`);
}

function toWeatherInfo(w: Awaited<ReturnType<typeof getCurrentWeather>>, uvIndex?: number): WeatherInfo {
  return {
    temperature: w.temperature,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
    precipitation: w.precipitation,
    uvIndex,
  };
}

function buildAirQualityData(
  stationName: string,
  measurements: StationMeasurement[],
  currentWeather: Awaited<ReturnType<typeof getCurrentWeather>> | null,
  hourlyWeather: HourlyWeatherMap | null,
  uvData: UVData | null,
  serviceStatus: ServiceStatus,
  fallback?: StationFallback,
): AirQualityData {
  // 기준 시각은 실제 최신 측정값의 시각으로 고정한다.
  // 에어코리아는 매시 정각 측정을 30~60분 지연 발표하므로 서버 wall-clock(now)을
  // 그대로 쓰면 "15:30 측정"이라 표시되지만 실제 데이터는 14:00인 불일치가 발생한다.
  // → updatedAt/currentHour 모두 latestItem.dataTime 기준으로 정렬해 라벨·칩·차트가 일치하도록 한다.
  const latestItem = measurements[0];
  const updatedAt = latestItem ? parseKstDataTime(latestItem.dataTime) : new Date();
  const currentHour = latestItem ? parseHour(latestItem.dataTime) : getKstHour(new Date());

  // 과거 시간별 실측값은 의도적으로 쓰지 않는다.
  // 차트가 "0~23시 달력"에서 "지금부터 24시간"으로 바뀐 뒤 모든 바가 현재 또는 미래가 되어,
  // DAILY로 받아 온 과거 측정값을 매핑할 자리가 사라졌다. 예전에는 그 맵을 만들어 놓고
  // 한 번도 읽지 않아, 읽는 사람이 "과거 실측이 반영된다"고 오해하게 만들었다.
  // (running-index-algorithm.md의 '데이터 소스 우선순위'도 이 변경에 맞춰 고쳤다)

  // 현재(=최신 측정) 데이터
  const currentMetrics = latestItem ? parseMeasurement(latestItem) : defaultMetrics();
  const currentUV = uvData?.current;
  const currentWx = currentWeather ? toWeatherInfo(currentWeather, currentUV) : undefined;
  const currentRunningIndex = getRunningIndex(currentMetrics, currentWx, currentHour);

  // 현재 시각부터 +24시간 예보
  // 모든 바가 미래(또는 현재)이므로 과거 폴백 문제가 없다.
  // 단기예보(hourlyWeather)는 발표 시각 이후 데이터를 포함하므로
  // 거의 모든 바에 실제 기상 데이터가 존재한다.
  const hourlyForecast = Array.from({ length: 24 }, (_, i) => {
    const rawHour = currentHour + i;
    const hour = rawHour % 24;
    const isNextDay = rawHour >= 24;

    // 현재 시각 바(i===0): 카드 칩과 100% 동일한 값 재사용
    if (i === 0) {
      return {
        hour,
        isNextDay: undefined,
        airQuality: currentMetrics,
        weather: currentWx,
        runningIndex: currentRunningIndex,
      };
    }

    // 대기질: 미래이므로 항상 예측
    const metrics = predictMetrics(currentMetrics, hour);

    // UV — 3시간 간격 발표값 사이는 uvIndexClient가 보간해 채워 두었다.
    // 그래도 없으면 현재값으로 폴백하되, 없는 것을 0으로 만들지는 않는다.
    const hourUV = uvData?.hourly.get(hour) ?? currentUV;

    // 기상: 이 바의 실제 KST 날짜로 조회한다.
    // 기준 시각(updatedAt)은 에어코리아 dataTime이고 예보 맵은 기상청 날짜 키이므로,
    // '오늘/내일'이 아니라 날짜 문자열로 맞춰야 자정 전후에 하루가 어긋나지 않는다.
    const barInstant = new Date(updatedAt.getTime() + i * 3_600_000);
    const wx = hourlyWeather?.get(kstDateKey(barInstant))?.get(hour);
    const weatherInfo = wx ? toWeatherInfo(wx, hourUV) : currentWx;

    return {
      hour,
      isNextDay: isNextDay || undefined,
      airQuality: metrics,
      weather: weatherInfo,
      runningIndex: getRunningIndex(metrics, weatherInfo, hour),
    };
  });

  // 최적 시간 — **점수 내림차순**으로 상위 3개. 순서가 계약이다.
  // 프론트엔드는 이 배열을 순위로 읽는다(헤드라인은 [0], 목록은 1·2·3위, 홈 미리보기는 상위 2개
  // 강조). 예전에는 점수로 고른 뒤 시각 오름차순으로 다시 정렬해 내려보내서, 세 화면 모두
  // "가장 좋은 시간" 자리에 가장 이른 시간을 보여 주고 있었다.
  //
  // 오늘 안에서 먼저 채우고 모자랄 때만 내일로 넘어간다. 예전의 `currentHour >= 22` 규칙은
  // 21시에 오늘 후보가 2개(22·23시)뿐인데도 내일을 막아 추천이 사실상 사라지는 절벽이 있었다.
  const candidates = hourlyForecast
    .slice(1) // i===0은 "지금" 바이므로 추천에서 제외
    .filter((h) => h.runningIndex.score >= BEST_HOUR_MIN_SCORE);
  const byScore = (a: typeof candidates[number], b: typeof candidates[number]) =>
    b.runningIndex.score - a.runningIndex.score;
  const bestRunningHours = [
    ...candidates.filter((h) => !h.isNextDay).sort(byScore),
    ...candidates.filter((h) => h.isNextDay).sort(byScore),
  ]
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, isNextDay: !!h.isNextDay }));

  return {
    regionName: fallback ? `${fallback.fallbackStation} 측정소` : `${stationName} 측정소`,
    updatedAt,
    stationFallback: fallback,
    serviceStatus,
    current: {
      airQuality: currentMetrics,
      weather: currentWx,
      runningIndex: currentRunningIndex,
    },
    hourlyForecast,
    bestRunningHours,
  };
}

function parseMeasurement(item: StationMeasurement): AirQualityMetrics {
  return {
    pm25: parseNumOrNull(item.pm25Value),
    pm10: parseNumOrNull(item.pm10Value),
    o3: roundOrNull(parseNumOrNull(item.o3Value), 3),
    no2: roundOrNull(parseNumOrNull(item.no2Value), 3),
    co: roundOrNull(parseNumOrNull(item.coValue), 2),
  };
}

/**
 * 에어코리아 응답의 측정값은 결측 시 `"-"` 또는 `""`로 전달된다.
 * 이를 `0`으로 변환하면 러닝 지수 계산에서 "매우 깨끗한 공기"로 오해석되어
 * 점수가 실제와 반대로 100점에 가까워지는 버그가 생긴다.
 * → 결측값은 반드시 `null`로 전파하여 상위 로직(getRunningIndex)에서
 *   'unknown' 상태로 돌릴 수 있도록 한다.
 */
function parseNumOrNull(v: string | null | undefined): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function roundOrNull(v: number | null, decimals: number): number | null {
  return v == null ? null : parseFloat(v.toFixed(decimals));
}

function parseHour(dataTime: string): number {
  return parseInt(dataTime.split(' ')[1]?.split(':')[0] ?? '0', 10);
}

/** 에어코리아 dataTime("YYYY-MM-DD HH:mm", KST 기준)을 Date 인스턴트로 변환 */
function parseKstDataTime(dataTime: string): Date {
  const [date, time] = dataTime.split(' ');
  // 정각 기준 "HH:mm" 포맷. +09:00 오프셋을 명시해 서버 TZ와 무관한 UTC 인스턴트 생성
  return new Date(`${date}T${time}:00+09:00`);
}

/** 서버 TZ와 무관하게 KST 기준 시간(0~23) 반환 */
function getKstHour(d: Date): number {
  const kst = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60_000);
  return kst.getHours();
}

function defaultMetrics(): AirQualityMetrics {
  return { pm25: null, pm10: null, o3: null, no2: null, co: null };
}

/** base 값이 null이면 예측값도 null(측정 불가) — 0으로 조작하지 않는다 */
function predictMetrics(base: AirQualityMetrics, hour: number): AirQualityMetrics {
  const factor = isRushHour(hour) ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0;
  const scale = (v: number | null, f: number, decimals: number) =>
    v == null ? null : parseFloat((v * f).toFixed(decimals));
  return {
    pm25: scale(base.pm25, factor, 1),
    pm10: scale(base.pm10, factor, 1),
    o3:   scale(base.o3,   isRushHour(hour) ? 1.2 : factor, 3),
    no2:  scale(base.no2,  factor, 3),
    co:   scale(base.co,   factor, 2),
  };
}

function isRushHour(h: number) {
  return (h >= 7 && h <= 9) || (h >= 17 && h <= 19);
}
function isEarlyMorning(h: number) {
  return h >= 3 && h <= 6;
}
