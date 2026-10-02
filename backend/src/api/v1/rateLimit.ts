import type { NextFunction, Request, Response } from 'express'

/**
 * 인메모리 요청 제한.
 *
 * 대기질 엔드포인트는 한 요청이 상류 Open API를 최대 6~7회 호출한다(측정소 3곳 +
 * 초단기실황 + 단기예보 + 자외선). 공공데이터포털 개발 계정의 일일 한도는 작아서,
 * 제한이 없으면 크롤러 한 대가 하루 한도를 통째로 태우고 그 뒤 모든 사용자가 429를 받는다.
 * 사용자가 신고한 "되다 안되다"의 가장 유력한 경로였다.
 *
 * 외부 의존성을 두지 않는 이유: 인스턴스가 하나이고(단일 컨테이너) 목적이 남용 차단이라
 * 정밀한 분산 제한이 필요하지 않다. 여러 인스턴스로 늘리면 공유 저장소 기반으로 바꿔야 한다.
 */
interface Bucket {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  /** 창 길이(ms). */
  windowMs: number
  /** 창 안에서 허용하는 요청 수. */
  max: number
  /** 상한에 걸렸을 때 본문에 담을 안내. */
  message: string
}

/** 버킷 상한 — 키가 IP라 상한이 없으면 메모리가 방문자 수만큼 늘어난다. */
const MAX_BUCKETS = 10_000

export function rateLimit({ windowMs, max, message }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 클라이언트 식별은 Express의 req.ip만 쓴다. X-Forwarded-For를 여기서 직접 읽으면
    // 안 된다 — 그 헤더는 클라이언트가 정하는 값이라, 매 요청 다른 값을 보내면 매번 새
    // 버킷이 생겨 제한이 전혀 걸리지 않는다. 어디까지 믿을지는 app.ts의 trust proxy가
    // 정하고, Express가 신뢰 범위 밖의 값을 걸러 req.ip에 담아 준다.
    const key = req.ip || 'unknown'

    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      // 만료된 버킷을 정리한다 — 상한에 닿았을 때만 훑어 비용을 억제한다.
      if (buckets.size >= MAX_BUCKETS) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
        while (buckets.size >= MAX_BUCKETS) {
          const oldest = buckets.keys().next()
          if (oldest.done) break
          buckets.delete(oldest.value)
        }
      }
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count++
    const remaining = Math.max(0, max - bucket.count)
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)))

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      res.status(429).json({ error: message })
      return
    }

    next()
  }
}
