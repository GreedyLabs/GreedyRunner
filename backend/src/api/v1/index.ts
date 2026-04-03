import { Router } from 'express'
import { airQualityRouter } from './routes/airQuality'
import { statsRouter } from './routes/stats'

export const v1Router = Router()

v1Router.use('/air-quality', airQualityRouter)
v1Router.use('/stats', statsRouter)
