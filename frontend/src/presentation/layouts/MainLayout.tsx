interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="font-bold text-gray-800 text-base">GreedyRunner</span>
          </div>
          <span className="text-xs text-gray-400">달리기 최적 타이밍</span>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {children}
      </main>

      {/* 푸터 */}
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-400">
          대기질 데이터는 Mock 데이터입니다 · 실제 데이터는 준비 중
        </p>
      </footer>
    </div>
  )
}
