import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getConditionTip } from '../../lib/getConditionTip'
import { RUNNING_TIPS } from '../../lib/runningTips'
import type { AirQualityData, HourlyForecast as HourlyForecastType } from '../../domain/entities/airQuality.types'

interface TipPageProps {
  data: AirQualityData | null
  displayHour: HourlyForecastType | null
}

export function TipPage({ data, displayHour }: TipPageProps) {
  if (!data || !displayHour) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" label="팁을 불러오는 중..." />
      </div>
    )
  }

  const tip = getConditionTip(displayHour.weather, displayHour.airQuality)
  const related = RUNNING_TIPS.filter((t) => t.category === tip.category).slice(0, 2)

  return (
    <>
      <Link to="/" className="inline-flex items-center gap-1 text-muted text-[13px]">
        <ChevronLeft className="w-[15px] h-[15px]" />
        홈으로
      </Link>

      <div className="mt-3.5 flex items-center gap-2">
        <span className="whitespace-nowrap text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent-soft text-accent">
          {tip.category}
        </span>
        <span className="text-[11px] text-muted">오늘 조건 기반</span>
      </div>

      <h1 className="mt-3 text-[23px] font-extrabold leading-snug tracking-tight">{tip.title}</h1>
      <p className="mt-3 text-sm text-muted leading-relaxed pb-4 border-b border-line">{tip.body}</p>

      <div className="mt-4 flex flex-col gap-3.5">
        <div className="bg-panel border border-line rounded-2xl px-[18px] py-4">
          <p className="text-[13px] font-bold mb-2.5">오늘 추천 강도</p>
          <div className="flex flex-col gap-2.5">
            {tip.checklist.map((entry) => (
              <div key={entry.text} className="flex items-center gap-2.5">
                {entry.ok ? (
                  <Check className="w-[15px] h-[15px] text-accent flex-none" />
                ) : (
                  <X className="w-[15px] h-[15px] text-warn flex-none" />
                )}
                <span className={`text-[13px] ${entry.ok ? '' : 'text-muted'}`}>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm leading-relaxed">{tip.closing}</p>
      </div>

      {related.length > 0 && (
        <>
          <h3 className="mt-6 mb-2.5 text-sm font-bold">함께 보면 좋은 팁</h3>
          <div className="flex flex-col gap-2">
            {related.map((rt) => (
              <Link
                key={rt.id}
                to={`/tips/${rt.id}`}
                className="flex items-center gap-3 bg-panel border border-line rounded-2xl px-[15px] py-[13px]"
              >
                <div className="flex-none w-[34px] h-[34px] rounded-[10px] bg-accent-soft flex items-center justify-center text-lg">
                  {rt.emoji}
                </div>
                <span className="flex-1 text-[13.5px] font-semibold">{rt.title}</span>
                <ChevronRight className="w-[15px] h-[15px] text-faint" />
              </Link>
            ))}
          </div>
        </>
      )}

      <Link to="/tips" className="block text-center text-xs text-muted mt-4 underline underline-offset-2">
        전체 팁 보기
      </Link>
    </>
  )
}
