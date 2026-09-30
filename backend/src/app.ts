import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { v1Router } from './api/v1'
import { swaggerDocument } from './swagger'

const app = express()

/**
 * 허용 origin.
 *
 * 운영에서는 nginx가 같은 origin으로 프록시하므로 CORS가 개입하지 않지만, 프론트엔드를
 * 별도 호스트에 올리거나 LAN IP·모바일 실기기에서 개발 서버에 붙으면 CORS가 관문이 된다.
 * 예전 목록은 localhost와 ngrok뿐이어서 그 경우들이 전부 막혔고, 더 나쁜 것은 거부 방식이었다
 * — 콜백에 Error를 넘기면 cors 미들웨어가 그 에러를 next()로 흘려 **HTML 500**이 나갔다.
 * 지금은 `callback(null, false)`로 CORS 헤더만 빼서, 브라우저가 정상적으로 차단하고
 * 서버는 500을 만들지 않는다.
 */
const EXTRA_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function isAllowedOrigin(origin: string): boolean {
  if (EXTRA_ALLOWED_ORIGINS.includes(origin)) return true
  // 로컬 개발: localhost / 127.0.0.1 / [::1] / *.localhost
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return true
  if (/^https?:\/\/[\w-]+\.localhost(:\d+)?$/.test(origin)) return true
  // 사설망 IP (모바일 실기기에서 개발 서버 접속)
  if (/^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+(:\d+)?$/.test(origin)) return true
  // ngrok 터널
  if (/^https?:\/\/[\w-]+\.ngrok(-free)?\.(dev|app|io)$/.test(origin)) return true
  return false
}

app.use(
  cors({
    origin: (origin, callback) => {
      // 출처 없는 요청(서버 간 호출, curl, 같은 origin 프록시)은 허용한다.
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }
      console.warn(`[cors] 허용되지 않은 origin: ${origin}`)
      callback(null, false)
    },
  })
)
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api/v1', v1Router)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

/**
 * API 경로의 404는 JSON으로 돌려준다.
 * 기본 express 핸들러는 HTML을 주므로, 프론트엔드의 `res.json()` 파싱이 깨져
 * "HTTP 404"가 아니라 정체불명의 파싱 오류로 표시됐다.
 */
app.use('/api', (_req, res) => {
  res.status(404).json({ error: '존재하지 않는 API 경로입니다.' })
})

/**
 * 마지막 방어선.
 *
 * express 4는 async 핸들러에서 던져진 rejection을 잡지 못해 요청이 그대로 매달린다.
 * 라우트마다 try/catch를 두고 있지만, 미들웨어나 앞으로 추가될 핸들러가 빠뜨릴 수 있으므로
 * 동기 throw만이라도 여기서 JSON 500으로 받는다. (async 누락은 라우트 쪽 책임이다)
 */
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err)
    return
  }
  console.error('[unhandled]', err)
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' })
})

export default app
