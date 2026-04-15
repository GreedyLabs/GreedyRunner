import { config } from 'dotenv'

// dotenv는 import보다 먼저 실행되어야 하므로, 동적 import 사용
// backend/.env 로드 (cwd 기준)
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
