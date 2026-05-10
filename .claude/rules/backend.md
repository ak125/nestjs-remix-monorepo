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

## Non-blocking `onModuleInit`

**Règle** : `onModuleInit` est réservé au câblage DI/config synchrone. Aucun `await` d'I/O distante (Supabase, `fetch`, HTTP, Meilisearch) n'a sa place ici.

**Pourquoi** : NestJS exécute tous les `onModuleInit` **sérialement à l'intérieur de `app.listen()`** (phase init). Tant qu'un seul hook bloque, le port n'est pas bindé et `/health` ne répond pas. Sur runner CI à froid (Supabase distant + RPCs lentes), un seul `await this.supabase.from(...)` peut prendre 60-280s. → exit 124 sur `perf-gates.yml`, container `not ready` en k8s, déploiement bloqué. Cause confirmée : PR #224 / run `25166916535` (5 min de silence entre `Démarrage du serveur` et le timeout).

**Pattern canonique** (sync `onModuleInit` + `void warmer()`) :

```ts
@Injectable()
export class MyService implements OnModuleInit {
  onModuleInit(): void {
    this.logger.log("🚀 Init MyService — travail différé en arrière-plan");
    void this.warmCache();
  }

  private async warmCache(): Promise<void> {
    try {
      await this.supabase.from("foo").select("*");
      // ...
    } catch (e) {
      this.logger.error("warm failed:", e);
    }
  }
}
```

Les premières requêtes pendant le warm tombent sur le fallback déjà géré par le service (cache-miss → live RPC, `fallbackTier`, etc.). Les recovery one-shot (orphan jobs, lock cleanup) ne gardent aucune requête entrante — fire-and-forget OK.

**Garde mécanique** : `.ast-grep/rules/backend-no-remote-io-in-onmoduleinit.yml` (severity: `error`) bloque tout `await this.supabase.*` ou `await fetch(...)` à l'intérieur d'un `onModuleInit`. Exécuté par `.husky/pre-commit` et par le job lint en CI. Pour vérifier en local :

```bash
npx ast-grep scan --config sgconfig.yml --rule .ast-grep/rules/backend-no-remote-io-in-onmoduleinit.yml backend/src
```

**Local-fast OK** : `await this.cacheService.get(...)` (Redis local), `await this.emailQueue.add(...)` (BullMQ local), lecture fichier (`fs.readFileSync`), wiring DI pur. La règle ne les flag pas.

## Making Changes

- Edit `backend/src/`, TypeScript watcher rebuilds, Nodemon restarts
- Shared types : `packages/shared-types/src/`, rebuild avec `npm run build`
- Module `rm/` : DEV uniquement (import non resolu en Docker)

## Environment Variables

Backend : `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `PAYBOX_*`, `SYSTEMPAY_*`
Frontend : `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
