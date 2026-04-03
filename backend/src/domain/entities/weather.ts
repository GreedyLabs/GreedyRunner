export type PrecipitationType = 'none' | 'rain' | 'snow' | 'sleet'

export interface WeatherMetrics {
  temperature: number       // 기온 (°C)
  humidity: number          // 습도 (%)
  windSpeed: number         // 풍속 (m/s)
  precipitation: PrecipitationType  // 강수 형태
}
