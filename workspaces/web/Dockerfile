FROM node:26-alpine AS base
RUN npm install -g pnpm@12.16.1
WORKDIR /repo

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile

# astro:env client vars are inlined at build time, so pass all of them as build args
ARG PUBLIC_API_URL
ARG PUBLIC_IMAGES_URL
ARG PUBLIC_DOCS_URL
ARG PUBLIC_STORAGE_ENDPOINT
ARG PUBLIC_AVATAR_BUCKET
ARG PUBLIC_IMAGE_BUCKET
ARG PUBLIC_MAX_AVATAR_SIZE_BYTES
ARG PUBLIC_MAX_IMAGE_SIZE_BYTES
ENV PUBLIC_API_URL=$PUBLIC_API_URL \
  PUBLIC_IMAGES_URL=$PUBLIC_IMAGES_URL \
  PUBLIC_DOCS_URL=$PUBLIC_DOCS_URL \
  PUBLIC_STORAGE_ENDPOINT=$PUBLIC_STORAGE_ENDPOINT \
  PUBLIC_AVATAR_BUCKET=$PUBLIC_AVATAR_BUCKET \
  PUBLIC_IMAGE_BUCKET=$PUBLIC_IMAGE_BUCKET \
  PUBLIC_MAX_AVATAR_SIZE_BYTES=$PUBLIC_MAX_AVATAR_SIZE_BYTES \
  PUBLIC_MAX_IMAGE_SIZE_BYTES=$PUBLIC_MAX_IMAGE_SIZE_BYTES

RUN pnpm --filter @growthlog/env build
RUN pnpm --filter @growthlog/web build
RUN pnpm deploy --filter @growthlog/web --prod /out/web

FROM node:26-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000
WORKDIR /app
COPY --from=builder /out/web .
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:4321/health || exit 1
CMD ["node", "dist/server/entry.mjs"]
