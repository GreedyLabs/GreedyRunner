FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/package.json
RUN pnpm fetch

FROM deps AS build
COPY frontend frontend
RUN pnpm install --frozen-lockfile --filter @greedy-runner/frontend
RUN --mount=type=secret,id=build_env,target=/repo/frontend/.env \
    pnpm --filter @greedy-runner/frontend run build

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
