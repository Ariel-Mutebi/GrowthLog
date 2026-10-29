FROM node:26-alpine AS base
RUN npm install -g pnpm@12.16.1
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @growthlog/env build
RUN DATABASE_URL=postgresql://user:pass@localhost:5432/db pnpm --filter @growthlog/db generate
RUN pnpm --filter @growthlog/db build
RUN pnpm --filter @growthlog/jobs build
RUN pnpm --filter @growthlog/api build
RUN pnpm deploy --filter @growthlog/api --prod /out/api

FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=builder /out/api .
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
