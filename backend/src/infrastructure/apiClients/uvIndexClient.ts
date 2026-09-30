/**
 * 기상청 생활기상지수 API — 자외선지수 조회 (getUVIdxV5)
 *
 * 데이터셋: https://www.data.go.kr/data/15085288/openapi.do (생활기상지수 조회서비스)
 * V2/V3는 폐기됐고 V4/V5가 동일 스키마로 서비스 중 — 가이드 기준 V5 사용.
 *
 * 발표 시각: 매일 06시, 18시 (KST)
 * 예보 범위: 발표 시각부터 +24시간 (3시간 간격: h0, h3, h6 … h24)
 * 등급: 0~2 낮음, 3~5 보통, 6~7 높음, 8~10 매우높음, 11+ 위험
 *
 * 환경변수: AIR_KOREA_API_KEY (공공데이터포털 서비스키 — 에어코리아와 공용)
 */

import { latLngToAreaNo } from './areaNoLookup';
import { assertOpenApiOk, fetchOpenApi, UpstreamApiError } from './openApiResponse';

// 공공데이터포털 서비스키 — 에어코리아와 동일한 포털 키 사용
const API_KEY = process.env.AIR_KOREA_API_KEY ?? '';
const BASE_URL = 'https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5';

const UV_TIMEOUT_MS = 4000;

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
 *
 * `back`은 몇 발표분 이전을 볼지 지정한다. 발표는 06:00·18:00 정각이 아니라 몇 분 뒤에
 * 올라오므로, 06:0x·18:0x에 접속하면 방금 지난 발표분이 아직 없어 NODATA가 온다.
 * 다른 두 클라이언트와 달리 여기에는 지연 여유가 없어 그 창에서 UV가 통째로 빠졌다
 * — UV 가중치(5%)와 UV 점수 상한이 사라져 한낮 점수가 부풀려진다.
 */
function getUVBaseTime(back = 0): string {
  const kst = nowKST();
  // 06시/18시 발표를 하나의 축으로 세어 back 발표분 이전으로 내린다.
  // (하루 2회 발표이므로 back 1 = 12시간 전)
  kst.setHours(kst.getHours() - back * 12);
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

/** airKorea 쪽과 같은 이유로 모든 단계를 옵셔널로 둔다 (openApiResponse.ts 참고). */
interface UVResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: {
        item?: Array<{
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
  let time = getUVBaseTime();
  let json: UVResponse | null = null;

  // 발표 지연 구간(06:0x·18:0x)에서는 직전 발표분으로 한 번 더 시도한다.
  for (let back = 0; back <= 1; back++) {
    time = getUVBaseTime(back);
    const url = new URL(`${BASE_URL}/getUVIdxV5`);
    url.searchParams.set('serviceKey', API_KEY);
    url.searchParams.set('dataType', 'JSON');
    url.searchParams.set('areaNo', areaNo);
    url.searchParams.set('time', time);
    url.searchParams.set('numOfRows', '10');
    url.searchParams.set('pageNo', '1');

    try {
      const body = await fetchOpenApi<UVResponse>(url.toString(), {
        endpoint: 'getUVIdxV5',
        timeoutMs: UV_TIMEOUT_MS,
      });
      assertOpenApiOk(body, 'getUVIdxV5');
      json = body;
      break;
    } catch (err) {
      if (back === 0 && err instanceof UpstreamApiError && err.kind === 'nodata') {
        console.warn('[getUVIdxV5] 해당 발표 시각 자료 없음 — 이전 발표분으로 재시도');
        continue;
      }
      throw err;
    }
  }

  const items = json?.response?.body?.items?.item ?? [];
  if (items.length === 0) return new Map();

  const item = items[0];
  const baseHour = parseInt(time.slice(-2), 10);
  const result = new Map<number, number>();

  const offsets: Array<[string, number]> = [
    ['h0', 0], ['h3', 3], ['h6', 6], ['h9', 9],
    ['h12', 12], ['h15', 15], ['h18', 18], ['h21', 21],
    // h24는 (baseHour + 24) % 24 = baseHour 로 h0와 같은 키가 되어 당일 값을 덮어쓰므로 제외
  ];

  // 발표값은 3시간 간격이므로 그대로 두면 24개 예보 바 중 3분의 2가 UV를 못 받는다.
  // 그 빈 시각은 호출부에서 "현재 UV"로 폴백됐는데, 새벽에 조회하면 한낮 바까지 현재값(0)을
  // 쓰게 되어 UV 페널티와 UV 점수 상한이 통째로 사라졌다. → 앵커 사이를 선형 보간해 채운다.
  const anchors: Array<{ offset: number; uv: number }> = [];
  for (const [key, offset] of offsets) {
    const val = item[key as keyof typeof item];
    if (val == null || val === '') continue;
    const uv = parseInt(String(val), 10);
    if (!isNaN(uv)) anchors.push({ offset, uv });
  }

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    result.set((baseHour + a.offset) % 24, a.uv);
    const b = anchors[i + 1];
    if (!b) continue;
    const span = b.offset - a.offset;
    for (let t = a.offset + 1; t < b.offset; t++) {
      const uv = a.uv + ((b.uv - a.uv) * (t - a.offset)) / span;
      result.set((baseHour + t) % 24, Math.round(uv));
    }
  }

  return result;
}

// ── 공개 함수 ────────────────────────────────────────────────

export interface UVData {
  /**
   * 현재 시각 기준 UV 지수. 발표값이 하나도 없으면 `undefined`.
   * 예전에는 0으로 채웠는데, 0은 "자외선 낮음"이라는 실제 값이어서 UV 가중치 분기(기온·습도에서
   * 5%를 떼어 UV에 배분)가 없는 데이터로 활성화되고 UI에는 'UV 낮음'이 표시됐다.
   * 결측은 반드시 undefined로 전파해 상위 로직이 UV 없는 가중치를 쓰게 한다.
   */
  current?: number;
  /** 시간별 UV 지수 Map<hour(0~23), uvIndex> */
  hourly: Map<number, number>;
}

/**
 * 시각 0~23 사이의 순환 거리.
 * 단순 |a-b|로 계산하면 예: 현재 23시일 때 hourly가 [18,21,0,3,...]인 경우
 * |0-23|=23이 되어 실제로는 1시간 차이인 0시가 선택되지 않고 21시가 선택되는 버그가 있었다.
 * → min(|a-b|, 24-|a-b|)로 24시 순환을 반영.
 */
function circularHourDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 24 - d);
}

/**
 * 좌표 → 자외선지수 조회.
 * 내부적으로 lat/lng → areaNo 변환 후 KMA API 호출.
 */
export async function getUVIndex(lat: number, lng: number): Promise<UVData> {
  const areaNo = latLngToAreaNo(lat, lng);
  const hourly = await fetchUVIndex(areaNo);

  // 현재 시각에 가장 가까운 값 선택 — 자정을 가로지르는 경우도 올바르게 처리
  const kstHour = nowKST().getHours();
  const nearestHour = [...hourly.keys()]
    .sort((a, b) => circularHourDistance(a, kstHour) - circularHourDistance(b, kstHour))[0];
  const current = nearestHour !== undefined ? hourly.get(nearestHour) : undefined;

  return { current, hourly };
}
