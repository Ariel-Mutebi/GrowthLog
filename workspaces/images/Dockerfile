FROM node:26-alpine AS base
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @growthlog/db generate
RUN pnpm --filter @growthlog/db build
RUN pnpm --filter @growthlog/env build
RUN pnpm --filter @growthlog/jobs build
RUN pnpm --filter @growthlog/images build
RUN pnpm deploy --filter @growthlog/images --prod /out/images

FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=builder /out/images .
USER node
EXPOSE 3002
CMD ["node", "dist/server.js"]
