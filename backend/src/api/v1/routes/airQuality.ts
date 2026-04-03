import { Router, type Request, type Response } from 'express'
import { SearchQuerySchema, CoordsQuerySchema, RegionIdParamSchema, RegionIdQuerySchema } from '../../../schemas/airQuality'
import * as realClient from '../../../infrastructure/apiClients/airKoreaClient'
import * as mockClient from '../../../infrastructure/apiClients/mockAirQualityClient'

const client = process.env.AIR_KOREA_API_KEY ? realClient : mockClient

if (!process.env.AIR_KOREA_API_KEY) {
  console.warn('[air-quality] AIR_KOREA_API_KEY 미설정 → Mock 데이터 사용')
}

export const airQualityRouter = Router()

/** GET /api/v1/air-quality/search?q=강남 */
airQualityRouter.get('/search', async (req: Request, res: Response) => {
  const parsed = SearchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  try {
    const results = await client.searchRegions(parsed.data.q)
    res.json({ results })
  } catch (err) {
    console.error('[search]', err)
    res.status(502).json({ error: '지역 검색 중 오류가 발생했습니다.' })
  }
})

/** GET /api/v1/air-quality/by-coords?lat=37.5&lng=127.0 */
airQualityRouter.get('/by-coords', async (req: Request, res: Response) => {
  const parsed = CoordsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  try {
    const region = await client.getRegionByCoords(parsed.data.lat, parsed.data.lng)
    res.json(region)
  } catch (err) {
    console.error('[by-coords]', err)
    res.status(502).json({ error: '위치 기반 측정소 조회 중 오류가 발생했습니다.' })
  }
})

/** GET /api/v1/air-quality/:regionId?lat=37.5&lng=127.0 */
airQualityRouter.get('/:regionId', async (req: Request, res: Response) => {
  const parsed = RegionIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  // 좌표는 선택적 — 있으면 기상 데이터도 함께 조회
  const coordsParsed = RegionIdQuerySchema.safeParse(req.query)
  const lat = coordsParsed.success ? coordsParsed.data.lat : undefined
  const lng = coordsParsed.success ? coordsParsed.data.lng : undefined

  try {
    const data = await client.getAirQuality(parsed.data.regionId, lat, lng)
    res.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[region]', message)
    if (message.includes('찾을 수 없습니다')) {
      res.status(404).json({ error: message })
    } else {
      res.status(502).json({ error: '대기질 정보 조회 중 오류가 발생했습니다.' })
    }
  }
})
