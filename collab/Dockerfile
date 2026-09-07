# Build with repo root as context
FROM node:25-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @growthlog/db generate
RUN pnpm --filter @growthlog/collab build
RUN pnpm deploy --filter @growthlog/collab --prod /out/collab

FROM node:25-alpine AS runtime
WORKDIR /app
COPY --from=builder /out/collab .
EXPOSE 1234
CMD ["node", "dist/server.js"]
