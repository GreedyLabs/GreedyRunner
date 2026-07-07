import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, BarChart3, Backpack, Lightbulb, MapPin, Moon, Sun } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useTheme } from '../../application/hooks/useTheme';
import { PWAInstallBanner } from '../components/shared/PWAInstallBanner';
import { cn } from '../../lib/cn';

interface MainLayoutProps {
  children: React.ReactNode;
  regionName?: string | null;
}

interface VisitorStats {
  today: number;
  total: number;
}

const NAV_ITEMS = [
  { to: '/', label: '오늘', icon: Activity, end: true },
  { to: '/hours', label: '시간대', icon: BarChart3, end: false },
  { to: '/gear', label: '준비물', icon: Backpack, end: false },
  // 팁 탭바는 전체 팁 목록(/tips)으로 이동한다. 오늘 조건 팁 상세(/tip)와
  // 개별 팁 상세(/tips/:id)도 "팁" 탭에 속하므로 함께 활성화한다.
  { to: '/tips', label: '팁', icon: Lightbulb, end: false, activeWhen: (pathname: string) => pathname.startsWith('/tip') },
];

export function MainLayout({ children, regionName }: MainLayoutProps) {
  const { mode, toggle } = useTheme();
  const { pathname } = useLocation();
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const { showBanner, handleInstall, handleDismiss } = usePWAInstall();

  // 개발 중 배너 미리보기: URL에 ?pwa=1 추가하면 강제 표시
  // (프리렌더 시에는 window가 없으므로 건너뜀)
  const searchParams = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search
  );
  const forceShowBanner = searchParams.get('pwa') === '1';
  const isBannerVisible = showBanner || forceShowBanner;

  useEffect(() => {
    fetch('/api/v1/stats/visitors')
      .then((res) => res.json())
      .then((data: VisitorStats) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* 상단 바 */}
      <header className="bg-paper border-b border-line sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold">
            <MapPin className="w-4 h-4 text-accent" />
            <span>{regionName ?? 'GreedyRunner'}</span>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label="테마 전환"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-panel border border-line text-ink hover:opacity-80 active:scale-95 transition"
          >
            {mode === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {children}
      </main>

      {isBannerVisible && (
        <PWAInstallBanner onInstall={handleInstall} onDismiss={handleDismiss} />
      )}

      {/* 하단 탭 내비게이션 */}
      <nav className="sticky bottom-0 z-50 bg-paper border-t border-line">
        <div className="max-w-2xl mx-auto px-2 flex justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, activeWhen }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 px-4 text-[10px]',
                  isActive || activeWhen?.(pathname) ? 'text-accent font-bold' : 'text-faint font-normal'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 푸터 */}
      <footer className="max-w-2xl mx-auto px-3 sm:px-4 py-6 text-center space-y-2">
        {stats && (
          <div className="flex items-center justify-center gap-3 text-[10px] sm:text-xs text-muted">
            <span>
              Today <span className="font-semibold">{stats.today.toLocaleString()}</span>
            </span>
            <span className="text-line">|</span>
            <span>
              Total <span className="font-semibold">{stats.total.toLocaleString()}</span>
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-muted">
          <span>Copyright 2026. GreedyLabs Co.</span>
          <span className="text-line">|</span>
          <a
            href="mailto:hailey@greedylabs.kr?subject=[GreedyRunner] 문의"
            className="underline underline-offset-2 hover:text-ink transition-colors"
          >
            개발자에게 피드백
          </a>
        </div>
      </footer>
    </div>
  );
}
