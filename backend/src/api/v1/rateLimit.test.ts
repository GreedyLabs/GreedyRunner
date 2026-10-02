import type { NextFunction, Request, Response } from 'express'
import { rateLimit } from './rateLimit'

/**
 * 미들웨어를 직접 호출해 검사한다. supertest로 앱 전체를 태우면 같은 버킷을
 * 다른 테스트와 공유하게 되어, 여기서 상한을 소진하면 무관한 테스트가 429를 받는다.
 */
interface FakeRes {
  statusCode: number | null
  body: unknown
  headers: Record<string, string>
}

function callMiddleware(
  middleware: ReturnType<typeof rateLimit>,
  ip: string,
  /** 위조된 X-Forwarded-For. 미들웨어는 이것을 읽지 않아야 한다. */
  spoofedForwardedFor?: string
): { res: FakeRes; nextCalled: boolean } {
  const res: FakeRes = { statusCode: null, body: null, headers: {} }
  let nextCalled = false

  // Express가 trust proxy 설정에 따라 채워 주는 값이 req.ip다. 미들웨어는 이것만 본다.
  const fakeReq = {
    headers: spoofedForwardedFor ? { 'x-forwarded-for': spoofedForwardedFor } : {},
    ip,
  } as unknown as Request
  const fakeRes = {
    setHeader: (k: string, v: string) => {
      res.headers[k] = v
    },
    status: (code: number) => {
      res.statusCode = code
      return fakeRes
    },
    json: (body: unknown) => {
      res.body = body
      return fakeRes
    },
  } as unknown as Response
  const next: NextFunction = () => {
    nextCalled = true
  }

  middleware(fakeReq, fakeRes, next)
  return { res, nextCalled }
}

describe('rateLimit', () => {
  it('상한 이내의 요청은 통과시킨다', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3, message: 'too many' })
    for (let i = 0; i < 3; i++) {
      const { nextCalled, res } = callMiddleware(mw, '1.1.1.1')
      expect(nextCalled).toBe(true)
      expect(res.statusCode).toBeNull()
    }
  })

  it('상한을 넘으면 429와 Retry-After를 준다', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, message: '요청이 너무 많습니다.' })
    callMiddleware(mw, '2.2.2.2')
    callMiddleware(mw, '2.2.2.2')
    const { nextCalled, res } = callMiddleware(mw, '2.2.2.2')
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: '요청이 너무 많습니다.' })
    expect(res.headers['Retry-After']).toBeDefined()
  })

  it('IP별로 따로 센다', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, message: 'too many' })
    expect(callMiddleware(mw, '3.3.3.3').nextCalled).toBe(true)
    // 다른 IP는 영향을 받지 않는다
    expect(callMiddleware(mw, '4.4.4.4').nextCalled).toBe(true)
    // 같은 IP의 두 번째 요청은 막힌다
    expect(callMiddleware(mw, '3.3.3.3').nextCalled).toBe(false)
  })

  // X-Forwarded-For는 클라이언트가 정하는 값이다. 미들웨어가 그 헤더를 직접 읽으면
  // 매 요청 다른 값을 보내는 것만으로 매번 새 버킷이 생겨 제한이 전혀 걸리지 않는다
  // — 하루 호출 한도를 지키려고 넣은 장치가 바로 그 위협에 무력해진다.
  // 어디까지 믿을지는 app.ts의 trust proxy가 정하고, 미들웨어는 req.ip만 본다.
  it('X-Forwarded-For를 읽지 않는다 (위조로 버킷을 늘릴 수 없다)', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, message: 'too many' })

    expect(callMiddleware(mw, '5.5.5.5', 'spoof-1').nextCalled).toBe(true)
    expect(callMiddleware(mw, '5.5.5.5', 'spoof-2').nextCalled).toBe(true)
    // 헤더를 매번 바꿔도 같은 req.ip이므로 세 번째는 막혀야 한다
    expect(callMiddleware(mw, '5.5.5.5', 'spoof-3').nextCalled).toBe(false)
    expect(callMiddleware(mw, '5.5.5.5', 'spoof-4').nextCalled).toBe(false)
  })

  it('req.ip가 없으면 하나의 버킷으로 묶는다 (제한을 건너뛰지 않는다)', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, message: 'too many' })
    expect(callMiddleware(mw, '').nextCalled).toBe(true)
    expect(callMiddleware(mw, '').nextCalled).toBe(false)
  })

  it('창이 지나면 다시 통과시킨다', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'))
    try {
      const mw = rateLimit({ windowMs: 1_000, max: 1, message: 'too many' })
      expect(callMiddleware(mw, '7.7.7.7').nextCalled).toBe(true)
      expect(callMiddleware(mw, '7.7.7.7').nextCalled).toBe(false)
      jest.advanceTimersByTime(1_001)
      expect(callMiddleware(mw, '7.7.7.7').nextCalled).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('RateLimit-Remaining이 남은 횟수를 알려준다', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3, message: 'too many' })
    expect(callMiddleware(mw, '8.8.8.8').res.headers['RateLimit-Remaining']).toBe('2')
    expect(callMiddleware(mw, '8.8.8.8').res.headers['RateLimit-Remaining']).toBe('1')
    expect(callMiddleware(mw, '8.8.8.8').res.headers['RateLimit-Remaining']).toBe('0')
  })
})
