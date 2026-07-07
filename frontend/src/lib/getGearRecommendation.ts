import type { AirQualityMetrics, WeatherInfo } from '../domain/entities/airQuality.types'

/**
 * "오늘의 준비물" (today's gear) recommendation for the connected flow's Gear
 * screen. Deliberately independent from RunnerAvatar's private `getOutfit()`
 * (frontend/src/presentation/components/shared/RunnerAvatar.tsx) — that
 * function renders avatar colors for the existing `/outfit` simulator and is
 * left untouched to avoid destabilizing a working feature. This function
 * targets the same real-world temperature/UV guidance but returns a
 * structured checklist instead of SVG colors, and additionally considers
 * air quality (mask recommendation) and humidity/wind, which `getOutfit`
 * does not.
 */

export interface GearItem {
  icon: 'shirt' | 'glasses' | 'footprints' | 'droplets' | 'wind' | 'shield'
  title: string
  note: string
  tone: 'good' | 'warn'
}

export interface GearRecommendation {
  items: GearItem[]
  extras: string[]
}

function clothingItem(weather: WeatherInfo): GearItem {
  const { temperature, precipitation } = weather

  if (precipitation === 'rain') {
    return {
      icon: 'shirt',
      title: '방수 재킷 + 긴바지',
      note: '비가 오는 중이에요. 방수 재킷으로 체온 저하를 막고, 노면이 미끄러우니 시야 확보에 신경 쓰세요.',
      tone: 'warn',
    }
  }
  if (precipitation === 'snow' || precipitation === 'sleet') {
    return {
      icon: 'shirt',
      title: '방한 재킷 + 장갑',
      note: '눈/진눈깨비 중이에요. 방한 재킷과 장갑으로 체온을 유지하고, 접지가 불안정하니 페이스를 낮추세요.',
      tone: 'warn',
    }
  }
  if (temperature >= 28) {
    return {
      icon: 'shirt',
      title: '민소매 · 반바지',
      note: `${temperature}°C로 더워요. 통기성 좋은 가벼운 소재가 편합니다.`,
      tone: 'warn',
    }
  }
  if (temperature >= 15) {
    return {
      icon: 'shirt',
      title: '반팔 · 반바지',
      note: `${temperature}°C엔 통기성 좋은 가벼운 소재가 편해요. 땀 배출이 잘 되는 기능성 원단 추천.`,
      tone: 'good',
    }
  }
  if (temperature >= 8) {
    return {
      icon: 'shirt',
      title: '긴팔 · 반바지',
      note: `${temperature}°C로 선선해요. 얇은 긴팔로 체온을 유지하세요.`,
      tone: 'good',
    }
  }
  if (temperature >= 0) {
    return {
      icon: 'shirt',
      title: '긴팔 · 긴바지 + 바람막이',
      note: `${temperature}°C로 쌀쌀해요. 바람을 막아주는 겉옷을 챙기세요.`,
      tone: 'warn',
    }
  }
  return {
    icon: 'shirt',
    title: '기모 긴팔 + 장갑',
    note: `${temperature}°C로 추워요. 보온이 우선이니 기모 소재와 장갑을 챙기세요.`,
    tone: 'warn',
  }
}

function headwearItem(weather: WeatherInfo): GearItem | null {
  const { precipitation, uvIndex } = weather
  if (precipitation !== 'none' || uvIndex == null) return null

  if (uvIndex >= 6) {
    return {
      icon: 'glasses',
      title: '캡 모자 · 선글라스',
      note: `자외선 지수 ${uvIndex}(높음 이상). 눈과 두피를 보호하고 눈부심을 줄여줘요.`,
      tone: 'warn',
    }
  }
  if (uvIndex >= 3) {
    return {
      icon: 'glasses',
      title: '캡 모자',
      note: `자외선 지수 ${uvIndex}(보통). 장시간 노출 시 모자를 추천해요.`,
      tone: 'warn',
    }
  }
  return null
}

function shoesItem(weather: WeatherInfo): GearItem {
  if (weather.precipitation !== 'none') {
    return {
      icon: 'footprints',
      title: '러닝화',
      note: '노면이 젖어 있어 접지력이 떨어져요. 그립이 좋은 신발을 고르고 페이스를 낮추세요.',
      tone: 'warn',
    }
  }
  return {
    icon: 'footprints',
    title: '러닝화',
    note: '쿠셔닝 있는 데일리 트레이너면 충분해요. 노면이 말라 있어 접지 걱정 적음.',
    tone: 'good',
  }
}

function waterItem(weather: WeatherInfo): GearItem {
  const { temperature, humidity } = weather
  if (temperature >= 22 || humidity >= 60) {
    return {
      icon: 'droplets',
      title: '물 500㎖',
      note: `${temperature >= 22 ? `기온 ${temperature}°C` : `습도 ${humidity}%`}로 땀이 잘 나는 편. 30분 이상 달릴 계획이면 챙기세요.`,
      tone: 'good',
    }
  }
  return {
    icon: 'droplets',
    title: '물 (선택)',
    note: '쾌적한 편이라 짧게 달린다면 없어도 괜찮아요.',
    tone: 'good',
  }
}

function maskItem(airQuality: AirQualityMetrics): GearItem | null {
  const { pm25, pm10 } = airQuality
  if (pm25 == null && pm10 == null) return null

  const veryBad = (pm25 != null && pm25 > 75) || (pm10 != null && pm10 > 150)
  const bad = (pm25 != null && pm25 > 35) || (pm10 != null && pm10 > 80)

  if (veryBad) {
    return {
      icon: 'shield',
      title: '보건용 마스크 (KF80 이상)',
      note: '미세먼지가 매우 나쁨 수준이에요. 장시간 야외 활동보다 마스크 착용 또는 실내 운동을 고려하세요.',
      tone: 'warn',
    }
  }
  if (bad) {
    return {
      icon: 'shield',
      title: '보건용 마스크',
      note: '미세먼지가 나쁨 수준이에요. 호흡기 부담을 줄이려면 마스크 착용을 고려하세요.',
      tone: 'warn',
    }
  }
  return null
}

/**
 * `weather` is optional because the mock air-quality client (used whenever
 * `AIR_KOREA_API_KEY`/`KMA_API_KEY` aren't set) never returns weather data —
 * this must still produce a sensible air-quality-only recommendation then.
 */
export function getGearRecommendation(
  weather: WeatherInfo | undefined,
  airQuality: AirQualityMetrics
): GearRecommendation {
  if (!weather) {
    const items: GearItem[] = [
      {
        icon: 'shirt',
        title: '계절에 맞는 복장',
        note: '날씨 정보를 가져오지 못해 기온 기반 추천은 생략했어요. 대기질만 반영한 추천입니다.',
        tone: 'good',
      },
    ]
    const mask = maskItem(airQuality)
    if (mask) items.push(mask)
    items.push({ icon: 'footprints', title: '러닝화', note: '평소 신는 러닝화면 충분해요.', tone: 'good' })
    return { items, extras: ['러닝 벨트'] }
  }

  const items: GearItem[] = [clothingItem(weather)]

  const headwear = headwearItem(weather)
  if (headwear) items.push(headwear)

  const mask = maskItem(airQuality)
  if (mask) items.push(mask)

  items.push(shoesItem(weather), waterItem(weather))

  const extras: string[] = ['러닝 벨트']
  if (weather.humidity >= 70) extras.unshift('얇은 손수건')
  if (weather.windSpeed >= 7) extras.push('바람막이')
  if (weather.uvIndex != null && weather.uvIndex >= 3 && weather.precipitation === 'none') {
    extras.push('자외선 차단제')
  }

  return { items, extras }
}
