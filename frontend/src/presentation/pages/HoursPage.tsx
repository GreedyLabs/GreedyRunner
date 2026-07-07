import { Backpack, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HourlyForecast } from '../components/shared/HourlyForecast'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { hourLabel } from '../../lib/hourFormat'
import { TONE_CLASSES, STATUS_TONE } from '../../lib/runningStatusColors'
import type { AirQualityData, HourlyForecast as HourlyForecastType } from '../../domain/entities/airQuality.types'

interface HoursPageProps {
  data: AirQualityData | null
  selectedHour: HourlyForecastType | null
  onHourSelect: (hourData: HourlyForecastType | null) => void
}

export function HoursPage({ data, selectedHour, onHourSelect }: HoursPageProps) {
  const navigate = useNavigate()

  const bestHoursData = data
    ? data.bestRunningHours
        .map((b) => data.hourlyForecast.find((h) => h.hour === b.hour && !!h.isNextDay === b.isNextDay))
        .filter((h): h is HourlyForecastType => h != null)
    : []

  const ctaHour = selectedHour ?? bestHoursData[0] ?? data?.hourlyForecast[0] ?? null

  return (
    <>
      <h1 className="text-[22px] font-extrabold tracking-tight">시간대별 러닝 지수</h1>
      <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed">
        지금부터 24시간, 대기질·기상을 반영한 시간별 예측이에요. 막대를 탭하면 그 시간 기준으로 준비물·팁을 볼 수 있어요.
      </p>

      {data ? (
        <>
          <div className="mt-4">
            <HourlyForecast
              forecast={data.hourlyForecast}
              bestHours={data.bestRunningHours}
              selectedHour={selectedHour?.hour ?? null}
              onHourSelect={onHourSelect}
            />
          </div>

          {bestHoursData.length > 0 && (
            <>
              <h2 className="mt-6 mb-2.5 text-[15px] font-bold">가장 좋은 시간</h2>
              <div className="bg-panel border border-line rounded-3xl overflow-hidden">
                {bestHoursData.map((h, i) => {
                  const tone = STATUS_TONE[h.runningIndex.status]
                  return (
                    <button
                      key={`${h.hour}-${h.isNextDay ?? false}`}
                      type="button"
                      onClick={() => onHourSelect(h)}
                      className="w-full text-left flex items-center gap-3.5 px-[18px] py-[15px] border-b border-line last:border-b-0 hover:bg-paper/50 transition"
                    >
                      <span className="font-display text-[15px] font-extrabold text-faint w-5">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{hourLabel(h.hour, h.isNextDay)}</p>
                        <p className="text-[11.5px] text-muted mt-0.5">{h.runningIndex.label}</p>
                      </div>
                      <span className={`font-display text-[22px] font-extrabold ${TONE_CLASSES[tone].text}`}>
                        {h.runningIndex.score}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {ctaHour && (
            <button
              type="button"
              onClick={() => navigate('/gear')}
              className="w-full mt-[18px] flex items-center justify-between bg-accent rounded-2xl px-[18px] py-4"
            >
              <span className="flex items-center gap-2.5 text-white text-sm font-bold">
                <Backpack className="w-[18px] h-[18px]" />
                {hourLabel(ctaHour.hour, ctaHour.isNextDay)}에 뭘 입고 나갈까요
              </span>
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
          )}
        </>
      ) : (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="시간대별 예보를 불러오는 중..." />
        </div>
      )}

      <section className="mt-8 pt-6 border-t border-line">
        <h2 className="text-base font-bold mb-3">언제 달리는 게 좋을까요?</h2>
        <div className="space-y-2.5 text-sm text-muted leading-relaxed">
          <p>
            러닝 지수는 초미세먼지·미세먼지·오존 같은 대기질과 기온·습도·바람 등 기상 조건을
            종합해 0~100점으로 계산합니다. 점수가 높을수록 야외 러닝에 무리가 적은 시간대예요.
          </p>
          <p>
            오존은 햇빛이 강한 한낮에 높아졌다가 해가 지면서 빠르게 떨어지고, 기온도 저녁으로
            갈수록 선선해지기 때문에 대체로 늦은 오후에서 초저녁이 달리기 좋은 편입니다.
          </p>
          <p>
            미세먼지는 출퇴근 시간대 교통량과 바람의 영향을 크게 받습니다. 하루 중 시간대별
            예측을 함께 확인하면 대기질이 나쁜 시간을 피해 가장 쾌적한 러닝 시간을 고를 수 있어요.
          </p>
        </div>
      </section>
    </>
  )
}
