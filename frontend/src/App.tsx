import { useEffect, useState } from 'react'
import { Routes, Route, useLocation as useRouterLocation } from 'react-router-dom'
import { MainLayout } from './presentation/layouts/MainLayout'
import { HomePage } from './presentation/pages/HomePage'
import { HoursPage } from './presentation/pages/HoursPage'
import { GearPage } from './presentation/pages/GearPage'
import { TipPage } from './presentation/pages/TipPage'
import { AvatarPreview } from './presentation/pages/AvatarPreview'
import { RunningTipPage } from './presentation/pages/RunningTipPage'
import { RunningTipsPage } from './presentation/pages/RunningTipsPage'
import { NotFoundPage } from './presentation/pages/NotFoundPage'
import { UmamiScript } from './presentation/components/shared/UmamiScript'
import { Seo } from './presentation/components/shared/Seo'
import { useAirQuality } from './application/hooks/useAirQuality'
import { useLocation } from './application/hooks/useLocation'
import type { Region } from './domain/entities/region.types'
import type { HourlyForecast as HourlyForecastType } from './domain/entities/airQuality.types'

/**
 * 라우트 이동 시 페이지 스크롤을 맨 위로 되돌린다.
 * <Routes> 방식은 자동 스크롤 복원이 없어, 탭·팁·차트로 이동해도 이전 스크롤이 남는다.
 * 페이지 전체가 window(body) 스크롤이므로 window.scrollTo로 초기화한다.
 */
function ScrollToTop() {
  const { pathname } = useRouterLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  const airQuality = useAirQuality()
  const location = useLocation()

  // 시간대 화면에서 선택한 시간 — Hours/Gear/Tip 화면이 공유한다.
  // 홈 화면은 항상 "지금"(data.current)만 보여준다 (요약 화면이므로).
  const [selectedHour, setSelectedHour] = useState<HourlyForecastType | null>(null)

  // 위치 기반 지역이 확인되면 자동 조회
  useEffect(() => {
    if (location.region) {
      airQuality.fetchByRegion(location.region.id, location.region.lat, location.region.lng)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- location.region 변경 시에만 호출
  }, [location.region])

  // 새 데이터가 로드되면 시간 선택을 초기화
  useEffect(() => {
    setSelectedHour(null)
  }, [airQuality.data])

  // 검색으로 고른 지역을 활성 지역으로 반영 — 실제 조회는 위 useEffect([location.region])가
  // 담당한다. (직접 fetch하면 폴백 위치 안내가 남고 표시 지역이 어긋나므로 경로를 일원화)
  function handleRegionSelect(region: Region) {
    location.selectRegion(region)
  }

  const data = airQuality.data
  // hourlyForecast[0]은 실·mock 양쪽에서 "현재 시각" 바이고 current와 같은 값을 담는다
  // (mockAirQualityClient가 같은 계약을 지키도록 맞췄다).
  // 예전에는 브라우저 시계로 hour를 합성했는데, 기준 시각은 백엔드가 에어코리아 dataTime에
  // 고정해 두었으므로 두 값이 최대 한 시간 어긋났다 — 카드는 "오후 2시", 준비물·팁은
  // 오후 3시 기준으로 계산되는 상태가 됐다.
  const displayHour: HourlyForecastType | null = selectedHour ?? data?.hourlyForecast[0] ?? null

  return (
    <MainLayout regionName={data?.regionName ?? location.region?.shortName ?? null}>
      <ScrollToTop />
      <Seo />
      <UmamiScript />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              data={data}
              isLoading={airQuality.isLoading}
              error={airQuality.error}
              locatedRegion={location.region}
              isLocating={location.isLocating}
              locationError={location.error}
              onLocateMe={location.locateMe}
              onRegionSelect={handleRegionSelect}
            />
          }
        />
        <Route
          path="/hours"
          element={<HoursPage data={data} selectedHour={selectedHour} onHourSelect={setSelectedHour} />}
        />
        <Route path="/gear" element={<GearPage data={data} displayHour={displayHour} />} />
        <Route path="/tip" element={<TipPage data={data} displayHour={displayHour} />} />
        <Route path="/outfit" element={<AvatarPreview currentWeather={airQuality.data?.current.weather} />} />
        <Route path="/tips" element={<RunningTipsPage />} />
        <Route path="/tips/:id" element={<RunningTipPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  )
}

export default App
