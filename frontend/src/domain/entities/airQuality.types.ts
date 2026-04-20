export type RunningStatus = 'great' | 'good' | 'caution' | 'bad' | 'worst' | 'unknown'

export type PrecipitationType = 'none' | 'rain' | 'snow' | 'sleet'

/**
 * 측정값은 `null`이 "측정소 점검/결측"을 의미한다.
 * `0`은 "실제 깨끗한 값"이므로 혼동하지 말 것.
 */
export interface AirQualityMetrics {
  pm25: number | null   // μg/m³
  pm10: number | null   // μg/m³
  o3: number | null     // ppm
  no2: number | null    // ppm
  co: number | null     // ppm
}

export interface WeatherInfo {
  temperature: number          // 기온 (°C)
  humidity: number             // 습도 (%)
  windSpeed: number            // 풍속 (m/s)
  precipitation: PrecipitationType
  uvIndex?: number             // 자외선지수 (0~15+, 없으면 undefined)
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
  isNextDay?: boolean    // true이면 다음 날
  runningIndex: RunningIndex
  airQuality: AirQualityMetrics
  weather?: WeatherInfo
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
  serviceStatus?: ServiceStatus
  current: {
    airQuality: AirQualityMetrics
    weather?: WeatherInfo
    runningIndex: RunningIndex
  }
  hourlyForecast: HourlyForecast[]
  bestRunningHours: Array<{ hour: number; isNextDay: boolean }>
}
