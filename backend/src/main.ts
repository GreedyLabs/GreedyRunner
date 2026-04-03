import { config } from 'dotenv'
import { resolve } from 'path'

// dotenv는 import보다 먼저 실행되어야 하므로, 동적 import 사용
// 루트 .env → backend/.env 순서로 로드 (후자가 있으면 덮어씀)
config({ path: resolve(__dirname, '../../.env') })
config()

async function main() {
  const { default: app } = await import('./app')

  const PORT = process.env.PORT ?? 8000

  app.listen(PORT, () => {
    console.log(`🚀 GreedyRunner API running at http://localhost:${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/health`)
    console.log(`   Swagger: http://localhost:${PORT}/docs`)
    console.log(`   Regions: http://localhost:${PORT}/api/v1/air-quality/search?q=강남`)
  })
}

main()
