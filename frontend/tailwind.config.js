/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        running: {
          great: '#10b981',
          good: '#3b82f6',
          caution: '#f59e0b',
          bad: '#f97316',
          worst: '#ef4444',
        },
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
