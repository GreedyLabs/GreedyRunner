interface PWAInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function PWAInstallBanner({ onInstall, onDismiss }: PWAInstallBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-slide-up">
      {/*
        배너는 라이트·다크 양쪽에서 같은 어두운 오버레이로 띄운다(의도된 고정 색).
        다만 닫기/설치 버튼의 색은 하드코딩 팔레트 대신 대비를 확보한 값으로 고정한다.
      */}
      <div className="max-w-2xl mx-auto bg-[#1b1c20] text-[#f5f5f2] rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
        <span className="text-2xl shrink-0">🏃</span>
        <p className="flex-1 text-sm leading-snug">
          <span className="font-semibold">앱으로 설치</span>하면 더 빠르게 러닝 지수를 확인할 수 있어요
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[#c3c4c8] hover:text-[#f5f5f2] text-xs px-2 py-1 transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onInstall}
            className="bg-[#0b7d55] hover:opacity-90 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            설치
          </button>
        </div>
      </div>
    </div>
  );
}
