import type { WeatherInfo } from '../../../domain/entities/airQuality.types'

interface RunnerAvatarProps {
  weather: WeatherInfo
}

type OutfitConfig = {
  hat: string | null
  top: string
  bottom: string
  shoes: string
  gloves: string | null
  extra: string | null     // 추가 아이템 텍스트
}

function getOutfit(weather: WeatherInfo): { outfit: OutfitConfig; label: string } {
  const { temperature, precipitation } = weather

  if (precipitation === 'rain') {
    return {
      outfit: { hat: '#60a5fa', top: '#3b82f6', bottom: '#1e3a5f', shoes: '#94a3b8', gloves: null, extra: '방수' },
      label: '방수 재킷 + 캡모자',
    }
  }
  if (precipitation === 'snow' || precipitation === 'sleet') {
    return {
      outfit: { hat: '#818cf8', top: '#6366f1', bottom: '#312e81', shoes: '#94a3b8', gloves: '#6b7280', extra: '방한' },
      label: '방한 재킷 + 장갑 + 모자',
    }
  }

  if (temperature >= 28) {
    return {
      outfit: { hat: '#f97316', top: '#fb923c', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null },
      label: '민소매 + 반바지',
    }
  }
  if (temperature >= 15) {
    return {
      outfit: { hat: null, top: '#34d399', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null },
      label: '반팔 + 반바지',
    }
  }
  if (temperature >= 8) {
    return {
      outfit: { hat: null, top: '#60a5fa', bottom: '#374151', shoes: '#d1d5db', gloves: null, extra: null },
      label: '긴팔 + 반바지',
    }
  }
  if (temperature >= 0) {
    return {
      outfit: { hat: null, top: '#818cf8', bottom: '#1f2937', shoes: '#9ca3af', gloves: null, extra: null },
      label: '긴팔 + 긴바지 + 바람막이',
    }
  }
  return {
    outfit: { hat: '#6b7280', top: '#7c3aed', bottom: '#111827', shoes: '#9ca3af', gloves: '#6b7280', extra: '방한' },
    label: '기모 긴팔 + 장갑 + 모자',
  }
}

export function RunnerAvatar({ weather }: RunnerAvatarProps) {
  const { outfit, label } = getOutfit(weather)

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 48 72" className="w-10 h-14 sm:w-12 sm:h-16 shrink-0">
        {/* 머리 */}
        <circle cx="24" cy="12" r="7" fill="#FBBF68" />
        {/* 모자 */}
        {outfit.hat && (
          <g>
            <circle cx="24" cy="8" r="8" fill={outfit.hat} />
            <rect x="14" y="7" width="20" height="5" rx="2.5" fill={outfit.hat} />
          </g>
        )}
        {/* 눈 */}
        <circle cx="22" cy="11" r="1" fill="#1f2937" />
        <circle cx="27" cy="11" r="1" fill="#1f2937" />

        {/* 몸통 */}
        <rect x="17" y="20" width="14" height="16" rx="5" fill={outfit.top} />

        {/* 왼팔 (뒤) */}
        <rect x="8" y="22" width="10" height="5" rx="2.5" fill={outfit.top} transform="rotate(-25 13 24)" />
        {/* 오른팔 (앞) */}
        <rect x="30" y="21" width="10" height="5" rx="2.5" fill={outfit.top} transform="rotate(20 35 23)" />

        {/* 장갑 */}
        {outfit.gloves && (
          <g>
            <circle cx="7" cy="26" r="2.5" fill={outfit.gloves} />
            <circle cx="41" cy="24" r="2.5" fill={outfit.gloves} />
          </g>
        )}

        {/* 왼다리 (뒤) */}
        <rect x="17" y="35" width="6" height="18" rx="3" fill={outfit.bottom} transform="rotate(12 20 44)" />
        {/* 오른다리 (앞) */}
        <rect x="25" y="35" width="6" height="18" rx="3" fill={outfit.bottom} transform="rotate(-15 28 44)" />

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
