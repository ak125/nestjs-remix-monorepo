# Backend Architecture (NestJS)

## Monorepo Structure

- **backend/** - NestJS API (TypeScript, PostgreSQL via Supabase)
- **frontend/** - Remix SSR application (React 18, Vite)
- **packages/** - Shared libraries
  - `@repo/database-types` - Supabase-generated types
  - `@monorepo/shared-types` - Shared TypeScript types and Zod schemas
  - `@fafa/ui` - React component library (Radix UI + Tailwind)
  - `@fafa/design-tokens` - Design system tokens
  - `@fafa/typescript-config` - Shared tsconfig
  - `@fafa/eslint-config` - Shared ESLint rules

## Key Pattern: Module-based Dependency Injection

```typescript
// Each feature is a module with controllers, services, and data services
PaymentsModule
├── PaymentsController (HTTP handlers)
├── PaymentService (business logic)
└── PaymentDataService (Supabase queries)
```

## Three-Tier Pattern

1. Controllers - HTTP/validation layer (Zod schemas)
2. Services - Business logic orchestration
3. Data Services - Direct Supabase queries

## Database Access (Supabase uniquement, PAS de Prisma)

- Supabase SDK directement : `supabase.from('table').select().eq()`
- RPC functions pour requêtes complexes : `supabase.rpc('function_name', params)`
- Base service : `SupabaseBaseService` avec patterns réutilisables
- Migrations SQL dans `backend/supabase/migrations/`

```typescript
// Use Supabase SDK directly
const { data, error } = await this.supabase
  .from('__products')
  .select('*')
  .eq('id', productId)
  .single();

// For complex queries, use RPC
const { data } = await this.supabase.rpc('get_bestsellers', {
  limit: 10,
  category_id: 5
});
```

## Session Management

- Redis + express-session (30-day TTL)
- Passport.js for authentication (local strategy)
- Admin auth uses JWT tokens (24-hour expiry)
- Cookie name: `connect.sid` (HttpOnly, SameSite: lax)

## Important Modules

- `CryptoModule` - Global module for password hashing (bcrypt + legacy MD5 support)
- `DatabaseModule` - Exports all data services
- `PaymentsModule` - Dual payment gateway (Paybox + SystemPay)
- `SeoModule` - V4 Ultimate SEO with 180% more variables
- `CacheModule` - Redis + NestJS Cache Manager

## Authentication Guards

```typescript
// Protect admin routes
@UseGuards(IsAdminGuard)
@Get('admin/stats')
async getAdminStats() { ... }

// Check user session
@UseGuards(AuthGuard('local'))
@Post('login')
async login(@Req() req) { ... }
```

## Form Validation (Zod)

```typescript
import { z } from 'zod';

const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number() }))
});

@Post('orders')
async createOrder(@Body() body: z.infer<typeof createOrderSchema>) { ... }
```

## Making Changes

- Edit files in `backend/src/`
- TypeScript compiler watches and rebuilds (`dev:compile`)
- Nodemon restarts server on dist changes (`dev:watch`)
- Tester avec curl après modifications

### Shared Types

- Edit `packages/shared-types/src/`
- Used by both backend and frontend
- Rebuild: `cd packages/shared-types && npm run build`

## Modules en Développement (INTERDIT en prod)

| Module | Status | Raison |
|--------|--------|--------|
| `backend/src/modules/rm/` | DEV | Import @monorepo/shared-types non résolu en Docker |

## Environment Variables

**Backend (.env):**
```env
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
PAYBOX_SITE=...
PAYBOX_HMAC_KEY=...
SYSTEMPAY_SITE_ID=...
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```
