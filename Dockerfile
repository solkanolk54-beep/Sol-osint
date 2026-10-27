# Build & Production Dockerfile for Osiris Live Spatial Intelligence Dashboard
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

CMD ["tsx", "server.ts"]
