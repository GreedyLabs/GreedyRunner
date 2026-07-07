import { Link } from 'react-router-dom'
import { Lightbulb, ArrowRight } from 'lucide-react'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getGearRecommendation } from '../../lib/getGearRecommendation'
import { gearIconFor } from '../../lib/gearIcons'
import { hourLabel } from '../../lib/hourFormat'
import type { AirQualityData, HourlyForecast as HourlyForecastType } from '../../domain/entities/airQuality.types'

interface GearPageProps {
  data: AirQualityData | null
  displayHour: HourlyForecastType | null
}

export function GearPage({ data, displayHour }: GearPageProps) {
  if (!data || !displayHour) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" label="준비물 정보를 불러오는 중..." />
      </div>
    )
  }

  const { weather, airQuality } = displayHour
  const gear = getGearRecommendation(weather, airQuality)

  return (
    <>
      <h2 className="text-[22px] font-extrabold tracking-tight">
        {hourLabel(displayHour.hour, displayHour.isNextDay)}의 준비물
      </h2>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {weather ? (
          <>
            <Chip label={`기온 ${weather.temperature}°C`} />
            <Chip label={`자외선 ${weather.uvIndex == null ? '정보 없음' : weather.uvIndex}`} warn={weather.uvIndex != null && weather.uvIndex >= 6} />
            <Chip label={`습도 ${weather.humidity}%`} />
            <Chip
              label={weather.precipitation === 'none' ? '비 없음' : weather.precipitation === 'rain' ? '비' : weather.precipitation === 'snow' ? '눈' : '진눈깨비'}
              warn={weather.precipitation !== 'none'}
            />
          </>
        ) : (
          <Chip label="날씨 정보 없음 — 대기질만 반영" warn />
        )}
      </div>

      <div className="mt-4.5 bg-panel border border-line rounded-3xl overflow-hidden">
        {gear.items.map((item) => {
          const Icon = gearIconFor(item.icon)
          const warn = item.tone === 'warn'
          return (
            <div key={item.title} className="flex gap-3.5 px-[18px] py-4 border-b border-line last:border-b-0">
              <div className={`flex-none w-10 h-10 rounded-xl flex items-center justify-center ${warn ? 'bg-warn-soft' : 'bg-accent-soft'}`}>
                <Icon className={`w-5 h-5 ${warn ? 'text-warn' : 'text-accent'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.note}</p>
              </div>
            </div>
          )
        })}
      </div>

      {gear.extras.length > 0 && (
        <>
          <h3 className="mt-5 mb-2.5 text-[13.5px] font-bold text-muted">이런 것도 챙기면 좋아요</h3>
          <div className="flex flex-wrap gap-2">
            {gear.extras.map((extra) => (
              <span key={extra} className="text-[12.5px] font-semibold bg-panel border border-line rounded-xl px-3.5 py-2.5">
                {extra}
              </span>
            ))}
          </div>
        </>
      )}

      <Link to="/tip" className="w-full mt-5 flex items-center justify-between bg-accent rounded-2xl px-[18px] py-4">
        <span className="flex items-center gap-2.5 text-white text-sm font-bold">
          <Lightbulb className="w-[18px] h-[18px]" />
          오늘 조건에 맞는 팁 보기
        </span>
        <ArrowRight className="w-[18px] h-[18px] text-white" />
      </Link>

      <Link to="/outfit" className="block text-center text-xs text-muted mt-3 underline underline-offset-2">
        아바타로 미리보기
      </Link>
    </>
  )
}

function Chip({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span
      className={`whitespace-nowrap text-xs font-semibold rounded-full px-2.5 py-1.5 ${
        warn ? 'text-warn bg-warn-soft' : 'text-muted bg-panel border border-line'
      }`}
    >
      {label}
    </span>
  )
}
