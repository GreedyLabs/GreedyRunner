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
import { getRunningIndex } from '../../domain/useCases/getRunningIndex';
import { getCurrentWeather, getHourlyWeather, type HourlyWeatherMap } from './weatherClient';
import { getUVIndex, type UVData } from './uvIndexClient';

const API_KEY = process.env.AIR_KOREA_API_KEY ?? '';
const MSRS_BASE = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc';
const ARPL_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
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

interface AirKoreaResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: { items: T[]; totalCount: number };
  };
}

// ── 측정소 정보 API ──────────────────────────────────────────

interface NearbyStation {
  stationName: string;
  addr: string;
  tm: number;
}

async function getNearbyStations(tmX: number, tmY: number): Promise<NearbyStation[]> {
  const url = new URL(`${MSRS_BASE}/getNearbyMsrstnList`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('tmX', tmX.toFixed(6));
  url.searchParams.set('tmY', tmY.toFixed(6));
  url.searchParams.set('ver', '1.1');

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) throw new Error(`getNearbyMsrstnList HTTP ${res.status}`);
  const json = (await res.json()) as AirKoreaResponse<NearbyStation>;
  const { resultCode, resultMsg } = json.response.header;
  if (resultCode !== '00') throw new Error(`getNearbyMsrstnList API 오류: ${resultMsg}`);
  return json.response.body.items ?? [];
}

interface TmCoordResult {
  umdName: string;
  sggName: string;
  sidoName: string;
  tmX: string | number;
  tmY: string | number;
}

async function getTMCoords(query: string): Promise<TmCoordResult[]> {
  const url = new URL(`${MSRS_BASE}/getTMStdrCrdnt`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('numOfRows', '30');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('umdName', query);

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) throw new Error(`getTMStdrCrdnt HTTP ${res.status}`);
  const json = (await res.json()) as AirKoreaResponse<TmCoordResult>;
  const { resultCode, resultMsg } = json.response.header;
  if (resultCode !== '00') throw new Error(`getTMStdrCrdnt API 오류: ${resultMsg}`);
  return json.response.body.items ?? [];
}

// ── 대기오염 정보 API ─────────────────────────────────────────

interface StationMeasurement {
  dataTime: string;
  pm10Value: string;
  pm25Value: string;
  o3Value: string;
  no2Value: string;
  coValue: string;
}

async function getStationMeasurements(stationName: string): Promise<StationMeasurement[]> {
  const url = new URL(`${ARPL_BASE}/getMsrstnAcctoRltmMesureDnsty`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('numOfRows', '24');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('stationName', stationName);
  url.searchParams.set('dataTerm', 'DAILY');
  url.searchParams.set('ver', '1.0');

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) throw new Error(`getMsrstnAcctoRltmMesureDnsty HTTP ${res.status}`);
  const json = (await res.json()) as AirKoreaResponse<StationMeasurement>;
  const { resultCode, resultMsg } = json.response.header;
  if (resultCode !== '00') throw new Error(`getMsrstnAcctoRltmMesureDnsty API 오류: ${resultMsg}`);
  return json.response.body.items ?? [];
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

  // 도시명 키워드 감지
  const cityAlias = Object.entries(CITY_DONG_ALIASES).find(([key]) => q === key || q.startsWith(key));

  if (!cityAlias) {
    // 일반 동 이름 검색 — 관련도 순 정렬, 제한 없음
    const results = await getTMCoords(q);
    return results
      .sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q))
      .map(tmCoordToRegion);
  }

  const [cityKey, { sidoKeyword, dongs }] = cityAlias;

  // 원래 쿼리 + 대표 동 이름들을 병렬 검색
  const [primaryResults, ...aliasResults] = await Promise.all([
    getTMCoords(q),
    ...dongs.map((dong) => getTMCoords(dong).catch(() => [] as TmCoordResult[])),
  ]);

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
  const stations = await getNearbyStations(tmX, tmY);
  if (stations.length === 0) throw new Error('주변 측정소를 찾을 수 없습니다.');

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

  const { stationName, measurements, fallback } = stationResult;
  const serviceStatus: ServiceStatus = { airKorea: 'ok', weather: weatherStatus };
  return buildAirQualityData(stationName, measurements, currentWeather, hourlyWeather, uvData, serviceStatus, fallback);
}

// ── 내부 유틸 ──────────────────────────────────────────────

/** 측정 데이터가 비정상(PM2.5·PM10 모두 결측("-") 또는 빈 값)인지 판별 */
function isMeasurementFaulty(measurements: StationMeasurement[]): boolean {
  if (measurements.length === 0) return true;
  const latest = measurements[0];
  const isMissing = (v: string) => v === '-' || v === '' || v == null;
  return isMissing(latest.pm25Value) && isMissing(latest.pm10Value);
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
}> {
  const stationNames = await resolveStationCandidates(regionId, lat, lng);

  // 모든 후보를 병렬로 조회
  const results = await Promise.all(
    stationNames.map(async (name) => ({
      name,
      measurements: await getStationMeasurements(name).catch(() => [] as StationMeasurement[]),
    })),
  );

  // 우선순위대로 정상 데이터 선택
  for (let i = 0; i < results.length; i++) {
    const { name, measurements } = results[i];
    if (!isMeasurementFaulty(measurements)) {
      if (i > 0) {
        console.log(`[air] ${stationNames[0]} → ${name} 측정소로 폴백 완료`);
        return {
          stationName: name,
          measurements,
          fallback: {
            originalStation: stationNames[0],
            fallbackStation: name,
            reason: `${stationNames[0]} 측정소 데이터 비정상 (점검 중 추정)`,
          },
        };
      }
      return { stationName: name, measurements };
    }
    console.warn(`[air] ${name} 측정소 데이터 비정상 (PM2.5·PM10 결측)`);
  }

  // 모든 측정소가 비정상이면 1순위 데이터라도 반환
  return { stationName: results[0].name, measurements: results[0].measurements };
}

/** regionId에서 측정소 후보 목록을 반환 (최대 3곳) */
async function resolveStationCandidates(regionId: string, lat?: number, lng?: number): Promise<string[]> {
  if (regionId.startsWith('station:')) {
    const primary = regionId.slice('station:'.length);
    // station: 타입은 /by-coords에서 이미 getNearbyStations를 호출해 얻은 1순위 측정소다.
    // 여기서 다시 getNearbyStations를 호출하면 동일 API를 연달아 2번 호출해 응답 지연이 배가된다.
    // tm: 타입과 달리 좌표→측정소 변환이 이미 완료된 상태이므로 1곳만 반환한다.
    void lat; void lng; // 향후 사용 가능성을 위해 파라미터 유지
    return [primary];
  }
  if (regionId.startsWith('tm:')) {
    const parts = regionId.split(':');
    const tmX = parseFloat(parts[1]);
    const tmY = parseFloat(parts[2]);
    if (isNaN(tmX) || isNaN(tmY)) throw new Error(`잘못된 TM 좌표: ${regionId}`);
    const stations = await getNearbyStations(tmX, tmY);
    if (stations.length === 0) throw new Error('측정소를 찾을 수 없습니다.');
    return stations.slice(0, 3).map((s) => s.stationName);
  }
  throw new Error(`알 수 없는 regionId 형식: ${regionId}`);
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

  // 실측 데이터를 시간별로 매핑
  const hourlyMap = new Map<number, AirQualityMetrics>();
  for (const item of measurements) {
    const hour = parseHour(item.dataTime);
    if (!hourlyMap.has(hour)) hourlyMap.set(hour, parseMeasurement(item));
  }

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

    // UV
    const hourUV = uvData?.hourly.get(hour) ?? currentUV;

    // 기상: 오늘 또는 내일 단기예보
    const wx = isNextDay
      ? hourlyWeather?.tomorrow.get(hour)
      : hourlyWeather?.today.get(hour);
    const weatherInfo = wx ? toWeatherInfo(wx, hourUV) : currentWx;

    return {
      hour,
      isNextDay: isNextDay || undefined,
      airQuality: metrics,
      weather: weatherInfo,
      runningIndex: getRunningIndex(metrics, weatherInfo, hour),
    };
  });

  // 최적 시간: 점수 65 이상, 현재 시각 제외
  // 22시 이전: 오늘 이내만 추천
  // 22시 이후: 오늘 남은 시간이 부족하므로 내일까지 포함
  const includeNextDay = currentHour >= 22;
  const bestRunningHours = [...hourlyForecast]
    .filter((h) => {
      if (h.hour === currentHour && !h.isNextDay) return false;
      if (!includeNextDay && h.isNextDay) return false;
      return h.runningIndex.score >= 65;
    })
    .sort((a, b) => b.runningIndex.score - a.runningIndex.score)
    .slice(0, 3)
    .sort((a, b) => {
      if (a.isNextDay !== b.isNextDay) return a.isNextDay ? 1 : -1;
      return a.hour - b.hour;
    })
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
    pm25: parseNum(item.pm25Value),
    pm10: parseNum(item.pm10Value),
    o3: roundTo(parseNum(item.o3Value), 3),
    no2: roundTo(parseNum(item.no2Value), 3),
    co: roundTo(parseNum(item.coValue), 2),
  };
}

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function roundTo(v: number, decimals: number): number {
  return parseFloat(v.toFixed(decimals));
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
  return { pm25: 0, pm10: 0, o3: 0, no2: 0, co: 0 };
}

function predictMetrics(base: AirQualityMetrics, hour: number): AirQualityMetrics {
  const factor = isRushHour(hour) ? 1.4 : isEarlyMorning(hour) ? 0.6 : 1.0;
  return {
    pm25: roundTo(base.pm25 * factor, 1),
    pm10: roundTo(base.pm10 * factor, 1),
    o3: roundTo(base.o3 * (isRushHour(hour) ? 1.2 : factor), 3),
    no2: roundTo(base.no2 * factor, 3),
    co: roundTo(base.co * factor, 2),
  };
}

function isRushHour(h: number) {
  return (h >= 7 && h <= 9) || (h >= 17 && h <= 19);
}
function isEarlyMorning(h: number) {
  return h >= 3 && h <= 6;
}
