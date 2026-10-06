import { Router } from 'express'
import { airQualityRouter } from './routes/airQuality'
import { statsRouter } from './routes/stats'
import { rateLimit } from './rateLimit'

export const v1Router = Router()

/**
 * 대기질 엔드포인트에만 제한을 건다.
 *
 * 한 요청이 상류 Open API를 최대 6~7회 호출하고, 공공데이터포털의 일일 한도는
 * 그에 비해 작다. 제한이 없으면 크롤러 한 대가 한도를 통째로 태우고 그 뒤 모든
 * 사용자가 429를 받는다 — 실패가 사용자에게는 무작위로 보인다.
 *
 * 값의 근거: 정상 사용은 화면 진입당 검색 몇 회 + 조회 1회이고 응답은 5분 캐싱된다.
 * 분당 60회는 사람이 쓰면서 닿기 어렵고, 자동화된 반복 호출은 걸린다.
 */
v1Router.use(
  '/air-quality',
  rateLimit({
    windowMs: 60_000,
    max: 60,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  }),
  airQualityRouter
)

v1Router.use('/stats', statsRouter)
