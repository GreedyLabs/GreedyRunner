import { assertOpenApiOk, fetchOpenApi, isRetryable, UpstreamApiError } from './openApiResponse'

/**
 * 이 테스트가 고정하는 것은 "공공데이터포털이 HTTP 200으로 JSON이 아닌 본문을 줄 때"의 동작이다.
 * 그 경우가 바로 사용자가 보고한 "openapi 호출이 되다 안되다"의 핵심 경로였고, 예전 코드는
 * res.json()의 SyntaxError나 json.response.header의 TypeError로 죽어 전부 502가 됐다.
 */

const QUOTA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
    <returnReasonCode>22</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>`

const KEY_XML = `<OpenAPI_ServiceResponse><cmmMsgHeader>
  <errMsg>SERVICE ERROR</errMsg>
  <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
  <returnReasonCode>30</returnReasonCode>
</cmmMsgHeader></OpenAPI_ServiceResponse>`

const NODATA_XML = `<OpenAPI_ServiceResponse><cmmMsgHeader>
  <errMsg>NODATA_ERROR</errMsg><returnReasonCode>03</returnReasonCode>
</cmmMsgHeader></OpenAPI_ServiceResponse>`

interface StubResponse {
  ok?: boolean
  status?: number
  body: string
}

/** fetch를 대신해 고정 응답을 돌려준다. 호출 횟수로 재시도 동작을 검증한다. */
function stubFetch(...responses: StubResponse[]): jest.Mock {
  const mock = jest.fn(async () => {
    const next = responses.length > 1 ? responses.shift()! : responses[0]
    return {
      ok: next.ok ?? (next.status ?? 200) < 400,
      status: next.status ?? 200,
      text: async () => next.body,
    } as unknown as Response
  })
  global.fetch = mock as unknown as typeof fetch
  return mock
}

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

async function expectKind(promise: Promise<unknown>, kind: string): Promise<UpstreamApiError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(UpstreamApiError)
    expect((err as UpstreamApiError).kind).toBe(kind)
    return err as UpstreamApiError
  }
  throw new Error(`throw되지 않았다 (기대: kind=${kind})`)
}

describe('fetchOpenApi — HTTP 200에 JSON이 아닌 본문', () => {
  it('일일 호출 한도 초과 XML을 quota로 분류한다', async () => {
    stubFetch({ body: QUOTA_XML })
    const err = await expectKind(fetchOpenApi('https://x/y', { endpoint: 'getTMStdrCrdnt', timeoutMs: 100 }), 'quota')
    expect(err.resultCode).toBe('22')
    expect(err.endpoint).toBe('getTMStdrCrdnt')
  })

  it('서비스키 미등록 XML을 key로 분류한다', async () => {
    stubFetch({ body: KEY_XML })
    await expectKind(fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100 }), 'key')
  })

  it('자료 없음 XML을 nodata로 분류한다', async () => {
    stubFetch({ body: NODATA_XML })
    await expectKind(fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100 }), 'nodata')
  })

  it('점검 안내 HTML을 unavailable로 분류한다', async () => {
    stubFetch({ body: '<html><body>시스템 점검 중입니다</body></html>' })
    await expectKind(fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100, retries: 0 }), 'unavailable')
  })

  it('JSON도 XML도 아닌 평문을 malformed로 분류한다', async () => {
    stubFetch({ body: 'unexpected plain text' })
    const err = await expectKind(
      fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100, retries: 0 }),
      'malformed'
    )
    expect(err.snippet).toContain('unexpected plain text')
  })

  it('정상 JSON은 파싱해서 돌려준다', async () => {
    stubFetch({ body: JSON.stringify({ response: { header: { resultCode: '00' } } }) })
    const json = await fetchOpenApi<{ response: { header: { resultCode: string } } }>('https://x/y', {
      endpoint: 'ep',
      timeoutMs: 100,
    })
    expect(json.response.header.resultCode).toBe('00')
  })
})

describe('fetchOpenApi — 재시도 정책', () => {
  it('5xx는 재시도한 뒤 성공하면 결과를 돌려준다', async () => {
    const mock = stubFetch(
      { status: 503, body: '' },
      { body: JSON.stringify({ response: { header: { resultCode: '00' } } }) }
    )
    await fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100, retries: 1 })
    expect(mock).toHaveBeenCalledTimes(2)
  })

  // 한도 초과·키 오류는 재시도해도 같은 답이 오고, 한도만 더 태운다.
  it('한도 초과는 재시도하지 않는다', async () => {
    const mock = stubFetch({ body: QUOTA_XML })
    await expectKind(fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100, retries: 2 }), 'quota')
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('HTTP 429를 quota로 보고 재시도하지 않는다', async () => {
    const mock = stubFetch({ status: 429, body: '' })
    await expectKind(fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 100, retries: 2 }), 'quota')
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('isRetryable은 상류 장애만 참으로 본다', () => {
    expect(isRetryable(new UpstreamApiError('unavailable', 'ep', 'x'))).toBe(true)
    expect(isRetryable(new UpstreamApiError('quota', 'ep', 'x'))).toBe(false)
    expect(isRetryable(new UpstreamApiError('key', 'ep', 'x'))).toBe(false)
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(isRetryable(abort)).toBe(true)
  })
})

describe('fetchOpenApi — 본문 읽기 데드라인', () => {
  // 예전 fetchWithTimeout은 finally에서 타이머를 지운 뒤 호출부가 res.json()을 실행했다.
  // 헤더는 왔지만 본문 스트림이 멈추면 abort가 발동하지 않아 요청이 영구히 매달렸고,
  // 에러도 로그도 남지 않았다.
  it('본문이 멈추면 timeoutMs에서 끊긴다', async () => {
    global.fetch = (async (_url: string, init?: { signal?: AbortSignal }) => {
      return {
        ok: true,
        status: 200,
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }),
      } as unknown as Response
    }) as unknown as typeof fetch

    const started = Date.now()
    await expect(
      fetchOpenApi('https://x/y', { endpoint: 'ep', timeoutMs: 50, retries: 0 })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(Date.now() - started).toBeLessThan(2000)
  })
})

describe('assertOpenApiOk', () => {
  it('resultCode 00은 통과한다', () => {
    expect(() => assertOpenApiOk({ response: { header: { resultCode: '00' } } }, 'ep')).not.toThrow()
  })

  // 에러 봉투가 JSON 모양으로 오면 response 키가 없다. 예전에는 여기서 TypeError가 났다.
  it('response가 없는 JSON은 malformed로 분류한다', () => {
    let caught: unknown
    try {
      assertOpenApiOk({ someOtherShape: true }, 'ep')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(UpstreamApiError)
    expect((caught as UpstreamApiError).kind).toBe('malformed')
  })

  it('resultCode 22는 XML 경로와 동일하게 quota로 분류한다', () => {
    let caught: unknown
    try {
      assertOpenApiOk({ response: { header: { resultCode: '22', resultMsg: 'LIMITED' } } }, 'ep')
    } catch (err) {
      caught = err
    }
    expect((caught as UpstreamApiError).kind).toBe('quota')
  })

  it('resultCode 03은 nodata로 분류한다', () => {
    let caught: unknown
    try {
      assertOpenApiOk({ response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } } }, 'ep')
    } catch (err) {
      caught = err
    }
    expect((caught as UpstreamApiError).kind).toBe('nodata')
  })
})
