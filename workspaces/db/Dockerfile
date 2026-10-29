FROM node:26-alpine
RUN npm install -g pnpm@12.16.1
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@growthlog/db..."
RUN pnpm --filter @growthlog/env build
CMD ["pnpm", "--filter", "@growthlog/db", "exec", "prisma", "migrate", "deploy"]
