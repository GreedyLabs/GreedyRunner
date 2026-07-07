export function ampmHour(hour: number): { period: '오전' | '오후'; hour12: number } {
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return { period, hour12 }
}

export function hourLabel(hour: number, isNextDay?: boolean): string {
  const { period, hour12 } = ampmHour(hour)
  return `${isNextDay ? '내일 ' : ''}${period} ${hour12}시`
}

interface RankedHour {
  hour: number
  isNextDay: boolean
}

/** `best` is already ranked score-descending by the backend (bestRunningHours). */
export function bestHourRangeLabel(best: RankedHour[]): string {
  if (best.length === 0) return ''
  const [top, second] = best

  if (second && !top.isNextDay && !second.isNextDay && Math.abs(second.hour - top.hour) === 1) {
    const lo = Math.min(top.hour, second.hour)
    const hi = Math.max(top.hour, second.hour)
    return `${ampmHour(lo).period} ${ampmHour(lo).hour12}-${ampmHour(hi).hour12}시 추천`
  }
  return `${hourLabel(top.hour, top.isNextDay)} 추천`
}
