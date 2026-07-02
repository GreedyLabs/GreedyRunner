import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// sitemap.xml은 scripts/prerender.mjs가 실제 콘텐츠 날짜(lastmod) 기반으로 생성한다.
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service Worker가 캐시할 앱 껍데기 파일 목록 (자동 생성)
      includeAssets: ['ico_b1.png', 'apple-touch-icon.png'],
      manifest: {
        // id: 앱의 고유 식별자. 최신 PWA 스펙 필수 필드.
        // 한번 정하면 바꾸지 않아야 함 (바꾸면 기존 설치 앱과 별개로 인식됨)
        id: 'kr.greedylabs.run',
        name: '달려도 되나요? — GreedyRunner',
        short_name: 'GreedyRunner',
        description: '지금 달리기 좋은 날씨인지 확인하세요. 러닝 지수, 대기질, 최적 시간을 알려드립니다.',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone', // 브라우저 주소창 없이 앱처럼 표시
        start_url: '/',
        scope: '/',
        lang: 'ko',
        orientation: 'portrait',
        categories: ['health', 'sports'],
        screenshots: [
          {
            // 설치 다이얼로그에 표시되는 앱 미리보기 이미지
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide',
            label: '러닝 지수와 대기질을 한눈에',
          },
        ],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // maskable: 안드로이드에서 아이콘 모양을 원형/둥근사각형 등으로 잘라낼 때 사용
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Network First: 항상 최신 러닝 지수를 가져오되, 오프라인이면 캐시 사용
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/run\.greedylabs\.kr\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5분
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ['localhost', 'filial-janett-intromittent.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/docs': 'http://localhost:8000',
    },
  },
  preview: {
    allowedHosts: ['localhost', 'filial-janett-intromittent.ngrok-free.dev'],
  },
});
