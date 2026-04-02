export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst'

export interface AirQualityMetrics {
  pm25: number   // μg/m³
  pm10: number   // μg/m³
  o3: number     // ppm
  no2: number    // ppm
  co: number     // ppm
}

export interface RunningIndex {
  score: number          // 0–100 (높을수록 좋음)
  status: RunningStatus
  label: string          // '달리기 최적' | '달리기 좋음' | ...
  message: string        // 한 줄 요약 메시지
  canRun: boolean
}

export interface HourlyForecast {
  hour: number           // 0–23
  runningIndex: RunningIndex
  airQuality: AirQualityMetrics
}

export interface AirQualityData {
  regionName: string
  updatedAt: Date
  current: {
    airQuality: AirQualityMetrics
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: number[]   // 오늘 달리기 좋은 시간대 (hour)
}
