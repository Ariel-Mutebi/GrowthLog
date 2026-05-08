FROM node:25-alpine
WORKDIR /app

# Dependencies layer — only rebuilds when package.json changes
COPY package*.json ./
RUN npm ci --omit=dev

# Source layer
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
