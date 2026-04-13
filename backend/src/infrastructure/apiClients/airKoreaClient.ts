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
  StationFallback,
  WeatherInfo,
} from '../../domain/entities/airQuality';
import type { Region } from '../../domain/entities/region';
import { getRunningIndex } from '../../domain/useCases/getRunningIndex';
import { getCurrentWeather, getHourlyWeather, type HourlyWeatherMap } from './weatherClient';

const API_KEY = process.env.AIR_KOREA_API_KEY ?? '';
const MSRS_BASE = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc';
const ARPL_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';

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

  const res = await fetch(url.toString());
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
  url.searchParams.set('numOfRows', '20');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('umdName', query);

  const res = await fetch(url.toString());
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

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`getMsrstnAcctoRltmMesureDnsty HTTP ${res.status}`);
  const json = (await res.json()) as AirKoreaResponse<StationMeasurement>;
  const { resultCode, resultMsg } = json.response.header;
  if (resultCode !== '00') throw new Error(`getMsrstnAcctoRltmMesureDnsty API 오류: ${resultMsg}`);
  return json.response.body.items ?? [];
}

// ── 공개 함수 ────────────────────────────────────────────────

export async function searchRegions(query: string): Promise<Region[]> {
  const results = await getTMCoords(query.trim());
  return results.slice(0, 6).map((r) => {
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
  });
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
  const { stationName, measurements, fallback } = await resolveStationWithFallback(regionId);

  // 기상 병렬 호출
  const hasWeatherKey = !!process.env.KMA_API_KEY;
  const hasCoords = lat != null && lng != null;

  const [currentWeather, hourlyWeather] = await Promise.all([
    hasWeatherKey && hasCoords
      ? getCurrentWeather(lat, lng).catch((err) => {
          console.warn('[weather]', err);
          return null;
        })
      : Promise.resolve(null),
    hasWeatherKey && hasCoords
      ? getHourlyWeather(lat, lng).catch((err) => {
          console.warn('[weather-hourly]', err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return buildAirQualityData(stationName, measurements, currentWeather, hourlyWeather, fallback);
}

// ── 내부 유틸 ──────────────────────────────────────────────

/** 측정 데이터가 비정상(PM2.5·PM10 모두 0 또는 빈 값)인지 판별 */
function isMeasurementFaulty(measurements: StationMeasurement[]): boolean {
  if (measurements.length === 0) return true;
  const latest = measurements[0];
  const pm25 = parseNum(latest.pm25Value);
  const pm10 = parseNum(latest.pm10Value);
  return pm25 === 0 || pm10 === 0;
}

/**
 * 측정소를 결정하고 측정 데이터를 반환.
 * 1순위 측정소의 데이터가 비정상이면 근처 다른 측정소로 폴백 (최대 3곳).
 */
async function resolveStationWithFallback(
  regionId: string,
): Promise<{
  stationName: string;
  measurements: StationMeasurement[];
  fallback?: StationFallback;
}> {
  const stationNames = await resolveStationCandidates(regionId);

  for (let i = 0; i < stationNames.length; i++) {
    const name = stationNames[i];
    const measurements = await getStationMeasurements(name);
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
    console.warn(`[air] ${name} 측정소 데이터 비정상 (PM2.5·PM10 = 0), 다음 측정소 시도`);
  }

  // 모든 측정소가 비정상이면 1순위 데이터라도 반환
  const fallbackMeasurements = await getStationMeasurements(stationNames[0]);
  return { stationName: stationNames[0], measurements: fallbackMeasurements };
}

/** regionId에서 측정소 후보 목록을 반환 (최대 3곳) */
async function resolveStationCandidates(regionId: string): Promise<string[]> {
  if (regionId.startsWith('station:')) {
    const primary = regionId.slice('station:'.length);
    // station: 형태는 좌표 기반이므로 근처 측정소 목록을 가져올 수 없음
    // 1곳만 반환
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

function toWeatherInfo(w: Awaited<ReturnType<typeof getCurrentWeather>>): WeatherInfo {
  return {
    temperature: w.temperature,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
    precipitation: w.precipitation,
  };
}

function buildAirQualityData(
  stationName: string,
  measurements: StationMeasurement[],
  currentWeather: Awaited<ReturnType<typeof getCurrentWeather>> | null,
  hourlyWeather: HourlyWeatherMap | null,
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
  const currentWx = currentWeather ? toWeatherInfo(currentWeather) : undefined;
  const currentRunningIndex = getRunningIndex(currentMetrics, currentWx, currentHour);

  // 현재 시간 ±12시간 예보 구성 (총 24시간)
  // 3구간: isPrevDay(rawHour < 0), today(0 <= rawHour < 24), isNextDay(rawHour >= 24)
  //
  // 대기질(metrics) 소스:
  //   - 어제(isPrevDay): 예측 (현재값 기반)
  //   - 오늘 과거~현재: hourlyMap 실측 > currentMetrics 폴백
  //   - 오늘 미래 / 내일: 예측 (현재값 기반)
  //   - 현재 시각 정확히: currentMetrics 고정 (카드 칩과 동일)
  //
  // 기상(weather) 소스:
  //   - 어제: currentWx 폴백 (KMA에 과거 시간별 API 없음)
  //   - 오늘: hourlyWeather.today > currentWx 폴백
  //   - 내일: hourlyWeather.tomorrow (폴백 없음 — 데이터가 없으면 undefined)
  //   - 현재 시각: currentWx 고정
  const startHour = currentHour - 12;
  const hourlyForecast = Array.from({ length: 24 }, (_, i) => {
    const rawHour = startHour + i;
    const hour = ((rawHour % 24) + 24) % 24; // 0~23으로 정규화
    const isPrevDay = rawHour < 0;
    const isNextDay = rawHour >= 24;
    const isToday = !isPrevDay && !isNextDay;
    const isCurrent = isToday && hour === currentHour;
    const isTodayPast = isToday && hour < currentHour;

    // 현재 시각 바: 카드 칩과 100% 동일한 값 재사용
    if (isCurrent) {
      return {
        hour,
        isPrevDay: undefined,
        isNextDay: undefined,
        airQuality: currentMetrics,
        weather: currentWx,
        runningIndex: currentRunningIndex,
      };
    }

    // 대기질 결정
    let metrics: AirQualityMetrics;
    if (isTodayPast && hourlyMap.has(hour)) {
      metrics = hourlyMap.get(hour)!;
    } else if (isTodayPast) {
      metrics = currentMetrics;
    } else {
      // 어제 / 오늘 미래 / 내일 → 예측
      metrics = predictMetrics(currentMetrics, hour);
    }

    // 기상 결정
    let weatherInfo: WeatherInfo | undefined;
    if (isNextDay) {
      const wx = hourlyWeather?.tomorrow.get(hour);
      weatherInfo = wx ? toWeatherInfo(wx) : undefined;
    } else {
      // 어제 또는 오늘
      const wx = hourlyWeather?.today.get(hour);
      weatherInfo = wx ? toWeatherInfo(wx) : currentWx;
    }

    return {
      hour,
      isPrevDay: isPrevDay || undefined,
      isNextDay: isNextDay || undefined,
      airQuality: metrics,
      weather: weatherInfo,
      runningIndex: getRunningIndex(metrics, weatherInfo, hour),
    };
  });

  // 최적 시간: 오늘 현재 이후 + 내일만 (어제 확실히 제외), 점수 60 이상
  const bestRunningHours = [...hourlyForecast]
    .filter((h) => {
      if (h.isPrevDay) return false;
      const isFuture = h.isNextDay || h.hour > currentHour;
      return isFuture && h.runningIndex.score >= 60;
    })
    .sort((a, b) => b.runningIndex.score - a.runningIndex.score)
    .slice(0, 3)
    .sort((a, b) => {
      if (a.isNextDay !== b.isNextDay) return a.isNextDay ? 1 : -1;
      return a.hour - b.hour;
    })
    .map((h) => h.hour);

  return {
    regionName: fallback ? `${fallback.fallbackStation} 측정소` : `${stationName} 측정소`,
    updatedAt,
    stationFallback: fallback,
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
