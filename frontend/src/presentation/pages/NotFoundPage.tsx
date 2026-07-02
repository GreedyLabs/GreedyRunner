import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'

export function NotFoundPage() {
  return (
    <div className="animate-slide-up">
      <Card>
        <div className="text-center py-8 space-y-4">
          <div className="text-4xl">🤔</div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            주소가 잘못되었거나 삭제된 페이지입니다.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-4 py-2 rounded-full bg-blue-500 text-white text-xs sm:text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              🏃 러닝 지수 홈
            </Link>
            <Link
              to="/tips"
              className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-xs sm:text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              러닝 팁 보기
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
