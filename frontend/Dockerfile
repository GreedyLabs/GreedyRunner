# ── Build stage ──
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 루트 워크스페이스 설정 + lock 파일 복사 (레이어 캐시 최적화)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

COPY frontend/ ./frontend/

ARG VITE_UMAMI_URL
ARG VITE_UMAMI_WEBSITE_ID

# nginx가 /api를 프록시하므로 API base를 빈 문자열로 설정 (상대 경로 사용)
ENV VITE_API_BASE_URL=""
RUN pnpm --filter @greedy-runner/frontend run build

# ── Production stage ──
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
