import { cn } from '../../../lib/cn'
import type { RunningStatus } from '../../../domain/entities/airQuality.types'

interface BadgeProps {
  label: string
  status: RunningStatus
  className?: string
}

const STATUS_STYLES: Record<RunningStatus, string> = {
  great:   'bg-emerald-100 text-emerald-700 ring-emerald-200',
  good:    'bg-blue-100 text-blue-700 ring-blue-200',
  caution: 'bg-amber-100 text-amber-700 ring-amber-200',
  bad:     'bg-orange-100 text-orange-700 ring-orange-200',
  worst:   'bg-red-100 text-red-700 ring-red-200',
}

export function Badge({ label, status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1',
        STATUS_STYLES[status],
        className
      )}
    >
      {label}
    </span>
  )
}
