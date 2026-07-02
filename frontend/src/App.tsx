import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MainLayout } from './presentation/layouts/MainLayout'
import { HomePage } from './presentation/pages/HomePage'
import { AvatarPreview } from './presentation/pages/AvatarPreview'
import { RunningTipPage } from './presentation/pages/RunningTipPage'
import { RunningTipsPage } from './presentation/pages/RunningTipsPage'
import { NotFoundPage } from './presentation/pages/NotFoundPage'
import { UmamiScript } from './presentation/components/shared/UmamiScript'
import { Seo } from './presentation/components/shared/Seo'
import { useAirQuality } from './application/hooks/useAirQuality'
import { useLocation } from './application/hooks/useLocation'
import type { Region } from './domain/entities/region.types'

function App() {
  const airQuality = useAirQuality()
  const location = useLocation()

  // 위치 기반 지역이 확인되면 자동 조회
  useEffect(() => {
    if (location.region) {
      airQuality.fetchByRegion(location.region.id, location.region.lat, location.region.lng)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- location.region 변경 시에만 호출
  }, [location.region])

  function handleRegionSelect(region: Region) {
    airQuality.fetchByRegion(region.id, region.lat, region.lng)
  }

  return (
    <MainLayout>
      <Seo />
      <UmamiScript />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              data={airQuality.data}
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
        <Route path="/outfit" element={<AvatarPreview currentWeather={airQuality.data?.current.weather} />} />
        <Route path="/tips" element={<RunningTipsPage />} />
        <Route path="/tips/:id" element={<RunningTipPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  )
}

export default App
