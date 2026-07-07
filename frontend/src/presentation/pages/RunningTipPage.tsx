import type { ReactNode } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RUNNING_TIPS } from '../../lib/runningTips'
import { Card } from '../components/ui/Card'
import { NotFoundPage } from './NotFoundPage'

export function RunningTipPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const backUrl: string = (location.state as { backUrl?: string } | null)?.backUrl ?? '/tips'
  const tip = RUNNING_TIPS.find(t => t.id === id)

  if (!tip) return <NotFoundPage />

  const relatedTips = RUNNING_TIPS.filter(t => t.category === tip.category && t.id !== tip.id).slice(0, 3)

  // 단락 구분(\n\n), 굵게(**text**), 표(| 로 시작) 처리
  const paragraphs = tip.detail.split('\n\n').map((block, i) => {
    // 표 블록
    if (block.trim().startsWith('|')) {
      const rows = block.trim().split('\n').filter(l => !l.match(/^\|[-| ]+\|$/))
      return (
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').filter(c => c.trim() !== '')
                const Tag = ri === 0 ? 'th' : 'td'
                return (
                  <tr key={ri} className={ri === 0 ? 'bg-accent-soft' : ri % 2 === 0 ? '' : 'bg-paper/50'}>
                    {cells.map((cell, ci) => (
                      <Tag
                        key={ci}
                        className={`border border-line px-3 py-1.5 text-left font-normal ${ri === 0 ? 'text-accent font-semibold' : 'text-muted'}`}
                      >
                        {cell.trim()}
                      </Tag>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    // 인라인 **굵게** 및 [링크](url) 처리
    const renderInline = (text: string) => {
      const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/)
      return parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pi} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
        }

        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
          return (
            <a
              key={pi}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline underline-offset-2 decoration-accent/30 hover:opacity-80"
            >
              {linkMatch[1]}
            </a>
          )
        }

        return part
      })
    }

    // 줄 단위 처리 — 목록은 <ul>로 묶고, **단독 굵은 줄**은 섹션 제목이므로 <h2>로 렌더
    const lines = block.split('\n')
    const rendered: ReactNode[] = []
    let bullets: string[] = []
    const flushBullets = (key: string) => {
      if (bullets.length === 0) return
      rendered.push(
        <ul key={key} className="space-y-1 list-none">
          {bullets.map((item, bi) => (
            <li key={bi} className="flex gap-2 text-xs sm:text-sm text-muted leading-relaxed">
              <span className="text-faint shrink-0 mt-0.5" aria-hidden="true">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      bullets = []
    }
    lines.forEach((line, li) => {
      if (line.startsWith('- ')) {
        bullets.push(line.slice(2))
        return
      }
      flushBullets(`ul-${li}`)
      if (line.startsWith('**') && line.endsWith('**')) {
        rendered.push(
          <h2 key={li} className="font-semibold text-ink text-sm sm:text-base mt-3">
            {line.slice(2, -2)}
          </h2>
        )
        return
      }
      rendered.push(
        <p key={li} className="text-xs sm:text-sm text-muted leading-relaxed">
          {renderInline(line)}
        </p>
      )
    })
    flushBullets('ul-end')
    return (
      <div key={i} className="space-y-1">
        {rendered}
      </div>
    )
  })

  return (
    <div className="space-y-3 sm:space-y-4 animate-slide-up">
      {/* 뒤로가기 */}
      <Link
        to={backUrl}
        className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink transition-colors"
      >
        <ChevronLeft className="w-[15px] h-[15px]" />
        러닝 팁 목록
      </Link>

      {/* 본문 카드 */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent">
            {tip.category}
          </span>
          <span className="text-[10px] sm:text-xs text-muted">러닝 팁</span>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-ink mb-4 leading-snug">
          {tip.emoji} {tip.title}
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6 pb-4 border-b border-line">
          {tip.summary}
        </p>
        <div className="space-y-4">
          {paragraphs}
        </div>
        <p className="mt-6 pt-3 border-t border-line text-[10px] sm:text-xs text-faint">
          <time dateTime={tip.updatedAt ?? tip.publishedAt}>
            {(tip.updatedAt ?? tip.publishedAt).split('-').join('. ')}.
          </time>{' '}
          · GreedyLabs
        </p>
      </Card>

      {/* 같은 카테고리의 관련 팁 — 내부 링크 강화 */}
      {relatedTips.length > 0 && (
        <Card>
          <h2 className="text-sm sm:text-base font-semibold text-ink mb-3">
            관련 {tip.category} 팁
          </h2>
          <ul className="space-y-2">
            {relatedTips.map(related => (
              <li key={related.id}>
                <Link
                  to={`/tips/${related.id}`}
                  className="flex items-start gap-2 text-xs sm:text-sm text-muted hover:text-accent transition-colors"
                >
                  <span aria-hidden="true">{related.emoji}</span>
                  <span className="underline underline-offset-2 decoration-line">
                    {related.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link
        to="/tips"
        className="inline-flex items-center gap-1 text-xs text-accent hover:opacity-80 transition-opacity px-1"
      >
        모든 팁 보기
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
