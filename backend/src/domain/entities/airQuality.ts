export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst' | 'unknown'

/**
 * 측정값은 `null`이 "측정소 점검/결측"을 의미한다.
 * `0`은 "실제로 0인 값(깨끗한 공기)"이므로 혼동하지 말 것.
 */
export interface AirQualityMetrics {
  pm25: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  co: number | null
}

export interface RunningIndex {
  /** 0~100. status가 'unknown'일 때는 0으로 반환되며 UI에서 별도 처리한다. */
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
  uvIndex?: number             // 자외선지수 (0~15+, 없으면 undefined)
}

export interface HourlyForecast {
  hour: number
  isNextDay?: boolean
  airQuality: AirQualityMetrics
  weather?: WeatherInfo
  runningIndex: RunningIndex
}

export interface StationFallback {
  originalStation: string
  fallbackStation: string
  reason: string
}

export interface ServiceStatus {
  airKorea: 'ok' | 'timeout' | 'error'
  weather: 'ok' | 'timeout' | 'error' | 'unavailable'
}

export interface AirQualityData {
  regionName: string
  updatedAt: Date
  stationFallback?: StationFallback
  serviceStatus: ServiceStatus
  current: {
    airQuality: AirQualityMetrics
    weather?: WeatherInfo
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: Array<{ hour: number; isNextDay: boolean }>
}
