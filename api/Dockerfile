FROM node:25-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build && pnpm prune --prod

EXPOSE 3000

CMD ["node", "dist/server.js"]
