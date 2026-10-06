// vitest/config의 defineConfig를 쓴다 — vite의 것은 `test` 옵션을 타입에 갖고 있지 않아
// 타입 검사에서 "'test' does not exist in type 'UserConfigExport'"로 떨어진다.
import { defineConfig } from 'vitest/config';
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
        // 모든 유효 라우트는 빌드 시 dist/<route>/index.html로 프리렌더되고 precache에 담긴다.
        // 기본값(navigateFallback: 'index.html')은 **모든** 네비게이션을 루트 index.html로
        // 응답하는 NavigationRoute를 만들어, 프리렌더한 라우트별 HTML을 무의미하게 만들고
        // /docs·/health를 앱 껍데기로 가로채고 진짜 404(soft-404 방지)도 무력화한다.
        // → 폴백을 끄고 precache된 라우트별 HTML이 그대로 쓰이게 한다.
        navigateFallback: undefined,
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/, /^\/health/],
        // Network First: 항상 최신 러닝 지수를 가져오되, 오프라인이면 캐시 사용
        runtimeCaching: [
          {
            // 라우트 HTML. api/docs/health를 제외한 **확장자 없는 경로** = 네비게이션이다.
            // (generateSW 모드에서는 urlPattern에 함수를 쓸 수 없어 request.mode로 판별할 수 없다)
            //
            // navigateFallback을 끈 자리를 이 규칙이 메운다. PWA 빌드는 프리렌더보다 먼저
            // 돌기 때문에 dist/<route>/index.html 100개가 precache 매니페스트에 들어가지
            // 못한다(precache 9개). 그래서 예전에는 오프라인 네비게이션이 전적으로
            // navigateFallback에 의존했고, 그 대가로 온라인 재방문자도 모든 라우트에서
            // 루트 index.html을 받아 프리렌더한 라우트별 본문을 잃었다.
            // NetworkFirst면 온라인에서는 항상 그 라우트의 진짜 HTML을, 오프라인에서는
            // 직전 방문 때 캐시된 HTML을 쓴다.
            urlPattern: /^https?:\/\/[^/]+\/(?!api\/|docs|health)[^.?#]*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              // 404(진짜 404 설계)와 5xx를 캐시에 남기지 않는다.
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // 호스트를 박아 두면 로컬 개발·프리뷰·별도 API 호스트에서 이 규칙이 아예
            // 적용되지 않아, 환경마다 캐시 동작이 달랐다. 경로로 매칭한다.
            urlPattern: /\/api\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              // 네트워크가 멈췄을 때 캐시로 넘어가는 기준. 없으면 NetworkFirst가
              // 네트워크 응답을 무한히 기다려 오프라인 폴백이 영구히 발동하지 않는다
              // — 백엔드가 매달리면 캐시가 있어도 스피너만 돌았다.
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5분
              },
              // 오류 응답을 캐시에 남기지 않는다. 남기면 백엔드가 복구된 뒤에도
              // 특정 사용자만 최대 5분 동안 실패 응답을 계속 받는다.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // 훅 테스트가 DOM을 필요로 하므로 jsdom을 기본 환경으로 둔다.
    // 파일 단위 `@vitest-environment` docblock보다 이 설정이 확실하다 — docblock은
    // 조용히 무시될 수 있고, 그러면 테스트가 "localStorage가 undefined"로만 실패해
    // 원인이 환경 설정인지 코드인지 구분되지 않는다.
    environment: 'jsdom',
    // RTL은 테스트 프레임워크의 afterEach가 전역으로 노출돼 있을 때만 자동 정리한다.
    // 이 저장소는 vitest 심볼을 명시적으로 import하므로 setup에서 직접 등록한다.
    setupFiles: ['./src/test/setup.ts'],
  },
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
