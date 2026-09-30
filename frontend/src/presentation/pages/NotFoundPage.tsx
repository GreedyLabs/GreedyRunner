import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'

export function NotFoundPage() {
  return (
    <div className="animate-slide-up">
      <Card>
        <div className="text-center py-8 space-y-4">
          <div className="text-4xl">🤔</div>
          {/* 테마 토큰만 쓴다. gray/blue를 하드코딩하면 다크 모드에서 제목이 배경에 묻힌다. */}
          <h1 className="text-lg sm:text-xl font-bold text-ink">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-muted leading-relaxed">
            주소가 잘못되었거나 삭제된 페이지입니다.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-4 py-2 rounded-full bg-accent-strong text-on-accent text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity"
            >
              🏃 러닝 지수 홈
            </Link>
            <Link
              to="/tips"
              className="px-4 py-2 rounded-full bg-panel border border-line text-ink text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity"
            >
              러닝 팁 보기
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
