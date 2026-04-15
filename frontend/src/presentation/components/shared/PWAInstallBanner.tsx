interface PWAInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function PWAInstallBanner({ onInstall, onDismiss }: PWAInstallBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-slide-up">
      <div className="max-w-2xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
        <span className="text-2xl shrink-0">🏃</span>
        <p className="flex-1 text-sm leading-snug">
          <span className="font-semibold">앱으로 설치</span>하면 더 빠르게 러닝 지수를 확인할 수 있어요
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-200 text-xs px-2 py-1 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onInstall}
            className="bg-blue-500 hover:bg-blue-400 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            설치
          </button>
        </div>
      </div>
    </div>
  );
}
