import { useEffect, useState } from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface VisitorStats {
  today: number;
  total: number;
}

export function MainLayout({ children }: MainLayoutProps) {
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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-lg sm:text-xl">🏃</span>
            <span className="font-bold text-gray-800 text-sm sm:text-base">GreedyRunner</span>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400">달리기 최적 타이밍</span>
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
        <p className="text-[10px] sm:text-xs text-gray-400">
          Copyright 2026. GreedyLabs Co. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
