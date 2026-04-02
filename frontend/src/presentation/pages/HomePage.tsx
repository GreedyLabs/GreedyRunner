import { useEffect } from 'react'
import { RegionSearch } from '../components/shared/RegionSearch'
import { RunningIndexCard } from '../components/shared/RunningIndexCard'
import { HourlyForecast } from '../components/shared/HourlyForecast'
import { AirQualityDetails } from '../components/shared/AirQualityDetails'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAirQuality } from '../../application/hooks/useAirQuality'
import { useLocation } from '../../application/hooks/useLocation'
import type { Region } from '../../domain/entities/region.types'

export function HomePage() {
  const { data, isLoading, error, fetchByRegion } = useAirQuality()
  const { region: locatedRegion, isLocating, error: locationError, locateMe } = useLocation()

  // 위치 기반 지역이 확인되면 자동 조회
  useEffect(() => {
    if (locatedRegion) {
      fetchByRegion(locatedRegion.id)
    }
  }, [locatedRegion, fetchByRegion])

  function handleRegionSelect(region: Region) {
    fetchByRegion(region.id)
  }

  const selectedRegion = locatedRegion ?? null

  return (
    <>
      {/* 지역 검색 */}
      <RegionSearch
        onRegionSelect={handleRegionSelect}
        onLocateMe={locateMe}
        isLocating={isLocating}
        locationError={locationError}
        selectedRegion={selectedRegion}
      />

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="대기질 정보를 불러오는 중..." />
        </div>
      )}

      {/* 에러 상태 */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
          <p className="text-red-500 font-medium">⚠️ {error}</p>
          <p className="text-red-400 text-sm mt-1">잠시 후 다시 시도해 주세요.</p>
        </div>
      )}

      {/* 빈 상태 */}
      {!data && !isLoading && !error && (
        <EmptyState />
      )}

      {/* 데이터 표시 */}
      {data && !isLoading && (
        <>
          <RunningIndexCard
            runningIndex={data.current.runningIndex}
            airQuality={data.current.airQuality}
            regionName={data.regionName}
            updatedAt={data.updatedAt}
          />
          <HourlyForecast
            forecast={data.hourlyForecast}
            bestHours={data.bestRunningHours}
          />
          <AirQualityDetails metrics={data.current.airQuality} />
        </>
      )}
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="text-6xl mb-4">🏃</div>
      <h2 className="text-xl font-bold text-gray-700 mb-2">
        지금 달릴 수 있을까요?
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        현재 위치 버튼을 누르거나
        <br />
        지역을 검색해서 러닝 지수를 확인하세요.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-xs">
        {[
          { icon: '📍', label: '위치 기반 조회' },
          { icon: '🔍', label: '지역 검색' },
          { icon: '⏰', label: '최적 시간 안내' },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl">
              {item.icon}
            </div>
            <span className="text-xs text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
