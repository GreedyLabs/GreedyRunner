/**
 * 공공데이터포털·기상청 Open API 응답 처리 공용 계층.
 *
 * 세 클라이언트(airKorea·weather·uv)가 각자 `fetch` → `res.json()` → `json.response.header`를
 * 반복하면서 생긴 두 가지 문제를 한곳으로 모은다.
 *
 * 1. **HTTP 200에 JSON이 아닌 본문.** 공공데이터포털 게이트웨이는 서비스키 미등록·일일 한도
 *    초과·서비스 점검일 때 `returnType=json`을 요청했더라도 `<OpenAPI_ServiceResponse>` XML이나
 *    점검 안내 HTML을 200으로 돌려준다. `res.ok`는 통과하므로 `res.json()`이 SyntaxError를
 *    던지거나, JSON 모양이지만 `response` 키가 없어 `json.response.header`가 TypeError를 던졌다.
 *    두 예외는 라우트에서 코드 버그와 구분되지 않아 전부 502로 나갔고, 로그에도 원인이 남지 않아
 *    "어제는 됐는데 오늘은 안 된다"의 추적이 끊겼다.
 * 2. **본문 읽기에 데드라인이 없음.** 기존 `fetchWithTimeout`은 `finally`에서 타이머를 지운 뒤
 *    호출부가 `res.json()`을 실행했다. 헤더는 왔지만 본문 스트림이 멈추면 abort가 발동하지 않아
 *    요청이 영구히 매달렸다 — 에러도 로그도 남지 않는 조용한 실패였다.
 *
 * `fetchOpenApi`는 본문 읽기까지 같은 타이머 안에서 끝내고, 실패를 `UpstreamApiError`로 분류해
 * 라우트가 상태 코드를 제대로 고를 수 있게 한다.
 */

/**
 * 상류 실패의 종류. 라우트가 이 값만 보고 HTTP 상태를 고를 수 있도록 원인별로 나눈다.
 *   quota       — 일일/시간당 호출 한도 초과. 자정(KST)에 리셋되므로 재시도는 무의미하다.
 *   key         — 서비스키 미등록·미승인·오타. 시간이 지나도 회복되지 않는다.
 *   nodata      — 요청 자체는 정상인데 해당 시각/지역 자료가 아직 발표되지 않았다.
 *   unavailable — 상류 장애·점검·5xx. 재시도할 가치가 있다.
 *   malformed   — JSON도 아니고 알려진 에러 봉투도 아닌 본문. 계약 변경이거나 프록시가 끼어든 것.
 */
export type UpstreamErrorKind = 'quota' | 'key' | 'nodata' | 'unavailable' | 'malformed'

export class UpstreamApiError extends Error {
  readonly kind: UpstreamErrorKind
  readonly endpoint: string
  /** 원인 파악용 응답 본문 앞부분. 서비스키가 섞이지 않도록 본문만 담는다. */
  readonly snippet?: string
  readonly resultCode?: string

  constructor(
    kind: UpstreamErrorKind,
    endpoint: string,
    message: string,
    extra: { snippet?: string; resultCode?: string } = {}
  ) {
    super(`[${endpoint}] ${kind}: ${message}`)
    this.name = 'UpstreamApiError'
    this.kind = kind
    this.endpoint = endpoint
    this.snippet = extra.snippet
    this.resultCode = extra.resultCode
  }
}

/** 재시도해 볼 가치가 있는 실패인지. 한도 초과·키 오류는 재시도해도 같은 답이 온다. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof UpstreamApiError) return err.kind === 'unavailable'
  // AbortError(타임아웃) 및 네트워크 오류
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TypeError')
}

/**
 * 공공데이터포털 XML 에러 봉투의 코드 → 분류.
 * 코드 목록은 포털 공통 응답 규격을 따른다. 알 수 없는 코드는 unavailable로 둔다
 * (재시도 대상으로 취급하는 편이 안전하다).
 */
const PORTAL_REASON_KIND: Record<string, UpstreamErrorKind> = {
  '01': 'unavailable', // APPLICATION_ERROR
  '03': 'nodata', // NODATA_ERROR
  '04': 'unavailable', // HTTP_ERROR
  '05': 'unavailable', // SERVICETIME_OUT
  '20': 'key', // SERVICE_ACCESS_DENIED
  '22': 'quota', // LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS
  '30': 'key', // SERVICE_KEY_IS_NOT_REGISTERED
  '31': 'key', // DEADLINE_HAS_EXPIRED
  '32': 'key', // UNREGISTERED_IP
  '33': 'key', // UNSIGNED_CALL
}

/** 에러 봉투 본문의 키워드 → 분류. 코드가 없거나 파싱되지 않을 때의 2차 판정. */
function classifyByKeyword(body: string): UpstreamErrorKind {
  const upper = body.toUpperCase()
  if (upper.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS')) return 'quota'
  if (
    upper.includes('SERVICE_KEY_IS_NOT_REGISTERED') ||
    upper.includes('SERVICE_ACCESS_DENIED') ||
    upper.includes('UNREGISTERED_IP') ||
    upper.includes('DEADLINE_HAS_EXPIRED')
  ) {
    return 'key'
  }
  if (upper.includes('NODATA')) return 'nodata'
  return 'unavailable'
}

/** 로그에 남길 본문 앞부분. 줄바꿈을 눌러 한 줄로 만든다. */
function snippetOf(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 200)
}

/** JSON이 아닌 본문(XML 에러 봉투·HTML 점검 페이지·평문)을 분류해 던진다. */
function throwForNonJsonBody(endpoint: string, body: string): never {
  const reason = /<returnReasonCode>\s*([0-9]{1,2})\s*<\/returnReasonCode>/.exec(body)
  const code = reason?.[1]?.padStart(2, '0')
  const kind = (code && PORTAL_REASON_KIND[code]) || classifyByKeyword(body)
  const msgMatch =
    /<errMsg>([^<]*)<\/errMsg>/.exec(body) ??
    /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(body)
  const detail = msgMatch?.[1]?.trim() || 'JSON이 아닌 응답 본문'
  throw new UpstreamApiError(kind, endpoint, detail, { snippet: snippetOf(body), resultCode: code })
}

/** HTTP 상태 코드 → 분류. 본문이 비어 원인을 알 수 없을 때 쓴다. */
function kindForStatus(status: number): UpstreamErrorKind {
  if (status === 429) return 'quota'
  if (status === 401 || status === 403) return 'key'
  return 'unavailable'
}

interface FetchOpenApiOptions {
  /** 로그·에러 메시지에 쓰는 오퍼레이션 이름 (예: 'getTMStdrCrdnt'). URL은 넣지 않는다. */
  endpoint: string
  /** 연결부터 **본문 읽기 완료까지** 한 시도에 허용하는 시간. */
  timeoutMs: number
  /** 재시도 횟수. 타임아웃·네트워크 오류·상류 장애(unavailable)에만 적용된다. 기본 1회. */
  retries?: number
}

/**
 * Open API를 호출해 파싱된 JSON을 돌려준다.
 *
 * 한 시도의 타이머가 **본문 읽기까지** 살아 있으므로, 헤더만 오고 본문이 멈추는 경우에도
 * `timeoutMs`에서 AbortError로 끊긴다. 실패는 모두 `UpstreamApiError`로 분류해 던지고,
 * 재시도는 `isRetryable`이 true인 실패에만 적용한다 (한도 초과·키 오류는 즉시 포기).
 */
export async function fetchOpenApi<T>(url: string, options: FetchOpenApiOptions): Promise<T> {
  const { endpoint, timeoutMs, retries = 1 } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      // 본문 읽기도 같은 타이머 안에서 끝낸다 — 여기가 예전에 무한 대기가 발생한 지점이다.
      const body = await res.text()

      if (!res.ok) {
        // 상태 코드가 나쁘면 본문이 에러 봉투일 수 있으니 본문 분류를 먼저 시도한다.
        if (body.trimStart().startsWith('<')) throwForNonJsonBody(endpoint, body)
        throw new UpstreamApiError(kindForStatus(res.status), endpoint, `HTTP ${res.status}`, {
          snippet: snippetOf(body),
        })
      }

      // HTTP 200인데 JSON이 아닌 경우 — 포털 에러 봉투/점검 페이지.
      if (body.trimStart().startsWith('<')) throwForNonJsonBody(endpoint, body)

      try {
        return JSON.parse(body) as T
      } catch {
        // 평문 에러 메시지도 여기로 온다 (기상청 API 허브는 XML 대신 평문을 준다).
        throw new UpstreamApiError(
          classifyByKeyword(body) === 'unavailable' ? 'malformed' : classifyByKeyword(body),
          endpoint,
          'JSON 파싱 실패',
          { snippet: snippetOf(body) }
        )
      }
    } catch (err) {
      lastError = err
      if (attempt < retries && isRetryable(err)) {
        const reason = err instanceof Error && err.name === 'AbortError' ? `타임아웃(${timeoutMs}ms)` : String(err)
        console.warn(`[${endpoint}] ${reason} — 재시도 ${attempt + 1}/${retries}`)
        continue
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

interface Envelope {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
  }
}

/**
 * `response.header.resultCode`를 검사한다.
 *
 * 옵셔널 체이닝으로 읽으므로 `response`가 없는 JSON(에러 봉투가 JSON으로 올 때)도 TypeError 대신
 * `malformed`로 분류된다. 한도 초과·키 오류는 XML이 아니라 이 필드로 오는 경우도 있어,
 * XML 경로와 동일하게 분류해 라우트가 같은 상태 코드를 내도록 한다.
 */
export function assertOpenApiOk(json: unknown, endpoint: string): void {
  const header = (json as Envelope)?.response?.header
  if (!header || typeof header.resultCode !== 'string') {
    throw new UpstreamApiError('malformed', endpoint, 'response.header가 없는 응답', {
      snippet: snippetOf(JSON.stringify(json ?? null)),
    })
  }
  const { resultCode, resultMsg } = header
  if (resultCode === '00') return

  const code = resultCode.padStart(2, '0')
  const kind = PORTAL_REASON_KIND[code] ?? classifyByKeyword(resultMsg ?? '')
  throw new UpstreamApiError(kind, endpoint, resultMsg ?? `resultCode ${resultCode}`, {
    resultCode: code,
  })
}
