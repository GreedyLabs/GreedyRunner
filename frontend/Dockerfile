# ── Build stage ──
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_UMAMI_URL
ARG VITE_UMAMI_WEBSITE_ID

# nginx가 /api를 프록시하므로 API base를 빈 문자열로 설정 (상대 경로 사용)
ENV VITE_API_BASE_URL=""
RUN pnpm run build

# ── Production stage ──
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
