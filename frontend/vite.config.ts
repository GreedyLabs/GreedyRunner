import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sitemap from 'vite-plugin-sitemap';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sitemap({
      hostname: 'https://run.greedylabs.kr',
      dynamicRoutes: ['/outfit'],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      // Service Worker가 캐시할 앱 껍데기 파일 목록 (자동 생성)
      includeAssets: ['ico_b1.png', 'apple-touch-icon.png'],
      manifest: {
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
  },
  preview: {
    allowedHosts: ['localhost', 'filial-janett-intromittent.ngrok-free.dev'],
  },
});
