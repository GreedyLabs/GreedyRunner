/**
 * 기상청 생활기상지수 API — 자외선지수 조회 (getUVIdxV4)
 *
 * 발표 시각: 매일 06시, 18시 (KST)
 * 예보 범위: 발표 시각부터 +24시간 (3시간 간격: h0, h3, h6 … h24)
 * 등급: 0~2 낮음, 3~5 보통, 6~7 높음, 8~10 매우높음, 11+ 위험
 *
 * 환경변수: UV_API_KEY (공공데이터포털 서비스키)
 */

import { latLngToAreaNo } from './areaNoLookup';

// 공공데이터포털 서비스키 — 에어코리아와 동일한 포털 키 사용
const API_KEY = process.env.AIR_KOREA_API_KEY ?? '';
const BASE_URL = 'https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4';

// ── KST 유틸 ────────────────────────────────────────────────

function nowKST(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 9 * 60 * 60_000);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * UV 발표 기준 시각 — 06시 또는 18시.
 * 현재 시각이 06시 미만이면 전날 18시 데이터를 사용한다.
 */
function getUVBaseTime(): string {
  const kst = nowKST();
  const h = kst.getHours();

  if (h >= 18) {
    return `${formatDate(kst)}18`;
  }
  if (h >= 6) {
    return `${formatDate(kst)}06`;
  }
  // 00~05시: 전날 18시
  kst.setDate(kst.getDate() - 1);
  return `${formatDate(kst)}18`;
}

// ── API 응답 타입 ────────────────────────────────────────────

interface UVResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: {
        item: Array<{
          code: string;
          areaNo: string;
          date: string;
          h0?: string;
          h3?: string;
          h6?: string;
          h9?: string;
          h12?: string;
          h15?: string;
          h18?: string;
          h21?: string;
          h24?: string;
        }>;
      };
    };
  };
}

// ── API 호출 ─────────────────────────────────────────────────

async function fetchUVIndex(areaNo: string): Promise<Map<number, number>> {
  const time = getUVBaseTime();
  const url = new URL(`${BASE_URL}/getUVIdxV4`);
  url.searchParams.set('serviceKey', API_KEY);
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('areaNo', areaNo);
  url.searchParams.set('time', time);
  url.searchParams.set('numOfRows', '10');
  url.searchParams.set('pageNo', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`UV API HTTP ${res.status}`);
  const json = (await res.json()) as UVResponse;

  const { resultCode, resultMsg } = json.response.header;
  if (resultCode !== '00') throw new Error(`UV API 오류: ${resultMsg}`);

  const items = json.response.body.items?.item ?? [];
  if (items.length === 0) return new Map();

  const item = items[0];
  const baseHour = parseInt(time.slice(-2), 10);
  const result = new Map<number, number>();

  const offsets: Array<[string, number]> = [
    ['h0', 0], ['h3', 3], ['h6', 6], ['h9', 9],
    ['h12', 12], ['h15', 15], ['h18', 18], ['h21', 21], ['h24', 24],
  ];

  for (const [key, offset] of offsets) {
    const val = item[key as keyof typeof item];
    if (val != null && val !== '') {
      const uv = parseInt(String(val), 10);
      if (!isNaN(uv)) {
        const hour = (baseHour + offset) % 24;
        result.set(hour, uv);
      }
    }
  }

  return result;
}

// ── 공개 함수 ────────────────────────────────────────────────

export interface UVData {
  /** 현재 시각 기준 UV 지수 (가장 가까운 3시간 단위) */
  current: number;
  /** 시간별 UV 지수 Map<hour(0~23), uvIndex> */
  hourly: Map<number, number>;
}

/**
 * 좌표 → 자외선지수 조회.
 * 내부적으로 lat/lng → areaNo 변환 후 KMA API 호출.
 */
export async function getUVIndex(lat: number, lng: number): Promise<UVData> {
  const areaNo = latLngToAreaNo(lat, lng);
  const hourly = await fetchUVIndex(areaNo);

  // 현재 시각에 가장 가까운 값 선택
  const kstHour = nowKST().getHours();
  const nearestHour = [...hourly.keys()]
    .sort((a, b) => Math.abs(a - kstHour) - Math.abs(b - kstHour))[0];
  const current = nearestHour !== undefined ? (hourly.get(nearestHour) ?? 0) : 0;

  return { current, hourly };
}
