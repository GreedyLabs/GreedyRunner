import type { WeatherInfo } from '../../../domain/entities/airQuality.types'

interface RunnerAvatarProps {
  weather: WeatherInfo
}

type SleeveType = 'sleeveless' | 'short' | 'long'
type BottomType = 'short' | 'long'

type OutfitConfig = {
  hat: string | null
  top: string
  bottom: string
  shoes: string
  gloves: string | null
  extra: string | null
  sleeve: SleeveType
  bottomType: BottomType
  sunglasses: boolean
}

const SKIN = '#FBBF68'

function getOutfit(weather: WeatherInfo): { outfit: OutfitConfig; label: string } {
  const { temperature, precipitation, uvIndex } = weather

  let outfit: OutfitConfig
  let label: string

  if (precipitation === 'rain') {
    outfit = { hat: '#60a5fa', top: '#3b82f6', bottom: '#1e3a5f', shoes: '#94a3b8', gloves: null, extra: '방수', sleeve: 'long', bottomType: 'long', sunglasses: false }
    label = '방수 재킷 + 캡모자'
  } else if (precipitation === 'snow' || precipitation === 'sleet') {
    outfit = { hat: '#818cf8', top: '#6366f1', bottom: '#312e81', shoes: '#94a3b8', gloves: '#6b7280', extra: '방한', sleeve: 'long', bottomType: 'long', sunglasses: false }
    label = '방한 재킷 + 장갑 + 모자'
  } else if (temperature >= 28) {
    outfit = { hat: '#f97316', top: '#fb923c', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null, sleeve: 'sleeveless', bottomType: 'short', sunglasses: false }
    label = '민소매 + 반바지'
  } else if (temperature >= 15) {
    outfit = { hat: null, top: '#34d399', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null, sleeve: 'short', bottomType: 'short', sunglasses: false }
    label = '반팔 + 반바지'
  } else if (temperature >= 8) {
    outfit = { hat: null, top: '#60a5fa', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null, sleeve: 'long', bottomType: 'short', sunglasses: false }
    label = '긴팔 + 반바지'
  } else if (temperature >= 0) {
    outfit = { hat: null, top: '#818cf8', bottom: '#1f2937', shoes: '#9ca3af', gloves: null, extra: null, sleeve: 'long', bottomType: 'long', sunglasses: false }
    label = '긴팔 + 긴바지 + 바람막이'
  } else {
    outfit = { hat: '#6b7280', top: '#7c3aed', bottom: '#111827', shoes: '#9ca3af', gloves: '#6b7280', extra: '방한', sleeve: 'long', bottomType: 'long', sunglasses: false }
    label = '기모 긴팔 + 장갑 + 모자'
  }

  // UV 오버라이드 — 강수 시에는 이미 모자가 있으므로 건너뜀
  if (uvIndex != null && precipitation === 'none') {
    if (uvIndex >= 6) {
      // 높음 이상: 모자 + 선글라스
      if (!outfit.hat) outfit.hat = '#f59e0b'
      outfit.sunglasses = true
      label += ' + 선글라스'
      if (uvIndex >= 8) {
        outfit.extra = 'SPF'
        label += ' + 자외선차단제'
      }
    } else if (uvIndex >= 3) {
      // 보통: 모자 권장
      if (!outfit.hat) outfit.hat = '#f59e0b'
      label += ' + 모자'
    }
  }

  return { outfit, label }
}

export function RunnerAvatar({ weather }: RunnerAvatarProps) {
  const { outfit, label } = getOutfit(weather)

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 48 72" className="w-10 h-14 sm:w-12 sm:h-16 shrink-0">
        {/* 머리 */}
        <circle cx="24" cy="12" r="7" fill={SKIN} />
        {/* 모자 */}
        {outfit.hat && (
          <g>
            <circle cx="24" cy="8" r="8" fill={outfit.hat} />
            <rect x="14" y="7" width="20" height="5" rx="2.5" fill={outfit.hat} />
          </g>
        )}
        {/* 눈 / 선글라스 */}
        {outfit.sunglasses ? (
          <g>
            {/* 선글라스 프레임 */}
            <rect x="19" y="9.5" width="5" height="3.5" rx="1.5" fill="#1f2937" />
            <rect x="25" y="9.5" width="5" height="3.5" rx="1.5" fill="#1f2937" />
            <line x1="24" y1="11" x2="25" y2="11" stroke="#1f2937" strokeWidth="0.8" />
          </g>
        ) : (
          <g>
            <circle cx="22" cy="11" r="1" fill="#1f2937" />
            <circle cx="27" cy="11" r="1" fill="#1f2937" />
          </g>
        )}

        {/* 몸통 — 민소매일 때 좁게 */}
        <rect
          x={outfit.sleeve === 'sleeveless' ? 19 : 17}
          y="20"
          width={outfit.sleeve === 'sleeveless' ? 10 : 14}
          height="16"
          rx="5"
          fill={outfit.top}
        />

        {/* ── 팔 ── */}
        {outfit.sleeve === 'sleeveless' && (
          <>
            {/* 민소매: 팔 전체가 피부색 */}
            <rect x="8" y="22" width="11" height="4.5" rx="2.2" fill={SKIN} transform="rotate(-25 13 24)" />
            <rect x="30" y="21" width="11" height="4.5" rx="2.2" fill={SKIN} transform="rotate(20 35 23)" />
          </>
        )}
        {outfit.sleeve === 'short' && (
          <>
            {/* 반팔: 어깨 쪽은 상의색, 팔뚝은 피부색 */}
            <rect x="12" y="22" width="6" height="5" rx="2.5" fill={outfit.top} transform="rotate(-25 15 24)" />
            <rect x="30" y="21" width="6" height="5" rx="2.5" fill={outfit.top} transform="rotate(20 33 23)" />
            <rect x="6" y="23" width="7" height="4" rx="2" fill={SKIN} transform="rotate(-25 9 25)" />
            <rect x="35" y="21" width="7" height="4" rx="2" fill={SKIN} transform="rotate(20 38 23)" />
          </>
        )}
        {outfit.sleeve === 'long' && (
          <>
            {/* 긴팔: 팔 전체가 상의색 */}
            <rect x="8" y="22" width="11" height="5" rx="2.5" fill={outfit.top} transform="rotate(-25 13 24)" />
            <rect x="30" y="21" width="11" height="5" rx="2.5" fill={outfit.top} transform="rotate(20 35 23)" />
          </>
        )}

        {/* 장갑 */}
        {outfit.gloves && (
          <g>
            <circle cx="7" cy="26" r="2.5" fill={outfit.gloves} />
            <circle cx="41" cy="24" r="2.5" fill={outfit.gloves} />
          </g>
        )}

        {/* ── 다리 ── */}
        {outfit.bottomType === 'short' ? (
          <>
            {/* 반바지: 위는 하의색, 아래는 피부색 */}
            <rect x="17" y="35" width="6" height="10" rx="3" fill={outfit.bottom} transform="rotate(12 20 40)" />
            <rect x="25" y="35" width="6" height="10" rx="3" fill={outfit.bottom} transform="rotate(-15 28 40)" />
            <rect x="16" y="44" width="5" height="9" rx="2.5" fill={SKIN} transform="rotate(12 18 48)" />
            <rect x="26" y="43" width="5" height="9" rx="2.5" fill={SKIN} transform="rotate(-15 28 47)" />
          </>
        ) : (
          <>
            {/* 긴바지: 전체 하의색 */}
            <rect x="17" y="35" width="6" height="18" rx="3" fill={outfit.bottom} transform="rotate(12 20 44)" />
            <rect x="25" y="35" width="6" height="18" rx="3" fill={outfit.bottom} transform="rotate(-15 28 44)" />
          </>
        )}

        {/* 신발 */}
        <ellipse cx="14" cy="55" rx="5" ry="2.5" fill={outfit.shoes} transform="rotate(12 14 55)" />
        <ellipse cx="33" cy="52" rx="5" ry="2.5" fill={outfit.shoes} transform="rotate(-15 33 52)" />

        {/* 추가 아이템 뱃지 */}
        {outfit.extra && (
          <g>
            <rect x="30" y="0" width="18" height="10" rx="5" fill="white" opacity="0.9" />
            <text x="39" y="7.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#374151">{outfit.extra}</text>
          </g>
        )}
      </svg>

      <div className="min-w-0">
        <p className="text-white/90 text-[11px] sm:text-xs font-bold">{label}</p>
        {weather.precipitation !== 'none' && (
          <p className="text-white/70 text-[10px] sm:text-[11px] mt-0.5">
            {weather.precipitation === 'rain' ? '☔ 방수 장비 권장' : '🧤 방한 + 방수 필수'}
          </p>
        )}
        {weather.temperature >= 28 && (
          <p className="text-white/70 text-[10px] sm:text-[11px] mt-0.5">💧 수분 보충 필수</p>
        )}
      </div>
    </div>
  )
}
