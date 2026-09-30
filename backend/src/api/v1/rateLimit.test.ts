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
  ip: string
): { res: FakeRes; nextCalled: boolean } {
  const res: FakeRes = { statusCode: null, body: null, headers: {} }
  let nextCalled = false

  const fakeReq = { headers: { 'x-forwarded-for': ip }, ip: '127.0.0.1' } as unknown as Request
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

  // nginx 뒤에 있으므로 req.ip는 프록시 주소다. X-Forwarded-For의 첫 항목을 써야
  // 사용자별로 구분된다 — 그러지 않으면 전체 트래픽이 한 버킷에 들어가 정상 사용자도 막힌다.
  it('X-Forwarded-For의 첫 항목을 클라이언트로 본다', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, message: 'too many' })
    expect(callMiddleware(mw, '5.5.5.5, 10.0.0.1, 10.0.0.2').nextCalled).toBe(true)
    expect(callMiddleware(mw, '5.5.5.5, 10.0.0.9').nextCalled).toBe(false)
    // 첫 항목이 다르면 다른 사용자다
    expect(callMiddleware(mw, '6.6.6.6, 10.0.0.1').nextCalled).toBe(true)
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
