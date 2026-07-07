import { STATUS_TONE, TONE_CLASSES } from '../../../lib/runningStatusColors';
import type { RunningIndex } from '../../../domain/entities/airQuality.types';

interface RunningIndexCardProps {
  runningIndex: RunningIndex;
  updatedAt: Date;
}

function hourLabel(date: Date): string {
  const hour = date.getHours();
  const period = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}시`;
}

export function RunningIndexCard({ runningIndex, updatedAt }: RunningIndexCardProps) {
  const tone = STATUS_TONE[runningIndex.status];
  const { text, badgeBg, bar } = TONE_CLASSES[tone];
  const isUnknown = runningIndex.status === 'unknown';

  return (
    <div className="bg-panel border border-line rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-muted">
          러닝 지수 · {hourLabel(updatedAt)}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          실시간
        </span>
      </div>

      <div className="flex items-end gap-3.5 mt-2">
        <span className="font-display text-6xl sm:text-7xl font-extrabold leading-[0.82] tracking-tight">
          {isUnknown ? '—' : runningIndex.score}
        </span>
        <span className={`mb-2.5 inline-block whitespace-nowrap ${badgeBg} ${text} text-[13px] font-bold px-3 py-1.5 rounded-full`}>
          {runningIndex.label}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">{runningIndex.message}</p>

      <div className="mt-4 h-2 rounded-full bg-bar overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-700`}
          style={{ width: isUnknown ? '0%' : `${runningIndex.score}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-faint">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
