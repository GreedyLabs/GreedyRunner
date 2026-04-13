# ── Build stage ──
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 루트 워크스페이스 설정 + lock 파일 복사 (레이어 캐시 최적화)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

COPY backend/ ./backend/
RUN pnpm --filter @greedy-runner/backend run build

# pnpm deploy: 프로덕션 의존성만 추출
RUN pnpm --filter @greedy-runner/backend deploy --legacy /deploy

# ── Production stage ──
FROM node:20-alpine
WORKDIR /app

COPY --from=build /deploy .
COPY --from=build /app/backend/dist ./dist

EXPOSE 8000
CMD ["node", "dist/main.js"]
