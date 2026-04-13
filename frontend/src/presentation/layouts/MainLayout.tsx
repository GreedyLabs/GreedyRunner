import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface VisitorStats {
  today: number;
  total: number;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [stats, setStats] = useState<VisitorStats | null>(null);

  useEffect(() => {
    fetch('/api/v1/stats/visitors')
      .then((res) => res.json())
      .then((data: VisitorStats) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-lg sm:text-xl">🏃</span>
            <span className="font-bold text-gray-800 text-sm sm:text-base">GreedyRunner</span>
          </Link>
          <Link
            to={isHome ? '/outfit' : '/'}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] sm:text-xs font-medium hover:bg-blue-100 active:scale-95 transition-all"
          >
            {isHome ? (
              <>
                <span>👕</span>
                <span>옷차림 추천</span>
              </>
            ) : (
              <>
                <span>🏃</span>
                <span>러닝 지수</span>
              </>
            )}
            <svg
              className="w-3 h-3 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isHome ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
              />
            </svg>
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {children}
      </main>

      {/* 푸터 */}
      <footer className="max-w-2xl mx-auto px-3 sm:px-4 py-6 text-center space-y-2">
        {stats && (
          <div className="flex items-center justify-center gap-3 text-[10px] sm:text-xs text-gray-400">
            <span>
              Today{' '}
              <span className="font-semibold text-gray-500">{stats.today.toLocaleString()}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span>
              Total{' '}
              <span className="font-semibold text-gray-500">{stats.total.toLocaleString()}</span>
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-gray-400">
          <span>Copyright 2026. GreedyLabs Co.</span>
          <span className="text-gray-300">|</span>
          <a
            href="mailto:hailey@greedylabs.kr?subject=[GreedyRunner] 문의"
            className="text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            문의하기
          </a>
        </div>
      </footer>
    </div>
  );
}
