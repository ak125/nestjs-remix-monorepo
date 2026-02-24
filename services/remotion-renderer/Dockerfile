# ── AutoMecanik Remotion Renderer ──
# Node 20-bookworm-slim (NOT alpine — Chromium requires glibc)
FROM node:20-bookworm-slim AS base

# System dependencies: FFmpeg + Chromium + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer/Chromium download — we use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# ── Dependencies ──
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# ── Build ──
FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Production ──
FROM base AS production

ENV NODE_ENV=production
ENV RENDER_SERVICE_PORT=3100

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/compositions ./src/compositions
COPY package.json ./

# Create tmp dir for renders with correct permissions
RUN mkdir -p /tmp/renders && chown node:node /tmp/renders

USER node

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1

CMD ["node", "dist/server.js"]
