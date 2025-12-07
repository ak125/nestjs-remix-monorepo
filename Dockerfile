FROM node:20-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat && apk update
WORKDIR /app
RUN npm install --global turbo
COPY --chown=node:node . .

# Prune pour backend ET frontend (le backend sert le frontend en SSR)
RUN turbo prune @fafa/backend @fafa/frontend --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat && apk update
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --chown=node:node --from=builder /app/out/json/ .
COPY --chown=node:node --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm install

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# Uncomment and use build args to enable remote caching
ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM

ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN
ENV TZ=Europe/Paris
ENV NODE_ENV="production"
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build monorepo (backend + frontend)
RUN npm run build

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix-api
USER remix-api

# ENV TZ=Europe/Paris
# ENV NODE_ENV="production"

COPY --chown=remix-api:nodejs --from=installer /app/backend/package.json ./backend/package.json
COPY --chown=remix-api:nodejs --from=installer /app/backend/dist ./backend/dist
COPY --chown=remix-api:nodejs --from=installer /app/backend/node_modules ./backend/node_modules
COPY --chown=remix-api:nodejs --from=installer /app/node_modules ./node_modules
COPY --chown=remix-api:nodejs --from=installer /app/node_modules/@fafa/frontend ./node_modules/@fafa/frontend
COPY --chown=remix-api:nodejs --from=installer /app/node_modules/@fafa/typescript-config ./node_modules/@fafa/typescript-config
COPY --chown=remix-api:nodejs --from=installer /app/node_modules/@fafa/eslint-config ./node_modules/@fafa/eslint-config

# Copier le frontend build (Remix SSR)
COPY --chown=remix-api:nodejs --from=installer /app/frontend/build ./frontend/build
COPY --chown=remix-api:nodejs --from=installer /app/frontend/public ./frontend/public
COPY --chown=remix-api:nodejs --from=installer /app/frontend/package.json ./frontend/package.json

# Copier les packages internes nécessaires
COPY --chown=remix-api:nodejs --from=installer /app/packages/ui ./packages/ui
COPY --chown=remix-api:nodejs --from=installer /app/packages/design-tokens ./packages/design-tokens
COPY --chown=remix-api:nodejs --from=installer /app/packages/database-types ./packages/database-types

COPY --chown=remix-api:nodejs --from=builder /app/backend/start.sh ./backend/start.sh

ENTRYPOINT [ "backend/start.sh" ]