FROM node:26-alpine AS base
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @growthlog/db generate
RUN pnpm --filter @growthlog/db build
RUN pnpm --filter @growthlog/env build
RUN pnpm --filter @growthlog/docs build
RUN pnpm deploy --filter @growthlog/docs --prod /out/docs

FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=builder /out/docs .
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
