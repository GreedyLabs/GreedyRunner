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
import { bestHourRangeLabel, ampmHour } from '../../lib/hourFormat'
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
  // 실제 클라이언트는 hourlyForecast[0]이 "지금"이지만, mock 클라이언트는 0~23시 달력
  // 순으로 채운다 — 인덱스에 의존하지 않고 현재 시각을 직접 찾아 그 시점부터 보여준다.
  const nowHour = new Date().getHours()
  const startIndex = data.hourlyForecast.findIndex((h) => h.hour === nowHour)
  const from = startIndex === -1 ? 0 : startIndex
  const preview = [...data.hourlyForecast.slice(from), ...data.hourlyForecast.slice(0, from)].slice(0, 7)
  const topHours = new Set(data.bestRunningHours.slice(0, 2).map((h) => h.hour))

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
      <div className="flex items-end gap-1.5 h-14">
        {preview.map((p) => {
          const active = topHours.has(p.hour);
          const height = Math.max(16, Math.round((p.runningIndex.score / 100) * 56))
          return (
            <div key={`${p.hour}-${p.isNextDay ?? false}`} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full rounded-[5px] ${active ? TONE_CLASSES.accent.bar : 'bg-bar'}`}
                style={{ height: `${height}px` }}
              />
              <span className={`text-[9px] ${active ? 'text-accent font-bold' : 'text-faint'}`}>
                {ampmHour(p.hour).hour12}
              </span>
            </div>
          )
        })}
      </div>
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
