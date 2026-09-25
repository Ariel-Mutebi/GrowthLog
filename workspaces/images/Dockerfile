FROM node:25-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @growthlog/db generate
RUN pnpm --filter @growthlog/db build
RUN pnpm --filter @growthlog/env build
RUN pnpm --filter @growthlog/images build
RUN pnpm deploy --filter @growthlog/images --prod /out/images

FROM node:25-alpine AS runtime
WORKDIR /app
COPY --from=builder /out/images .
EXPOSE 3000
CMD ["node", "dist/server.js"]
