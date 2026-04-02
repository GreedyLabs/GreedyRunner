import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { v1Router } from './api/v1'
import { swaggerDocument } from './swagger'

const app = express()

app.use(
  cors({
    origin: (origin, callback) => {
      // 로컬 개발 환경(localhost 전 포트) 및 출처 없는 요청(모바일, curl 등) 허용
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: 허용되지 않은 origin: ${origin}`))
      }
    },
  })
)
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api/v1', v1Router)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

export default app
