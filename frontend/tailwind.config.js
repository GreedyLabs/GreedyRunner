/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // running.* 5색 스케일(great/good/caution/bad/worst)은 제거했다.
        // runningStatusColors.ts가 "제거됨"이라고 선언한 팔레트인데 여기에 남아 있어,
        // 색을 바꾸는 사람이 이 토큰과 미사용 Badge 컴포넌트를 빠뜨리게 만들었다.
        // 상태 색은 STATUS_TONE → TONE_CLASSES(accent/warn/critical/muted) 한 경로만 쓴다.
        //
        // Neutral+emerald surface tokens for the redesigned connected flow
        // (Home/Hours/Gear/Tip). Backed by CSS variables in index.css so
        // light/dark swap automatically without needing dark: on every usage.
        paper: 'var(--paper)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        // 흰(라이트)·검은(다크) 글자를 얹는 accent 표면 전용. bg-accent에 text-white를
        // 올리면 라이트 3.47:1 / 다크 1.90:1로 AA 미달이다.
        'accent-strong': 'var(--accent-strong)',
        'on-accent': 'var(--on-accent)',
        'accent-soft': 'var(--accent-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        critical: 'var(--critical)',
        'critical-soft': 'var(--critical-soft)',
        bar: 'var(--bar)',
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
