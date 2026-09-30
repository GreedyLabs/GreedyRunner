import { useEffect, useState } from 'react';

const VISIT_COUNT_KEY = 'greedyrunner_visit_count';
const BANNER_DISMISSED_AT_KEY = 'greedyrunner_banner_dismissed_at';
const INSTALL_THRESHOLD = 3;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7일

// Android Chrome이 홈화면 추가 배너를 띄우기 전에 발생시키는 이벤트
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * localStorage 접근 래퍼.
 *
 * 시크릿 창·사이트 데이터 차단 브라우저에서는 getItem/setItem 자체가 throw한다.
 * 이 이펙트는 최상위 레이아웃에서 실행되므로, 예전에는 그 throw가 React 트리 전체를
 * 언마운트시켜 화면이 통째로 비었다 — PWA 배너 하나 때문에 앱이 죽는 셈이었다.
 */
function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 배너 노출 빈도만 달라지게 할 뿐이므로 무시한다.
  }
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 이미 설치된 경우 (standalone 모드로 실행 중)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // 닫은 지 7일이 지나지 않은 경우
    const dismissedAt = readNumber(BANNER_DISMISSED_AT_KEY);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
      return;
    }

    // 방문 횟수 카운트
    const newCount = readNumber(VISIT_COUNT_KEY) + 1;
    writeString(VISIT_COUNT_KEY, String(newCount));

    // Android: beforeinstallprompt 이벤트를 가로채서 직접 제어
    // (브라우저 기본 배너 대신 우리 배너를 보여주기 위해)
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      if (newCount >= INSTALL_THRESHOLD) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // 설치 완료 감지
    const handleInstalled = () => {
      setShowBanner(false);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      // 예전에는 appinstalled 리스너를 익명 함수로 달아 해제하지 못했다.
      // 이 훅이 다시 마운트될 때마다 리스너가 쌓이고, 언마운트된 컴포넌트의
      // setState가 호출됐다.
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    writeString(BANNER_DISMISSED_AT_KEY, String(Date.now()));
  };

  return { showBanner, isInstalled, handleInstall, handleDismiss };
}
