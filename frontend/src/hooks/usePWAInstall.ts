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
    const dismissedAt = Number(localStorage.getItem(BANNER_DISMISSED_AT_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
      return;
    }

    // 방문 횟수 카운트
    const prevCount = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? 0);
    const newCount = prevCount + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(newCount));

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
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
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
    localStorage.setItem(BANNER_DISMISSED_AT_KEY, String(Date.now()));
  };

  return { showBanner, isInstalled, handleInstall, handleDismiss };
}
