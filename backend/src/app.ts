import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { v1Router } from './api/v1'
import { swaggerDocument } from './swagger'

const app = express()

app.use(
  cors({
    origin: (origin, callback) => {
      // 출처 없는 요청(프록시, curl 등), localhost, ngrok 허용
      if (
        !origin ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /\.ngrok(-free)?\.dev$/.test(origin)
      ) {
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
