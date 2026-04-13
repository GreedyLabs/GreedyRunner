/**
 * 옷차림 시뮬레이터 — 온도·UV·강수 조합별 러너 아바타를 한눈에 확인.
 * 헤더의 "옷차림 추천" 링크로 진입한다.
 */
import { useState, useEffect } from 'react'
import { RunnerAvatar } from '../components/shared/RunnerAvatar'
import type { WeatherInfo } from '../../domain/entities/airQuality.types'

const PRESETS: Array<{ label: string; weather: WeatherInfo }> = [
  { label: '한여름 UV 낮음', weather: { temperature: 32, humidity: 50, windSpeed: 2, precipitation: 'none', uvIndex: 1 } },
  { label: '봄날 UV 보통', weather: { temperature: 18, humidity: 45, windSpeed: 3, precipitation: 'none', uvIndex: 4 } },
  { label: '여름 UV 높음', weather: { temperature: 25, humidity: 55, windSpeed: 2, precipitation: 'none', uvIndex: 7 } },
  { label: '여름 UV 매우높음', weather: { temperature: 30, humidity: 60, windSpeed: 1, precipitation: 'none', uvIndex: 9 } },
  { label: '여름 UV 위험', weather: { temperature: 34, humidity: 65, windSpeed: 1, precipitation: 'none', uvIndex: 12 } },
  { label: '비 오는 날', weather: { temperature: 15, humidity: 80, windSpeed: 4, precipitation: 'rain', uvIndex: 1 } },
  { label: '눈 오는 날', weather: { temperature: -3, humidity: 70, windSpeed: 5, precipitation: 'snow', uvIndex: 0 } },
  { label: '쌀쌀한 가을', weather: { temperature: 10, humidity: 40, windSpeed: 3, precipitation: 'none', uvIndex: 2 } },
  { label: '겨울 영하', weather: { temperature: -5, humidity: 35, windSpeed: 6, precipitation: 'none' } },
  { label: 'UV 데이터 없음 (봄)', weather: { temperature: 20, humidity: 50, windSpeed: 2, precipitation: 'none' } },
]

const DEFAULT_WEATHER: WeatherInfo = {
  temperature: 25, humidity: 50, windSpeed: 2, precipitation: 'none', uvIndex: 7,
}

interface AvatarPreviewProps {
  currentWeather?: WeatherInfo
}

export function AvatarPreview({ currentWeather }: AvatarPreviewProps) {
  const [custom, setCustom] = useState<WeatherInfo>(currentWeather ?? DEFAULT_WEATHER)

  // currentWeather가 변경되면 항상 반영 (슬라이더 조작 전까지)
  useEffect(() => {
    if (currentWeather) {
      setCustom(currentWeather)
    }
  }, [currentWeather])

  const hasLiveData = !!currentWeather

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800">러닝 옷차림 시뮬레이터</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {hasLiveData ? '현재 날씨가 반영되었습니다. 슬라이더로 조건을 바꿔보세요.' : '날씨 조건을 조절해서 추천 옷차림을 확인하세요'}
        </p>
      </div>

      {/* 커스텀 슬라이더 */}
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{hasLiveData ? '현재 날씨 기준' : '커스텀 조합'}</h2>
          {hasLiveData && (
            <button
              type="button"
              onClick={() => setCustom(currentWeather)}
              className="text-[10px] text-white/70 hover:text-white underline"
            >
              현재 날씨로 초기화
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
          <label className="flex flex-col gap-1">
            기온: {custom.temperature}°C
            <input type="range" min={-10} max={40} value={custom.temperature} onChange={e => setCustom(p => ({ ...p, temperature: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            UV: {custom.uvIndex ?? 'N/A'}
            <input type="range" min={0} max={15} value={custom.uvIndex ?? 0} onChange={e => setCustom(p => ({ ...p, uvIndex: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            습도: {custom.humidity}%
            <input type="range" min={0} max={100} value={custom.humidity} onChange={e => setCustom(p => ({ ...p, humidity: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            풍속: {custom.windSpeed}m/s
            <input type="range" min={0} max={15} value={custom.windSpeed} onChange={e => setCustom(p => ({ ...p, windSpeed: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            강수
            <select
              value={custom.precipitation}
              onChange={e => setCustom(p => ({ ...p, precipitation: e.target.value as WeatherInfo['precipitation'] }))}
              className="rounded px-2 py-1 text-gray-800"
            >
              <option value="none">없음</option>
              <option value="rain">비</option>
              <option value="snow">눈</option>
              <option value="sleet">진눈깨비</option>
            </select>
          </label>
        </div>
        <RunnerAvatar weather={custom} />
      </div>

      {/* 프리셋 그리드 */}
      <h2 className="font-bold text-gray-800 text-lg">프리셋</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {PRESETS.map(({ label, weather }) => (
          <div
            key={label}
            className="bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl p-4 text-white"
          >
            <p className="text-xs font-semibold mb-1 text-white/80">{label}</p>
            <p className="text-[10px] text-white/60 mb-3">
              {weather.temperature}°C · UV {weather.uvIndex ?? 'N/A'} · {weather.precipitation}
            </p>
            <RunnerAvatar weather={weather} />
          </div>
        ))}
      </div>
    </div>
  )
}
