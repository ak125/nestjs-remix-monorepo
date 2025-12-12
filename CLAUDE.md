# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready NestJS + Remix monorepo for an automotive parts e-commerce platform. The backend (NestJS) serves both the API and the frontend (Remix) on the same port (3000) in development and production.

**Key Stats:**
- 4M+ products, 59k+ users, 9k+ categories
- 47/47 tests passing (100% coverage for payments module)
- Production deployment with Docker + Caddy reverse proxy

## Common Commands

### Development
```bash
# Start full stack (backend + frontend on port 3000)
npm run dev

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Start with Redis (required for sessions)
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine
npm run dev
```

### Building
```bash
# Build all packages (uses Turbo)
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build

# Clean build artifacts
cd backend && npm run prebuild  # removes dist/ and tsconfig.tsbuildinfo
```

### Testing
```bash
# Run all tests (Jest + Vitest)
npm test

# Backend unit tests (Jest)
cd backend && npm test

# Frontend tests (Vitest)
cd frontend && npm test
cd frontend && npm run test:ui          # UI mode
cd frontend && npm run test:coverage    # with coverage

# Frontend E2E tests (Playwright)
cd frontend && npm run test:a11y        # Accessibility tests
cd frontend && npm run test:visual      # Visual regression
cd frontend && npm run test:contrast    # WCAG contrast checks

# Run single test file
cd backend && npm test -- payments.service.spec.ts
cd frontend && npm test -- components/Button.test.tsx
```

### Linting & Type Checking
```bash
# Lint all packages
npm run lint

# Type check all packages
npm run typecheck

# Fix linting issues
cd backend && npm run lint -- --fix
cd frontend && npm run lint -- --fix
```

### Production
```bash
# Start production server (requires build)
npm run start

# Docker production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## Architecture Overview

### Monorepo Structure
- **backend/** - NestJS API (TypeScript, PostgreSQL via Supabase)
- **frontend/** - Remix SSR application (React 18, Vite)
- **packages/** - Shared libraries
  - `@repo/database-types` - Supabase-generated types
  - `@monorepo/shared-types` - Shared TypeScript types and Zod schemas
  - `@fafa/ui` - React component library (Radix UI + Tailwind)
  - `@fafa/design-tokens` - Design system tokens
  - `@fafa/typescript-config` - Shared tsconfig
  - `@fafa/eslint-config` - Shared ESLint rules

### Backend Architecture (NestJS)

**Key Pattern: Module-based Dependency Injection**
```typescript
// Each feature is a module with controllers, services, and data services
PaymentsModule
├── PaymentsController (HTTP handlers)
├── PaymentService (business logic)
└── PaymentDataService (Supabase queries)
```

**Three-Tier Pattern:**
1. Controllers - HTTP/validation layer (Zod schemas)
2. Services - Business logic orchestration
3. Data Services - Direct Supabase queries

**Database Access:**
- Uses Supabase SDK directly (no Prisma for production data)
- Pattern: `supabase.from('table').select().eq()`
- RPC functions for complex queries: `supabase.rpc('function_name', params)`
- Base service: `SupabaseBaseService` provides common patterns

**Session Management:**
- Redis + express-session (30-day TTL)
- Passport.js for authentication (local strategy)
- Admin auth uses JWT tokens (24-hour expiry)
- Cookie name: `connect.sid` (HttpOnly, SameSite: lax)

**Important Modules:**
- `CryptoModule` - Global module for password hashing (bcrypt + legacy MD5 support)
- `DatabaseModule` - Exports all data services
- `PaymentsModule` - Dual payment gateway (Paybox + SystemPay)
- `SeoModule` - V4 Ultimate SEO with 180% more variables
- `CacheModule` - Redis + NestJS Cache Manager

### Frontend Architecture (Remix)

**SSR with Remix:**
- Server-side rendering for SEO and performance
- Route-based code splitting (flat routes pattern)
- Loaders for server-side data fetching
- Actions for form submissions

**State Management:**
- Server state: React Query (TanStack)
- Client state: Zustand stores
- Form state: Conform.js + Zod validation

**API Communication:**
- Services in `frontend/app/services/api/`
- Native fetch with error handling
- Base URL: `http://localhost:3000` (same port as backend)

**Key Routes Pattern:**
```
app/routes/
├── _index.tsx                    # Homepage
├── admin.*/                      # Admin dashboard routes
├── panier.*/                     # Cart pages
├── pieces.*.tsx                  # Product catalog routes
└── api.*.ts                      # API routes (handled by Remix)
```

### Payment Integration (Critical)

**Two Gateways:**
1. **Paybox (Production)** - Vérifone
   - HMAC-SHA512 signature
   - Config: `PAYBOX_SITE`, `PAYBOX_RANG`, `PAYBOX_IDENTIFIANT`, `PAYBOX_HMAC_KEY`
   - Response format: `Mt:10050;Ref:ORD123;Auto:XXXXX;Erreur:00000;Signature:...`

2. **SystemPay (Test)** - BNP Paribas Cyberplus
   - HMAC-SHA256 or SHA1 signature
   - Config: `SYSTEMPAY_SITE_ID`, `SYSTEMPAY_CERTIFICATE_PROD/TEST`
   - Vads_* parameters (alphabetically sorted for signature)

**Payment Flow:**
1. Order created → Payment initiated
2. User redirected to gateway
3. Gateway callback to `/api/payments/paybox/callback`
4. Signature verified → Order status updated
5. User redirected to success/error page

**Security:**
- HMAC signature verification on all callbacks
- CSP headers allow payment domains
- Error code validation before confirmation

### SEO Architecture (Advanced)

**DynamicSeoV4UltimateService:**
- 180% more variables than original
- Dynamic meta descriptions, Open Graph, Twitter cards
- Structured data (Schema.org JSON-LD)
- Breadcrumbs with internal linking

**Sitemap System (V2 Scalable):**
- 3-level hierarchy: Index → Sub-indices → Final sitemaps
- 50k URL limit per file (Google requirement)
- Sharding strategies: alphabetic, numeric, temporal
- GZIP compression for large sitemaps
- Supports 1M+ URLs with intelligent caching

**Key SEO Tables:**
- `__seo_*` prefix for dynamic content
- `__blog_*` for blog/guides/advice content
- RPC functions for efficient querying

### Testing Strategy

**Backend (Jest):**
- Unit tests: `*.spec.ts` files next to source
- Config: `backend/jest.config.js`
- Run single test: `npm test -- filename.spec.ts`

**Frontend (Vitest):**
- Component tests with React Testing Library
- Storybook integration for visual testing
- Run: `npm test` or `npm run test:ui`

**E2E (Playwright):**
- Tests in `frontend/tests/`
- Browsers: Chromium, Firefox, WebKit
- Accessibility (Axe Core), visual regression, contrast checks

**Coverage Target:**
- Backend: 47/47 tests passing (payments module)
- Frontend: Component coverage via Vitest

## Development Workflow

### Starting Development
1. Ensure Redis is running: `docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine`
2. Start dev: `npm run dev` (runs backend + frontend concurrently)
3. Backend starts on port 3000, serves Remix frontend
4. Access: `http://localhost:3000`

### Making Changes

**Backend:**
- Edit files in `backend/src/`
- TypeScript compiler watches and rebuilds (`dev:compile`)
- Nodemon restarts server on dist changes (`dev:watch`)
- Add tests in `*.spec.ts` files

**Frontend:**
- Edit files in `frontend/app/`
- Vite provides HMR (instant updates)
- Remix handles routing, loaders, actions
- Components in `frontend/app/components/`

**Shared Types:**
- Edit `packages/shared-types/src/`
- Used by both backend and frontend
- Rebuild: `cd packages/shared-types && npm run build`

### Environment Variables

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

## Critical Patterns to Follow

### Database Queries
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

### Authentication Guards
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

### Form Validation (Zod)
```typescript
// Backend controller
import { z } from 'zod';

const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number() }))
});

@Post('orders')
async createOrder(@Body() body: z.infer<typeof createOrderSchema>) { ... }
```

### Remix Loaders
```typescript
// Server-side data fetching
export async function loader({ request, params }: LoaderFunctionArgs) {
  const productId = params.productId;
  const product = await fetch(`${API_URL}/api/products/${productId}`);
  return json({ product });
}

// Meta tags for SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data.product.name },
  { name: "description", content: data.product.description }
];
```

## Common Pitfalls

1. **Redis Required:** Backend won't start without Redis for sessions. Run Redis before `npm run dev`.

2. **Port 3000 Shared:** Backend serves frontend on the same port. Don't try to run frontend separately on different port.

3. **Payment Signatures:** Always verify HMAC signatures on payment callbacks. Use correct algorithm (SHA512 for Paybox, SHA256 for SystemPay).

4. **Supabase RLS:** Some tables have Row Level Security. Use service role key in backend, anon key in frontend.

5. **TypeScript Compilation:** Backend uses `tsc --build` with watch mode. Wait for compilation before testing changes.

6. **Turbo Cache:** If builds seem stale, clear Turbo cache: `npm run clean-turbo-cache`.

7. **Memory Limits:** Backend build uses `--max-old-space-size=4096`. Increase if build fails with OOM.

## Key Files to Reference

- `backend/src/main.ts` - NestJS bootstrap, middleware setup
- `backend/src/app.module.ts` - Root module with all imports
- `frontend/app/root.tsx` - Remix root with providers
- `frontend/app/routes/_index.tsx` - Homepage
- `turbo.json` - Monorepo build pipeline
- `docker-compose.prod.yml` - Production deployment
- `README.md` - Full documentation and metrics

## Production Deployment

**Docker Build:**
```bash
docker build -t automecanik-app .
docker-compose -f docker-compose.prod.yml up -d
```

**Environment:**
- `NODE_ENV=production`
- Port 3001 internally, exposed via Caddy reverse proxy
- Redis for sessions on internal network
- Supabase for database (production URL)

**Monitoring:**
- Logs: `docker-compose logs -f app`
- Health check: `http://localhost:3000/health`
- Admin stats: `http://localhost:3000/admin/stats`
