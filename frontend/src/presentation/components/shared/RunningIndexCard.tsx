import { STATUS_TONE, TONE_CLASSES } from '../../../lib/runningStatusColors';
import type { RunningIndex } from '../../../domain/entities/airQuality.types';

interface RunningIndexCardProps {
  runningIndex: RunningIndex;
  updatedAt: Date;
}

/**
 * 기준 시각 라벨 — 항상 KST로 표시한다.
 *
 * `updatedAt`은 백엔드가 에어코리아 dataTime(KST)에 고정한 값인데, `getHours()`는 단말
 * 타임존으로 렌더한다. 해외에서 접속하면 카드가 실제 측정 시각과 다른 시각을 주장했다.
 * 국내 대기질 서비스이므로 표시 기준은 KST로 못 박는다.
 */
function hourLabel(date: Date): string {
  // formatToParts로 시(hour) 부분만 꺼낸다.
  // format()의 문자열을 Number()에 넣으면 안 된다 — 'ko-KR'은 "14시"처럼 접미사를 붙이므로
  // Number("14시")가 NaN이 되어 "오후 NaN시"가 표시된다.
  const hourPart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;
  // hour12:false는 자정을 '24'로 내는 구현이 있어 24를 0으로 정규화한다.
  const kstHour = (Number(hourPart ?? '0') || 0) % 24;
  const period = kstHour < 12 ? '오전' : '오후';
  const hour12 = kstHour % 12 === 0 ? 12 : kstHour % 12;
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
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
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
