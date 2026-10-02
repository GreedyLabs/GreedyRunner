import { Link } from 'react-router-dom'
import { ChevronRight, Lightbulb, Search, LocateFixed } from 'lucide-react'
import { RegionSearch } from '../components/shared/RegionSearch'
import { RunningIndexCard } from '../components/shared/RunningIndexCard'
import { ConditionGrid } from '../components/shared/ConditionGrid'
import { AirQualityDetails } from '../components/shared/AirQualityDetails'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { getGearRecommendation } from '../../lib/getGearRecommendation'
import { gearIconFor } from '../../lib/gearIcons'
import { getConditionTip } from '../../lib/getConditionTip'
import { bestHourRangeLabel, ampmHour, hourLabel } from '../../lib/hourFormat'
import { TONE_CLASSES } from '../../lib/runningStatusColors'
import type { Region } from '../../domain/entities/region.types'
import type { AirQualityData } from '../../domain/entities/airQuality.types'

interface HomePageProps {
  data: AirQualityData | null
  isLoading: boolean
  error: string | null
  locatedRegion: Region | null
  isLocating: boolean
  locationError: string | null
  onLocateMe: () => void
  onRegionSelect: (region: Region) => void
}

export function HomePage({
  data,
  isLoading,
  error,
  locatedRegion,
  isLocating,
  locationError,
  onLocateMe,
  onRegionSelect,
}: HomePageProps) {
  return (
    <>
      <RegionSearch
        onRegionSelect={onRegionSelect}
        onLocateMe={onLocateMe}
        isLocating={isLocating}
        locationError={locationError}
        selectedRegion={locatedRegion ?? null}
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="대기질 정보를 불러오는 중..." />
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-critical-soft border border-line rounded-2xl p-5 text-center">
          <p className="text-critical font-medium">{error}</p>
          <p className="text-muted text-sm mt-1">잠시 후 다시 시도해 주세요.</p>
        </div>
      )}

      {!data && !isLoading && !error && <EmptyState />}

      {data && !isLoading && (
        <>
          {/*
            대기질 쪽 상태도 함께 알린다. 백엔드가 serviceStatus.airKorea를 'ok'로 고정하던
            시절에는 이 값을 띄울 수 없었고, 그래서 에어코리아가 통째로 실패해도 화면에는
            아무 경고 없이 '측정 불가' 숫자만 나왔다.
          */}
          {data.serviceStatus?.airKorea === 'timeout' && (
            <ServiceNotice title="에어코리아 응답 지연" body="측정소 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." />
          )}
          {data.serviceStatus?.airKorea === 'error' && (
            <ServiceNotice title="에어코리아 장애" body="측정소 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." />
          )}
          {data.serviceStatus?.weather === 'timeout' && (
            <ServiceNotice title="기상청 API 허브 응답 지연" body="날씨 정보를 가져올 수 없어 대기질 기반으로만 달리기 지수를 계산했습니다." />
          )}
          {data.serviceStatus?.weather === 'error' && (
            <ServiceNotice title="기상청 API 허브 장애" body="날씨 정보를 가져올 수 없어 대기질 기반으로만 달리기 지수를 계산했습니다." />
          )}
          {data.stationFallback && (
            <ServiceNotice
              title={`${data.stationFallback.originalStation} 측정소 데이터 비정상`}
              body={`근처 ${data.stationFallback.fallbackStation} 측정소 데이터로 대체하여 표시합니다.`}
            />
          )}

          <RunningIndexCard runningIndex={data.current.runningIndex} updatedAt={data.updatedAt} />
          <ConditionGrid airQuality={data.current.airQuality} weather={data.current.weather} />

          <TimelinePreview data={data} />
          <GearPreview data={data} />
          <TipPreview data={data} />

          <AirQualityDetails metrics={data.current.airQuality} weather={data.current.weather} />
        </>
      )}
    </>
  )
}

function ServiceNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-warn-soft border border-line rounded-2xl p-3 sm:p-4">
      <p className="text-warn font-medium text-xs sm:text-sm">{title}</p>
      <p className="text-muted mt-0.5 text-xs sm:text-sm">{body}</p>
    </div>
  )
}

function TimelinePreview({ data }: { data: AirQualityData }) {
  // 24시간 전체를 보여 준다. 예전에는 앞 7시간만 잘라 보여 줬는데, 좋은 시간대는 보통
  // 늦은 오후라 헤드라인이 가리키는 시각("오후 4시 추천")이 차트 밖에 있었다.
  // 추천 막대를 강조하는 코드도 사실상 항상 빈손이었다.
  // (탭해서 시간을 고르는 상호작용은 /hours가 담당하므로 여기서는 읽기 전용으로 둔다)
  //
  // hourlyForecast[0]이 "지금"이다 (실·mock 공통 계약).
  const forecast = data.hourlyForecast
  // hour만 비교하면 내일 6시가 오늘 6시 막대를 강조하므로 isNextDay까지 함께 본다.
  const bestKeys = new Set(data.bestRunningHours.map((h) => `${h.hour}-${h.isNextDay}`))

  return (
    <Link
      to="/hours"
      className="block w-full text-left bg-panel border border-line rounded-3xl p-[18px] hover:opacity-90 transition"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-[15px]">언제 달릴까요</h3>
        <span className="flex items-center gap-0.5 text-xs text-accent font-bold whitespace-nowrap">
          {bestHourRangeLabel(data.bestRunningHours)} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
      {/* 막대가 24개라 간격을 좁힌다. 좁은 화면에서도 가로 스크롤 없이 한 화면에 들어간다. */}
      <div className="flex items-end gap-[2px] h-14" aria-hidden="true">
        {forecast.map((p, i) => {
          const isBest = bestKeys.has(`${p.hour}-${!!p.isNextDay}`)
          const isNow = i === 0
          // 'unknown'은 점수 0으로 내려오지만 "최악"이 아니라 "측정 불가"다.
          const isUnknown = p.runningIndex.status === 'unknown'
          const height = isUnknown ? 6 : Math.max(6, Math.round((p.runningIndex.score / 100) * 56))
          const color = isUnknown
            ? 'bg-bar opacity-50'
            : isBest
              ? TONE_CLASSES.accent.bar
              : isNow
                ? 'bg-ink'
                : 'bg-bar'
          return (
            <div key={`${p.hour}-${p.isNextDay ?? false}`} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`w-full rounded-[2px] ${color}`} style={{ height: `${height}px` }} />
              {/* 24개를 모두 적으면 겹치므로 3시간 간격으로만 표시한다 (/hours와 같은 규칙) */}
              <span
                className={`text-[9px] leading-none h-3 ${
                  isBest ? 'text-accent font-bold' : isNow ? 'text-ink font-bold' : 'text-faint'
                }`}
              >
                {isNow || isBest || p.hour % 3 === 0 ? ampmHour(p.hour).hour12 : ''}
              </span>
            </div>
          )
        })}
      </div>
      {/* 색이 무엇을 뜻하는지 알려 준다. 막대 자체는 aria-hidden이므로 이 문장이
          스크린리더에 전달되는 유일한 요약이다. */}
      <p className="mt-3 text-[11px] text-muted">
        {`지금부터 24시간 · ${
          data.bestRunningHours.length > 0
            ? `추천 ${data.bestRunningHours.map((b) => hourLabel(b.hour, b.isNextDay)).join(', ')}`
            : '추천할 만한 시간대가 없어요'
        }`}
      </p>
    </Link>
  )
}

function GearPreview({ data }: { data: AirQualityData }) {
  const gear = getGearRecommendation(data.current.weather, data.current.airQuality)
  return (
    <Link to="/gear" className="block w-full text-left bg-panel border border-line rounded-3xl p-[18px] hover:opacity-90 transition">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[15px]">오늘의 준비물</h3>
        <span className="flex items-center gap-0.5 text-xs text-accent font-bold whitespace-nowrap">
          전체 보기 <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="flex flex-col">
        {gear.items.slice(0, 4).map((item) => {
          const Icon = gearIconFor(item.icon)
          const warn = item.tone === 'warn'
          return (
            <div
              key={item.title}
              className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0"
            >
              <Icon className={`flex-none w-[18px] h-[18px] ${warn ? 'text-warn' : 'text-accent'}`} />
              <span className="flex-1 text-sm font-semibold truncate">{item.title}</span>
              {item.meta && (
                <span className={`text-xs font-semibold whitespace-nowrap ${warn ? 'text-warn' : 'text-faint'}`}>
                  {item.meta}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Link>
  )
}

function TipPreview({ data }: { data: AirQualityData }) {
  const tip = getConditionTip(data.current.weather, data.current.airQuality)
  return (
    <Link to="/tip" className="block w-full text-left bg-accent-soft rounded-3xl p-[18px] hover:opacity-90 transition">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] font-bold tracking-wide text-accent">오늘 조건 팁</span>
      </div>
      <p className="text-sm font-semibold leading-snug">{tip.title}</p>
      <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-accent">
        팁 자세히 <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <h2 className="text-xl font-bold mb-2">지금 달릴 수 있을까요?</h2>
      <p className="text-muted text-sm leading-relaxed">
        현재 위치 버튼을 누르거나
        <br />
        지역을 검색해서 러닝 지수를 확인하세요.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-xs">
        {[
          { Icon: LocateFixed, label: '위치 기반 조회' },
          { Icon: Search, label: '지역 검색' },
          { Icon: ChevronRight, label: '최적 시간 안내' },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-panel border border-line rounded-2xl flex items-center justify-center">
              <Icon className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
