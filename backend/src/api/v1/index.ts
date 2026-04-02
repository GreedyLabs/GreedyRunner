import { Router } from 'express'
import { airQualityRouter } from './routes/airQuality'

export const v1Router = Router()

v1Router.use('/air-quality', airQualityRouter)
