export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst'

export interface AirQualityMetrics {
  pm25: number
  pm10: number
  o3: number
  no2: number
  co: number
}

export interface RunningIndex {
  score: number
  status: RunningStatus
  label: string
  message: string
  canRun: boolean
}

export interface HourlyForecast {
  hour: number
  airQuality: AirQualityMetrics
  runningIndex: RunningIndex
}

export interface AirQualityData {
  regionName: string
  updatedAt: Date
  current: {
    airQuality: AirQualityMetrics
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: number[]
}
