import { useState } from 'react'
import { Card } from '../ui/Card'
import type { AirQualityMetrics, WeatherInfo } from '../../../domain/entities/airQuality.types'
import { cn } from '../../../lib/cn'

interface AirQualityDetailsProps {
  metrics: AirQualityMetrics
  weather?: WeatherInfo
}

interface ThresholdLevel {
  max: number
  label: string
  color: string
  description: string  // 해당 수준 설명
}

/** 값이 결측일 때 사용하는 sentinel 등급 */
const UNKNOWN_THRESHOLD: ThresholdLevel = {
  max: Infinity,
  label: '측정 불가',
  color: 'text-muted bg-panel',
  description: '측정소 점검 등으로 데이터를 가져올 수 없습니다.',
}

interface MetricConfig {
  key: string
  label: string
  shortLabel: string
  /** `null`이면 측정 불가(측정소 점검 등) */
  value: number | null
  unit: string
  description: string   // 오염물질 설명
  healthEffect: string  // 건강 영향
  thresholds: ThresholdLevel[]
}

export function AirQualityDetails({ metrics, weather }: AirQualityDetailsProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const metricList: MetricConfig[] = [
    {
      key: 'pm25',
      label: '초미세먼지 (PM2.5)',
      shortLabel: '초미세먼지',
      value: metrics.pm25,
      unit: 'μg/m³',
      description: '지름 2.5μm 이하의 극미세 입자로, 머리카락 굵기의 1/20~1/30 크기입니다. 폐 깊숙이 침투해 혈류까지 흡수됩니다.',
      healthEffect: '장기간 노출 시 호흡기·심혈관 질환 위험 증가. 민감군(어린이·노인·임산부)에게 특히 위험합니다.',
      thresholds: [
        { max: 8,        label: '최고',       color: 'text-accent bg-accent-soft',  description: '러닝에 최적인 공기입니다.' },
        { max: 15,       label: '좋음',       color: 'text-accent bg-accent-soft',        description: '야외 활동에 적합합니다.' },
        { max: 25,       label: '보통',       color: 'text-warn bg-warn-soft',        description: '대부분의 사람에게 무리 없는 수준입니다.' },
        { max: 35,       label: '민감군주의', color: 'text-warn bg-warn-soft',      description: '민감군은 장시간 격렬한 운동을 줄이세요.' },
        { max: 75,       label: '나쁨',       color: 'text-critical bg-critical-soft',    description: '실외 활동을 자제하고 마스크를 착용하세요.' },
        { max: Infinity, label: '매우나쁨',   color: 'text-critical bg-critical-soft',          description: '모든 사람이 실외 활동을 자제해야 합니다.' },
      ],
    },
    {
      key: 'pm10',
      label: '미세먼지 (PM10)',
      shortLabel: '미세먼지',
      value: metrics.pm10,
      unit: 'μg/m³',
      description: '지름 10μm 이하의 먼지 입자입니다. 흙먼지, 꽃가루, 자동차 배기가스 등이 주요 발생원입니다.',
      healthEffect: '코·목에 자극을 주고 기관지 질환을 악화시킵니다. 황사 시즌에는 농도가 급격히 상승합니다.',
      thresholds: [
        { max: 15,       label: '최고',       color: 'text-accent bg-accent-soft',  description: '러닝에 최적인 공기입니다.' },
        { max: 30,       label: '좋음',       color: 'text-accent bg-accent-soft',        description: '야외 활동에 적합합니다.' },
        { max: 50,       label: '보통',       color: 'text-warn bg-warn-soft',        description: '대부분의 사람에게 무리 없는 수준입니다.' },
        { max: 80,       label: '민감군주의', color: 'text-warn bg-warn-soft',      description: '민감군은 장시간 실외 활동을 줄이세요.' },
        { max: 150,      label: '나쁨',       color: 'text-critical bg-critical-soft',    description: '실외 활동을 자제하고 마스크를 착용하세요.' },
        { max: Infinity, label: '매우나쁨',   color: 'text-critical bg-critical-soft',          description: '모든 사람이 실외 활동을 자제해야 합니다.' },
      ],
    },
    {
      key: 'o3',
      label: '오존 (O₃)',
      shortLabel: '오존',
      value: metrics.o3 == null ? null : Math.round(metrics.o3 * 1000),
      unit: 'ppb',
      description: '자동차·공장 배출가스가 자외선과 반응해 생성되는 2차 오염물질입니다. 맑고 더운 날 낮 시간대에 농도가 높아집니다.',
      healthEffect: '눈·코·기관지를 자극하며, 고농도에서는 폐 기능을 저하시킵니다. 러닝 중 호흡량이 많아 영향이 커집니다.',
      thresholds: [
        { max: 15,       label: '최고',       color: 'text-accent bg-accent-soft',  description: '러닝에 최적인 공기입니다.' },
        { max: 30,       label: '좋음',       color: 'text-accent bg-accent-soft',        description: '야외 활동에 적합합니다.' },
        { max: 50,       label: '보통',       color: 'text-warn bg-warn-soft',        description: '대부분의 사람에게 무리 없는 수준입니다.' },
        { max: 60,       label: '민감군주의', color: 'text-warn bg-warn-soft',      description: '민감군은 장시간 격렬한 운동을 줄이세요.' },
        { max: 90,       label: '나쁨',       color: 'text-critical bg-critical-soft',    description: '노약자·호흡기 질환자는 실외 활동을 자제하세요.' },
        { max: Infinity, label: '매우나쁨',   color: 'text-critical bg-critical-soft',          description: '모든 사람이 실외 활동을 자제해야 합니다.' },
      ],
    },
    {
      key: 'no2',
      label: '이산화질소 (NO₂)',
      shortLabel: '이산화질소',
      value: metrics.no2 == null ? null : Math.round(metrics.no2 * 1000),
      unit: 'ppb',
      description: '주로 자동차 엔진, 화력발전소에서 배출됩니다. 오존과 미세먼지 생성의 전구물질이기도 합니다.',
      healthEffect: '기관지를 자극해 기침·호흡 곤란을 유발합니다. 장기 노출 시 천식 위험이 증가합니다.',
      thresholds: [
        { max: 5,        label: '최고',       color: 'text-accent bg-accent-soft',  description: '러닝에 최적인 공기입니다.' },
        { max: 10,       label: '좋음',       color: 'text-accent bg-accent-soft',        description: '야외 활동에 적합합니다.' },
        { max: 20,       label: '보통',       color: 'text-warn bg-warn-soft',        description: '대부분의 사람에게 무리 없는 수준입니다.' },
        { max: 30,       label: '민감군주의', color: 'text-warn bg-warn-soft',      description: '민감군은 오랜 노출을 피하세요.' },
        { max: 50,       label: '나쁨',       color: 'text-critical bg-critical-soft',    description: '호흡기 질환자는 실외 활동을 자제하세요.' },
        { max: Infinity, label: '매우나쁨',   color: 'text-critical bg-critical-soft',          description: '모든 사람이 실외 활동을 자제해야 합니다.' },
      ],
    },
  ]

  const selectedMetric = metricList.find(m => m.key === selectedKey) ?? null

  function handleSelect(key: string) {
    setSelectedKey(prev => (prev === key ? null : key))
  }

  return (
    <Card className="animate-slide-up">
      <h3 className="font-bold text-ink text-base mb-4">대기질 상세</h3>
      <div className="grid grid-cols-2 gap-3">
        {metricList.map(metric => {
          const threshold = metric.value == null
            ? UNKNOWN_THRESHOLD
            : metric.thresholds.find(t => metric.value! <= t.max)!
          const isSelected = selectedKey === metric.key
          return (
            <MetricItem
              key={metric.key}
              metric={metric}
              threshold={threshold}
              isSelected={isSelected}
              onClick={() => handleSelect(metric.key)}
            />
          )
        })}
      </div>

      {/* 설명 패널 */}
      {selectedMetric && (
        <MetricDetail metric={selectedMetric} />
      )}

      {/* 기상 정보 */}
      {weather && <WeatherSection weather={weather} />}
    </Card>
  )
}

interface MetricItemProps {
  metric: MetricConfig
  threshold: ThresholdLevel
  isSelected: boolean
  onClick: () => void
}

function MetricItem({ metric, threshold, isSelected, onClick }: MetricItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-xl p-3 transition-all border-2',
        // 마우스/터치 클릭 시 브라우저 기본 파란 outline이 남는 문제를 없애고,
        // 키보드 탐색(focus-visible)에서는 앱 테마(accent) 링을 노출해 접근성을 유지한다.
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel',
        isSelected
          ? 'border-accent bg-accent-soft'
          : 'border-transparent bg-paper hover:border-line'
      )}
    >
      <p className="text-[11px] sm:text-xs text-muted mb-1 truncate">{metric.shortLabel}</p>
      <div className="flex items-end gap-1 sm:gap-1.5 mb-2">
        <span className="text-lg sm:text-xl font-bold text-ink">
          {metric.value == null ? '—' : metric.value}
        </span>
        <span className="text-[10px] sm:text-xs text-faint mb-0.5">{metric.unit}</span>
      </div>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-block text-xs font-semibold px-2 py-0.5 rounded-full',
            threshold.color
          )}
        >
          {threshold.label}
        </span>
        <span className="text-xs text-faint">{isSelected ? '▲' : '▼'}</span>
      </div>
    </button>
  )
}

interface MetricDetailProps {
  metric: MetricConfig
}

function MetricDetail({ metric }: MetricDetailProps) {
  const currentThreshold = metric.value == null
    ? UNKNOWN_THRESHOLD
    : metric.thresholds.find(t => metric.value! <= t.max)!

  return (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4 space-y-3">
      <div>
        <h4 className="font-bold text-ink text-sm mb-1">{metric.label}</h4>
        <p className="text-xs text-muted leading-relaxed">{metric.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted mb-1">건강 영향</p>
        <p className="text-xs text-muted leading-relaxed">{metric.healthEffect}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted mb-2">현재 상태 — {currentThreshold.label}</p>
        <p className="text-xs text-muted leading-relaxed mb-3">{currentThreshold.description}</p>
        <div className="space-y-1.5">
          {metric.thresholds.map((t, i) => {
            const prevMax = i === 0 ? 0 : metric.thresholds[i - 1].max
            const range = t.max === Infinity
              ? `${prevMax}< ${metric.unit}`
              : i === 0
                ? `0 ~ ${t.max} ${metric.unit}`
                : `${prevMax} ~ ${t.max} ${metric.unit}`
            const isCurrent = metric.value != null &&
              metric.value <= t.max &&
              (i === 0 || metric.value > metric.thresholds[i - 1].max)
            return (
              <div
                key={t.label}
                className={cn(
                  'flex items-center justify-between text-xs rounded-lg px-3 py-1.5',
                  isCurrent ? cn(t.color, 'font-semibold ring-1 ring-inset ring-current') : 'text-faint bg-panel'
                )}
              >
                <span>{t.label}</span>
                <span className="font-mono">{range}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const PRECIP_LABELS: Record<string, string> = {
  none: '없음',
  rain: '비',
  snow: '눈',
  sleet: '진눈깨비',
}

function WeatherSection({ weather }: { weather: WeatherInfo }) {
  const tempStatus = weather.temperature >= 12 && weather.temperature <= 22
    ? { label: '쾌적', color: 'text-accent bg-accent-soft' }
    : weather.temperature >= 5 && weather.temperature <= 28
      ? { label: '보통', color: 'text-warn bg-warn-soft' }
      : { label: '부적합', color: 'text-critical bg-critical-soft' }

  const humStatus = weather.humidity >= 40 && weather.humidity <= 60
    ? { label: '쾌적', color: 'text-accent bg-accent-soft' }
    : weather.humidity >= 30 && weather.humidity <= 80
      ? { label: '보통', color: 'text-warn bg-warn-soft' }
      : { label: '부적합', color: 'text-critical bg-critical-soft' }

  return (
    <div className="mt-4 pt-4 border-t border-line">
      <h4 className="font-bold text-ink text-sm mb-3">기상 정보</h4>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-paper rounded-xl p-2.5 sm:p-3">
          <p className="text-[11px] sm:text-xs text-muted mb-1">기온</p>
          <div className="flex items-end gap-0.5 sm:gap-1 mb-1.5 sm:mb-2">
            <span className="text-lg sm:text-xl font-bold text-ink">{weather.temperature}</span>
            <span className="text-[10px] sm:text-xs text-faint mb-0.5">°C</span>
          </div>
          <span className={cn('inline-block text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full', tempStatus.color)}>
            {tempStatus.label}
          </span>
        </div>
        <div className="bg-paper rounded-xl p-2.5 sm:p-3">
          <p className="text-[11px] sm:text-xs text-muted mb-1">습도</p>
          <div className="flex items-end gap-0.5 sm:gap-1 mb-1.5 sm:mb-2">
            <span className="text-lg sm:text-xl font-bold text-ink">{weather.humidity}</span>
            <span className="text-[10px] sm:text-xs text-faint mb-0.5">%</span>
          </div>
          <span className={cn('inline-block text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full', humStatus.color)}>
            {humStatus.label}
          </span>
        </div>
        <div className="bg-paper rounded-xl p-2.5 sm:p-3">
          <p className="text-[11px] sm:text-xs text-muted mb-1">풍속</p>
          <div className="flex items-end gap-0.5 sm:gap-1 mb-1.5 sm:mb-2">
            <span className="text-lg sm:text-xl font-bold text-ink">{weather.windSpeed}</span>
            <span className="text-[10px] sm:text-xs text-faint mb-0.5">m/s</span>
          </div>
          <span className={cn(
            'inline-block text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full',
            weather.precipitation === 'none' ? 'text-accent bg-accent-soft' : 'text-critical bg-critical-soft'
          )}>
            {weather.precipitation === 'none' ? '맑음' : PRECIP_LABELS[weather.precipitation]}
          </span>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-faint mt-2">기온 12~22°C, 습도 40~60%가 러닝에 최적입니다</p>
    </div>
  )
}
