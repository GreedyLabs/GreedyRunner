import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import sitemap from 'vite-plugin-sitemap';

/** index.html 내 %VITE_*% 플레이스홀더를 환경변수로 치환 */
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env',
    transformIndexHtml(html, ctx) {
      const env = ctx.server?.config.env ?? process.env;
      return html.replace(/%(\w+)%/g, (_, key) => (env[key] as string) ?? '');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    htmlEnvPlugin(),
    sitemap({ hostname: 'https://run.greedylabs.kr' }),
  ],
  server: {
    allowedHosts: ['localhost', 'filial-janett-intromittent.ngrok-free.dev'],
  },
});
