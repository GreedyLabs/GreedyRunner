import 'dotenv/config'
import app from './app'

const PORT = process.env.PORT ?? 8000

app.listen(PORT, () => {
  console.log(`🚀 GreedyRunner API running at http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Swagger: http://localhost:${PORT}/docs`)
  console.log(`   Regions: http://localhost:${PORT}/api/v1/air-quality/search?q=강남`)
})
