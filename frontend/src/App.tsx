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
  // 실제 클라이언트는 hourlyForecast[0]이 항상 current와 동일하지만, mock 클라이언트는
  // hourlyForecast를 "지금부터"가 아니라 0~23시 달력 순으로 채운다(둘의 계약이 다름) —
  // 그래서 인덱스에 의존하지 않고 data.current + 실제 현재 시각으로 직접 합성한다.
  const currentAsHourly: HourlyForecastType | null = data
    ? { hour: new Date().getHours(), airQuality: data.current.airQuality, weather: data.current.weather, runningIndex: data.current.runningIndex }
    : null
  const displayHour: HourlyForecastType | null = selectedHour ?? currentAsHourly

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
