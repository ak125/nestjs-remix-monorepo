# Organic Landing Attribution (Étape 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture first-party, server-side landing attribution (organic / paid / social / referral / direct) at the first hit of a session and stamp it onto each order, so organic→order conversion is SQL-queryable in Supabase independently of GA4 consent.

**Architecture:** A pure classifier turns `Referer` + UTM/click-id query params into a `LandingSource`. A NestJS global middleware (registered after `express-session` in `main.ts`) writes the classification into `req.session.landing` on the first hit only. At order creation, `OrdersController.createOrder` folds `req.session.landing` into the same post-create `.update()` that already persists `ga_client_id` on `___xtr_order`. Three new nullable columns hold the attribution. This **complements** the existing GA4 stack (`analytics.ts` client events + `___xtr_order.ga_client_id` + Paybox-callback Measurement Protocol purchase) — it does **not** replace it, and it survives GA4 consent refusal / ad-blockers.

**Tech Stack:** NestJS (Express middleware, express-session + connect-redis), Supabase Postgres (raw SQL migrations in `backend/supabase/migrations/`), Jest/`node:test` style unit tests as already used under `backend/src` (`*.test.ts`).

**Why this corrects the original Étape 0 spec:** the plan `utiliser-superpower-toasty-charm.md` proposed adding `landing_source` columns to `__seo_event_log`. Verification (2026-05-20) showed `__seo_event_log` is an **SEO-ops event log** (enum `anomaly_detected`/`alert_sent`/`ingestion_run_*`), not a commerce-funnel store — wrong home. The real order table is `___xtr_order` (legacy TEXT columns, RLS enabled since `20260422`), which **already** carries `ga_client_id`. So attribution belongs on `___xtr_order`, mirroring the established `ga_client_id` flow.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `backend/supabase/migrations/20260520_order_landing_attribution.sql` | Add 3 nullable attribution columns + partial index + comments to `___xtr_order` | Create |
| `backend/supabase/migrations/20260520_order_landing_attribution.down.sql` | Reversal | Create |
| `backend/src/modules/analytics/landing-source.classifier.ts` | Pure function `classifyLandingSource()` + `LandingSource`/`LandingAttribution` types | Create |
| `backend/src/modules/analytics/landing-source.classifier.test.ts` | Unit tests for every classification branch | Create |
| `backend/src/types/express.d.ts` | Augment `SessionData` with `landing?` | Modify |
| `backend/src/modules/analytics/landing-attribution.middleware.ts` | NestJS middleware: classify + write `req.session.landing` on first hit | Create |
| `backend/src/modules/analytics/landing-attribution.middleware.test.ts` | Unit tests for first-hit / skip / no-overwrite behaviour | Create |
| `backend/src/main.ts` | Register the middleware right after `express-session` | Modify |
| `backend/src/modules/orders/controllers/orders.controller.ts` | Fold `req.session.landing` into the existing post-create `.update()` | Modify |

**Design note (storage medium):** attribution is stored in the existing express-session (Redis), reusing infra rather than introducing a parallel cookie/store (consistent with `feedback_cwv_rum_stack_already_exists` / no-parallel-system). The middleware skips static assets, non-GET requests, and obvious crawlers to limit Redis session creation. If anonymous-session bloat ever becomes a measured problem, a follow-up can move capture to a signed first-party cookie — YAGNI for now.

**PII / RGPD:** only the URL **pathname** is stored (`landing_path`), never the query string (UTM values can carry campaign PII). `landing_source` is a closed enum. This matches the sanitize-first posture in `frontend/app/utils/analytics-sanitize.ts`.

---

## Task 1: Migration — attribution columns on `___xtr_order`

**Files:**
- Create: `backend/supabase/migrations/20260520_order_landing_attribution.sql`
- Create: `backend/supabase/migrations/20260520_order_landing_attribution.down.sql`

- [ ] **Step 1: Write the forward migration**

File `backend/supabase/migrations/20260520_order_landing_attribution.sql`:

```sql
-- =====================================================
-- Order Landing Attribution (Étape 0 — PR-INST-1)
-- Date: 2026-05-20
-- Refs: plans/utiliser-superpower-toasty-charm.md (Étape 0, corrected)
--       docs/superpowers/plans/2026-05-20-organic-landing-attribution.md
-- =====================================================
-- First-party server-side attribution, complements existing ga_client_id.
-- New columns are NULLABLE: existing rows stay NULL (no backfill needed,
-- "unknown attribution" is the correct value for pre-instrumentation orders).
-- =====================================================

ALTER TABLE ___xtr_order
    ADD COLUMN IF NOT EXISTS landing_source        TEXT,
    ADD COLUMN IF NOT EXISTS landing_path          TEXT,
    ADD COLUMN IF NOT EXISTS landing_first_seen_at TIMESTAMPTZ;

-- Closed-enum guard at the DB layer (defense in depth; app also validates).
-- Allow NULL (unknown). Reject typos so dashboard aggregates stay clean.
ALTER TABLE ___xtr_order
    DROP CONSTRAINT IF EXISTS chk_xtr_order_landing_source;
ALTER TABLE ___xtr_order
    ADD CONSTRAINT chk_xtr_order_landing_source
    CHECK (landing_source IS NULL OR landing_source IN
        ('organic','paid','social','email','referral','direct','campaign'));

-- Partial index for dashboard cohort queries (WHERE landing_source = 'organic').
CREATE INDEX IF NOT EXISTS idx_xtr_order_landing_source
    ON ___xtr_order (landing_source)
    WHERE landing_source IS NOT NULL;

COMMENT ON COLUMN ___xtr_order.landing_source IS
    'First-party attribution at first session hit: organic|paid|social|email|referral|direct|campaign. NULL = pre-instrumentation or untraceable. Complements ga_client_id.';
COMMENT ON COLUMN ___xtr_order.landing_path IS
    'URL pathname of the landing page (no query string — PII-safe).';
COMMENT ON COLUMN ___xtr_order.landing_first_seen_at IS
    'Timestamp of the first hit of the attributed session (ISO/TIMESTAMPTZ).';
```

- [ ] **Step 2: Write the down migration**

File `backend/supabase/migrations/20260520_order_landing_attribution.down.sql`:

```sql
-- Reversal of 20260520_order_landing_attribution.sql
DROP INDEX IF EXISTS idx_xtr_order_landing_source;
ALTER TABLE ___xtr_order DROP CONSTRAINT IF EXISTS chk_xtr_order_landing_source;
ALTER TABLE ___xtr_order
    DROP COLUMN IF EXISTS landing_source,
    DROP COLUMN IF EXISTS landing_path,
    DROP COLUMN IF EXISTS landing_first_seen_at;
```

- [ ] **Step 3: Validate against the canonical migration engine (no DB write)**

Migrations are applied **only** by the forward-only engine
`scripts/ci/apply-supabase-migration.py` via the manual-trigger workflow
`.github/workflows/apply-supabase-migrations.yml` (append-only
`infra.schema_migrations`, SHA-256 checksum drift = HARD FAIL). **Do NOT
apply out-of-band via MCP `apply_migration`** — that creates untracked
schema state and risks a checksum-drift hard-fail when the engine runs.

Validate locally without touching the DB:

Run: `python3 scripts/ci/apply-supabase-migration.py --self-test`
Expected: self-test PASS (engine invariants OK).

Manually confirm the file obeys the engine rules:
- Filename matches `^(\d{8})_([a-z0-9_]+)\.sql$` → `20260520_order_landing_attribution.sql` ✓
- Version `20260520` is **after** the last migration (`20260518_*`) → in-order ✓
- DDL is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`) → re-runnable no-op ✓
- No `CREATE INDEX CONCURRENTLY` (would need the non-tx marker) ✓

- [ ] **Step 4: Schema verification is deferred to apply time**

The actual schema goes live when an operator triggers
`apply-supabase-migrations.yml` (post-merge). The live-schema check
(Task 6 Step 3) is the post-apply confirmation:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='___xtr_order'
  AND column_name IN ('landing_source','landing_path','landing_first_seen_at')
ORDER BY column_name;
```

Expected (after apply): 3 rows, all `is_nullable = YES`, types `text`,`text`,`timestamp with time zone`.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20260520_order_landing_attribution.sql \
        backend/supabase/migrations/20260520_order_landing_attribution.down.sql
git commit -m "feat(attribution): add landing_source columns to ___xtr_order (PR-INST-1)"
```

---

## Task 2: Pure classifier `classifyLandingSource()`

**Files:**
- Create: `backend/src/modules/analytics/landing-source.classifier.ts`
- Test: `backend/src/modules/analytics/landing-source.classifier.test.ts`

- [ ] **Step 1: Write the failing tests**

File `backend/src/modules/analytics/landing-source.classifier.test.ts`:

```ts
import { describe, it, expect } from '@jest/globals';
import { classifyLandingSource } from './landing-source.classifier';

const SELF = 'www.automecanik.com';

describe('classifyLandingSource', () => {
  it('classifies a Google search referer as organic', () => {
    expect(
      classifyLandingSource({ referer: 'https://www.google.com/search?q=plaquettes', selfHost: SELF }),
    ).toBe('organic');
  });

  it('classifies gclid as paid (precedence over referer)', () => {
    expect(
      classifyLandingSource({
        referer: 'https://www.google.com/',
        query: { gclid: 'abc123' },
        selfHost: SELF,
      }),
    ).toBe('paid');
  });

  it('classifies utm_medium=cpc as paid', () => {
    expect(classifyLandingSource({ query: { utm_medium: 'cpc' }, selfHost: SELF })).toBe('paid');
  });

  it('classifies utm_medium=email as email', () => {
    expect(classifyLandingSource({ query: { utm_medium: 'email' }, selfHost: SELF })).toBe('email');
  });

  it('classifies a Facebook referer as social', () => {
    expect(
      classifyLandingSource({ referer: 'https://m.facebook.com/', selfHost: SELF }),
    ).toBe('social');
  });

  it('classifies a non-search external referer as referral', () => {
    expect(
      classifyLandingSource({ referer: 'https://blog.partenaire.fr/article', selfHost: SELF }),
    ).toBe('referral');
  });

  it('classifies a same-host referer as direct (internal nav is not a new landing source)', () => {
    expect(
      classifyLandingSource({ referer: 'https://www.automecanik.com/pieces', selfHost: SELF }),
    ).toBe('direct');
  });

  it('classifies no referer and no utm as direct', () => {
    expect(classifyLandingSource({ selfHost: SELF })).toBe('direct');
  });

  it('classifies an unknown utm_source as campaign', () => {
    expect(
      classifyLandingSource({ query: { utm_source: 'partner-x' }, selfHost: SELF }),
    ).toBe('campaign');
  });

  it('is robust to a malformed referer (treats as direct)', () => {
    expect(classifyLandingSource({ referer: 'not a url', selfHost: SELF })).toBe('direct');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest src/modules/analytics/landing-source.classifier.test.ts`
Expected: FAIL — `Cannot find module './landing-source.classifier'`.

- [ ] **Step 3: Write the classifier**

File `backend/src/modules/analytics/landing-source.classifier.ts`:

```ts
/**
 * First-party landing attribution classifier (Étape 0 — PR-INST-1).
 * Pure function: (Referer + UTM/click-id params) → closed-enum LandingSource.
 * Complements GA4 (ga_client_id) — survives consent refusal / ad-blockers.
 */

export type LandingSource =
  | 'organic'
  | 'paid'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct'
  | 'campaign';

export interface LandingAttribution {
  source: LandingSource;
  /** URL pathname only — never the query string (PII-safe). */
  path: string;
  /** ISO timestamp of the first hit. */
  firstSeenAt: string;
}

const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid'];
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid-search', 'display'];

const SEARCH_HOST_RE =
  /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|qwant|yandex|baidu)\./i;
const SOCIAL_HOST_RE =
  /(^|\.)(facebook|instagram|twitter|linkedin|pinterest|youtube|tiktok|reddit|snapchat)\.|(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)lnkd\.in$/i;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function classifyLandingSource(input: {
  referer?: string;
  query?: Record<string, unknown>;
  selfHost: string;
}): LandingSource {
  const q = input.query ?? {};
  const utmMedium = str(q.utm_medium)?.toLowerCase();
  const utmSource = str(q.utm_source);
  const refHost = hostOf(input.referer);
  const selfHost = input.selfHost.toLowerCase();

  // 1. Paid: explicit click ids or paid medium win over everything.
  if (PAID_CLICK_IDS.some((k) => str(q[k]))) return 'paid';
  if (utmMedium && PAID_MEDIUMS.includes(utmMedium)) return 'paid';

  // 2. Email.
  if (utmMedium === 'email') return 'email';

  // 3. Social: explicit medium or known social referer.
  if (utmMedium === 'social') return 'social';
  if (refHost && SOCIAL_HOST_RE.test(refHost)) return 'social';

  // 4. Organic: explicit medium or known search-engine referer.
  if (utmMedium === 'organic') return 'organic';
  if (refHost && SEARCH_HOST_RE.test(refHost)) return 'organic';

  // 5. Tagged campaign with an otherwise-unknown source.
  if (utmSource) return 'campaign';

  // 6. External referral (not search/social/self).
  if (refHost && refHost !== selfHost) return 'referral';

  // 7. No signal: direct (includes internal navigation).
  return 'direct';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx jest src/modules/analytics/landing-source.classifier.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/analytics/landing-source.classifier.ts \
        backend/src/modules/analytics/landing-source.classifier.test.ts
git commit -m "feat(attribution): pure landing-source classifier + tests (PR-INST-1)"
```

---

## Task 3: Session augmentation + capture middleware

**Files:**
- Modify: `backend/src/types/express.d.ts`
- Create: `backend/src/modules/analytics/landing-attribution.middleware.ts`
- Test: `backend/src/modules/analytics/landing-attribution.middleware.test.ts`

- [ ] **Step 1: Augment `SessionData`**

In `backend/src/types/express.d.ts`, replace the existing `SessionData` block:

```ts
declare module 'express-session' {
  interface SessionData {
    googleNonce?: string;
  }
}
```

with:

```ts
declare module 'express-session' {
  interface SessionData {
    googleNonce?: string;
    landing?: {
      source:
        | 'organic'
        | 'paid'
        | 'social'
        | 'email'
        | 'referral'
        | 'direct'
        | 'campaign';
      path: string;
      firstSeenAt: string;
    };
  }
}
```

- [ ] **Step 2: Write the failing middleware tests**

File `backend/src/modules/analytics/landing-attribution.middleware.test.ts`:

```ts
import { describe, it, expect, jest } from '@jest/globals';
import { LandingAttributionMiddleware } from './landing-attribution.middleware';

function mkReq(over: Partial<any> = {}): any {
  return {
    method: 'GET',
    path: '/pieces/plaquettes-de-frein',
    originalUrl: '/pieces/plaquettes-de-frein?utm_source=x',
    query: {},
    headers: { host: 'www.automecanik.com', referer: 'https://www.google.com/search?q=x' },
    get(name: string) {
      return this.headers[name.toLowerCase()];
    },
    session: {},
    ...over,
  };
}

describe('LandingAttributionMiddleware', () => {
  const mw = new LandingAttributionMiddleware();

  it('writes session.landing on the first organic hit', () => {
    const req = mkReq();
    const next = jest.fn();
    mw.use(req, {} as any, next);
    expect(req.session.landing).toBeDefined();
    expect(req.session.landing.source).toBe('organic');
    expect(req.session.landing.path).toBe('/pieces/plaquettes-de-frein');
    expect(typeof req.session.landing.firstSeenAt).toBe('string');
    expect(next).toHaveBeenCalled();
  });

  it('does not overwrite an existing session.landing', () => {
    const existing = { source: 'paid' as const, path: '/x', firstSeenAt: '2026-01-01T00:00:00.000Z' };
    const req = mkReq({ session: { landing: existing } });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toEqual(existing);
  });

  it('skips non-GET requests', () => {
    const req = mkReq({ method: 'POST' });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('skips static asset paths', () => {
    const req = mkReq({ path: '/assets/app.css' });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('skips obvious crawlers', () => {
    const req = mkReq({ headers: { host: 'www.automecanik.com', 'user-agent': 'Googlebot/2.1' } });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('always calls next() even when it skips', () => {
    const req = mkReq({ method: 'POST' });
    const next = jest.fn();
    mw.use(req, {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('is a no-op (but calls next) when there is no session', () => {
    const req = mkReq({ session: undefined });
    const next = jest.fn();
    expect(() => mw.use(req, {} as any, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx jest src/modules/analytics/landing-attribution.middleware.test.ts`
Expected: FAIL — `Cannot find module './landing-attribution.middleware'`.

- [ ] **Step 4: Write the middleware**

File `backend/src/modules/analytics/landing-attribution.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { classifyLandingSource } from './landing-source.classifier';

/**
 * Captures first-party landing attribution into express-session on the first
 * hit of a session. Registered after the session middleware in main.ts.
 *
 * Skips: non-GET, static assets, obvious crawlers, and sessions that already
 * carry a `landing` value (first-touch attribution, never overwritten).
 */
const ASSET_RE = /^\/(assets|build|favicon|robots\.txt|sitemap|@|_static)/i;
const CRAWLER_RE = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome/i;

@Injectable()
export class LandingAttributionMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      if (req.method !== 'GET') return;
      if (!req.session) return;
      if (req.session.landing) return; // first-touch only
      if (ASSET_RE.test(req.path)) return;

      const ua = req.get('user-agent') ?? '';
      if (!ua || CRAWLER_RE.test(ua)) return;

      const source = classifyLandingSource({
        referer: req.get('referer') ?? undefined,
        query: req.query as Record<string, unknown>,
        selfHost: req.get('host') ?? '',
      });

      req.session.landing = {
        source,
        path: req.path, // pathname only — no query string (PII-safe)
        firstSeenAt: new Date().toISOString(),
      };
    } catch {
      // Attribution must never break a page request.
    } finally {
      next();
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && npx jest src/modules/analytics/landing-attribution.middleware.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/express.d.ts \
        backend/src/modules/analytics/landing-attribution.middleware.ts \
        backend/src/modules/analytics/landing-attribution.middleware.test.ts
git commit -m "feat(attribution): session capture middleware + tests (PR-INST-2)"
```

---

## Task 4: Register the middleware in `main.ts`

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Add the import**

Near the other imports at the top of `backend/src/main.ts`, add:

```ts
import { LandingAttributionMiddleware } from './modules/analytics/landing-attribution.middleware';
```

- [ ] **Step 2: Register the middleware immediately after the session middleware**

In `backend/src/main.ts`, locate the block that ends the session registration (the `logger.log('Middleware de session initialisé');` line at ~165). Immediately after it, insert:

```ts
    // Landing attribution: first-touch source capture into the session.
    // MUST run after express-session (needs req.session) and before route
    // handlers. Stateless instance — no DI needed here.
    const landingAttribution = new LandingAttributionMiddleware();
    app.use((req: any, res: any, nextFn: any) =>
      landingAttribution.use(req, res, nextFn),
    );
    logger.log('Middleware d\'attribution landing initialisé');
```

- [ ] **Step 3: Verify the backend compiles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `landing-attribution` or `main.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main.ts
git commit -m "feat(attribution): register landing-attribution middleware after session (PR-INST-2)"
```

---

## Task 5: Stamp attribution onto the order

**Files:**
- Modify: `backend/src/modules/orders/controllers/orders.controller.ts`

- [ ] **Step 1: Read the existing `ga_client_id` update block**

In `createOrder` (~line 380) and the second creation path (~line 560) there is:

```ts
if (gaClientId && orderId) {
  const sb = this.ordersService.getSupabaseClient();
  await sb
    .from('___xtr_order')
    .update({ ga_client_id: gaClientId })
    .eq('ord_id', orderId);
}
```

- [ ] **Step 2: Fold landing attribution into the same update**

Replace each of the two blocks above with the following (single update covering both ga_client_id and landing, each guarded):

```ts
const landing = (req.session as { landing?: { source: string; path: string; firstSeenAt: string } } | undefined)?.landing;
if ((gaClientId || landing) && orderId) {
  const sb = this.ordersService.getSupabaseClient();
  const patch: Record<string, unknown> = {};
  if (gaClientId) patch.ga_client_id = gaClientId;
  if (landing) {
    patch.landing_source = landing.source;
    patch.landing_path = landing.path;
    patch.landing_first_seen_at = landing.firstSeenAt;
  }
  await sb.from('___xtr_order').update(patch).eq('ord_id', orderId);
}
```

(The second creation path uses `finalOrderId` instead of `orderId` — keep that variable name there.)

- [ ] **Step 3: Verify the backend compiles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `orders.controller.ts`.

- [ ] **Step 4: Run the orders controller test suite (if present) and the analytics tests**

Run: `cd backend && npx jest src/modules/analytics src/modules/orders/controllers`
Expected: PASS (analytics suites pass; orders suites unchanged/green).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/orders/controllers/orders.controller.ts
git commit -m "feat(attribution): stamp session.landing onto ___xtr_order at creation (PR-INST-3)"
```

---

## Task 6: End-to-end verification

- [ ] **Step 1: Full analytics suite green**

Run: `cd backend && npx jest src/modules/analytics`
Expected: PASS (classifier 10 + middleware 7).

- [ ] **Step 2: Type check whole backend**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Confirm the attribution columns exist in the DB**

Run via Supabase MCP `execute_sql` on `cxpojprgwgubzjyqzmoq`:

```sql
SELECT count(*) AS attributed_orders,
       count(*) FILTER (WHERE landing_source = 'organic') AS organic_orders
FROM ___xtr_order
WHERE landing_first_seen_at IS NOT NULL;
```

Expected: query runs (returns 0/0 until traffic flows post-deploy — proves schema + column names are correct).

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin feat/organic-landing-attribution
gh pr create --repo ak125/nestjs-remix-monorepo --base main \
  --title "feat(attribution): organic landing attribution on orders (Étape 0 PR-INST)" \
  --body "See docs/superpowers/plans/2026-05-20-organic-landing-attribution.md. First-party server-side landing capture complementing GA4 ga_client_id; columns on ___xtr_order; first-touch session middleware; closed-enum classifier with tests."
```

---

## Self-Review

- **Spec coverage:** PR-INST-1 (schema) = Task 1; capture middleware (PR-INST-2 intent) = Tasks 2-4; order persistence (PR-INST-3 intent) = Task 5. Étape 0 acceptance ("schema confirmed; organic session → attributed order") covered by Tasks 1 & 6.
- **Correction vs original spec:** `__seo_event_log` deliberately untouched (wrong table); attribution lives on `___xtr_order` next to `ga_client_id`. Documented in header.
- **Placeholder scan:** every code step contains full code; no TODO/TBD.
- **Type consistency:** `LandingSource` enum identical across classifier, `SessionData.landing.source`, and the DB `CHECK` constraint (organic|paid|social|email|referral|direct|campaign). `firstSeenAt` (camelCase in TS) ↔ `landing_first_seen_at` (snake_case column) mapping is explicit in Task 5.
- **Scope:** single subsystem (attribution). No payment-gateway code touched (`paybox`/`systempay` untouched — only the additive order column, consistent with the existing `ga_client_id` post-create update pattern).
```