FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/package.json
RUN pnpm fetch

FROM deps AS build
COPY backend backend
RUN pnpm install --frozen-lockfile --filter @greedy-runner/backend
RUN pnpm --filter @greedy-runner/backend run build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/package.json
RUN pnpm install --prod --frozen-lockfile --filter @greedy-runner/backend

COPY --from=build /repo/backend/dist backend/dist

EXPOSE 8000
CMD ["node", "/app/backend/dist/main.js"]
