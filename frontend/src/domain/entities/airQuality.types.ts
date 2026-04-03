export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst'

export type PrecipitationType = 'none' | 'rain' | 'snow' | 'sleet'

export interface AirQualityMetrics {
  pm25: number   // μg/m³
  pm10: number   // μg/m³
  o3: number     // ppm
  no2: number    // ppm
  co: number     // ppm
}

export interface WeatherInfo {
  temperature: number          // 기온 (°C)
  humidity: number             // 습도 (%)
  windSpeed: number            // 풍속 (m/s)
  precipitation: PrecipitationType
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
  weather?: WeatherInfo
}

export interface StationFallback {
  originalStation: string
  fallbackStation: string
  reason: string
}

export interface AirQualityData {
  regionName: string
  updatedAt: Date
  stationFallback?: StationFallback
  current: {
    airQuality: AirQualityMetrics
    weather?: WeatherInfo
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: number[]   // 오늘 달리기 좋은 시간대 (hour)
}
