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

export interface WeatherInfo {
  temperature: number          // 기온 (°C)
  humidity: number             // 습도 (%)
  windSpeed: number            // 풍속 (m/s)
  precipitation: 'none' | 'rain' | 'snow' | 'sleet'
}

export interface HourlyForecast {
  hour: number
  airQuality: AirQualityMetrics
  weather?: WeatherInfo
  runningIndex: RunningIndex
}

export interface AirQualityData {
  regionName: string
  updatedAt: Date
  current: {
    airQuality: AirQualityMetrics
    weather?: WeatherInfo
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: number[]
}
