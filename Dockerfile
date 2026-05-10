# Stage 1: build frontend + compile native modules
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Reinstall prod-only deps (clean, no devDependencies)
RUN npm ci --omit=dev

# Stage 2: lightweight runtime image
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server.js package.json ./

EXPOSE 3000

LABEL net.unraid.docker.webui="http://[IP]:[PORT:3000]/"
LABEL net.unraid.docker.icon="https://raw.githubusercontent.com/ajwilson79/state-park-stays/main/public/logo.png"

CMD ["node", "server.js"]
