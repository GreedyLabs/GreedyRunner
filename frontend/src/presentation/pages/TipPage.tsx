import { Link } from 'react-router-dom'
import { ChevronRight, Check, X, ArrowRight, List } from 'lucide-react'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getConditionTip } from '../../lib/getConditionTip'
import { RUNNING_TIPS } from '../../lib/runningTips'
import type { AirQualityData, HourlyForecast as HourlyForecastType } from '../../domain/entities/airQuality.types'

interface TipPageProps {
  data: AirQualityData | null
  displayHour: HourlyForecastType | null
}

export function TipPage({ data, displayHour }: TipPageProps) {
  const tip = data && displayHour ? getConditionTip(displayHour.weather, displayHour.airQuality) : null
  const related = tip ? RUNNING_TIPS.filter((t) => t.category === tip.category).slice(0, 2) : []

  return (
    <>
      {tip ? (
        <>
          <div className="flex items-center gap-2">
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
              <h2 className="mt-6 mb-2.5 text-sm font-bold">함께 보면 좋은 팁</h2>
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
        </>
      ) : (
        <>
          <h1 className="text-[23px] font-extrabold leading-snug tracking-tight">
            오늘 조건에 맞는 러닝 팁
          </h1>
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" label="팁을 불러오는 중..." />
          </div>
        </>
      )}

      <Link to="/tips" className="w-full mt-6 flex items-center justify-between bg-accent rounded-2xl px-[18px] py-4">
        <span className="flex items-center gap-2.5 text-white text-sm font-bold">
          <List className="w-[18px] h-[18px]" />
          전체 러닝 팁 목록 보기
        </span>
        <ArrowRight className="w-[18px] h-[18px] text-white" />
      </Link>

      <section className="mt-8 pt-6 border-t border-line">
        <h2 className="text-base font-bold mb-3">오늘 조건에 맞춰 달리는 법</h2>
        <div className="space-y-2.5 text-sm text-muted leading-relaxed">
          <p>
            같은 거리를 달려도 그날의 대기질과 기상 조건에 따라 몸에 주는 부담은 크게 달라집니다.
            GreedyRunner는 오늘의 초미세먼지·미세먼지·오존·기온·습도를 읽어 지금 컨디션에 맞는 러닝 팁을 제안합니다.
          </p>
          <p>
            오존이나 미세먼지가 보통 이상이면 호흡량이 많아지는 인터벌·템포런 같은 고강도 훈련보다
            대화가 가능한 편안한 조깅 페이스가 안전합니다. 대기질이 좋은 날엔 마음껏 강도를 올려도 좋아요.
          </p>
          <p>
            기온이 높고 습한 날은 페이스를 한 단계 낮추고 수분을 자주 보충하세요. 더 깊이 있는 러닝
            노하우가 필요하면 <Link to="/tips" className="text-accent underline underline-offset-2">러닝 팁 모음</Link>에서
            페이스·호흡·영양·회복까지 카테고리별 가이드를 확인할 수 있습니다.
          </p>
        </div>
      </section>
    </>
  )
}
