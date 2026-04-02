import { Card } from '../ui/Card'
import type { AirQualityMetrics } from '../../../domain/entities/airQuality.types'
import { cn } from '../../../lib/cn'

interface AirQualityDetailsProps {
  metrics: AirQualityMetrics
}

interface MetricConfig {
  label: string
  value: number
  unit: string
  thresholds: { max: number; label: string; color: string }[]
}

export function AirQualityDetails({ metrics }: AirQualityDetailsProps) {
  const metricList: MetricConfig[] = [
    {
      label: '초미세먼지 (PM2.5)',
      value: metrics.pm25,
      unit: 'μg/m³',
      thresholds: [
        { max: 15,  label: '좋음',     color: 'text-emerald-600 bg-emerald-50' },
        { max: 35,  label: '보통',     color: 'text-blue-600 bg-blue-50' },
        { max: 75,  label: '나쁨',     color: 'text-amber-600 bg-amber-50' },
        { max: Infinity, label: '매우나쁨', color: 'text-red-600 bg-red-50' },
      ],
    },
    {
      label: '미세먼지 (PM10)',
      value: metrics.pm10,
      unit: 'μg/m³',
      thresholds: [
        { max: 30,  label: '좋음',     color: 'text-emerald-600 bg-emerald-50' },
        { max: 80,  label: '보통',     color: 'text-blue-600 bg-blue-50' },
        { max: 150, label: '나쁨',     color: 'text-amber-600 bg-amber-50' },
        { max: Infinity, label: '매우나쁨', color: 'text-red-600 bg-red-50' },
      ],
    },
    {
      label: '오존 (O₃)',
      value: Math.round(metrics.o3 * 1000),
      unit: 'ppb',
      thresholds: [
        { max: 30,  label: '좋음',     color: 'text-emerald-600 bg-emerald-50' },
        { max: 60,  label: '보통',     color: 'text-blue-600 bg-blue-50' },
        { max: 90,  label: '나쁨',     color: 'text-amber-600 bg-amber-50' },
        { max: Infinity, label: '매우나쁨', color: 'text-red-600 bg-red-50' },
      ],
    },
    {
      label: '이산화질소 (NO₂)',
      value: Math.round(metrics.no2 * 1000),
      unit: 'ppb',
      thresholds: [
        { max: 10,  label: '좋음',     color: 'text-emerald-600 bg-emerald-50' },
        { max: 30,  label: '보통',     color: 'text-blue-600 bg-blue-50' },
        { max: 50,  label: '나쁨',     color: 'text-amber-600 bg-amber-50' },
        { max: Infinity, label: '매우나쁨', color: 'text-red-600 bg-red-50' },
      ],
    },
  ]

  return (
    <Card className="animate-slide-up">
      <h3 className="font-bold text-gray-800 text-base mb-4">대기질 상세</h3>
      <div className="grid grid-cols-2 gap-3">
        {metricList.map(metric => {
          const threshold = metric.thresholds.find(t => metric.value <= t.max)!
          return (
            <MetricItem key={metric.label} metric={metric} threshold={threshold} />
          )
        })}
      </div>
    </Card>
  )
}

interface MetricItemProps {
  metric: MetricConfig
  threshold: { label: string; color: string }
}

function MetricItem({ metric, threshold }: MetricItemProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1 truncate">{metric.label}</p>
      <div className="flex items-end gap-1.5 mb-2">
        <span className="text-xl font-bold text-gray-800">{metric.value}</span>
        <span className="text-xs text-gray-400 mb-0.5">{metric.unit}</span>
      </div>
      <span
        className={cn(
          'inline-block text-xs font-semibold px-2 py-0.5 rounded-full',
          threshold.color
        )}
      >
        {threshold.label}
      </span>
    </div>
  )
}
