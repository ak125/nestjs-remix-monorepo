# Backend Architecture (NestJS)

## Monorepo Structure

- **backend/** - NestJS API (TypeScript, PostgreSQL via Supabase)
- **frontend/** - Remix SSR (React 18, Vite)
- **packages/** - `@repo/database-types`, `@monorepo/shared-types`, `@fafa/ui` (Radix+Tailwind), `@fafa/design-tokens`, `@fafa/typescript-config`, `@fafa/eslint-config`

## Three-Tier Pattern

1. Controllers — HTTP/validation (Zod schemas)
2. Services — Business logic
3. Data Services — Supabase queries (`supabase.from().select().eq()` ou `supabase.rpc()`)

Migrations SQL dans `backend/supabase/migrations/`. Base service : `SupabaseBaseService`. **PAS de Prisma.**

## Session & Auth

- Redis + express-session (30j TTL), cookie `connect.sid` (HttpOnly, SameSite: lax)
- Passport.js local strategy, admin JWT (24h)
- Guards : `IsAdminGuard`, `AuthGuard('local')`

## Key Modules

CryptoModule (bcrypt+MD5), DatabaseModule, PaymentsModule (Paybox+SystemPay), SeoModule (V4), CacheModule (Redis)

## Making Changes

- Edit `backend/src/`, TypeScript watcher rebuilds, Nodemon restarts
- Shared types : `packages/shared-types/src/`, rebuild avec `npm run build`
- Module `rm/` : DEV uniquement (import non resolu en Docker)

## Environment Variables

Backend : `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `PAYBOX_*`, `SYSTEMPAY_*`
Frontend : `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
