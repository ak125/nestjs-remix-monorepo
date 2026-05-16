# Sitemap Regen Service Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer les 8 endpoints sitemap write d'un état "public/anonyme accessible" vers une auth production-grade : 3 guards atomiques (admin session humaine + GitHub OIDC machine + legacy kill-switched) via `AnyOf()` composite, JWKS validation avec 5 claims pinnés, jti anti-replay Redis dédié, heartbeat scheduler observability, GitHub Action OIDC cron (zéro long-lived secret), workflow_dispatch admin manual fallback.

**Architecture:** Découpage en 11 phases mergeables séparément (PR-A0 à PR-A5 = la fondation auth ; PR-C = workflow CI ; PR-B1+B2 = observability ; PR-E = cleanup post-observation). Chaque phase est testable indépendamment et préserve les 4 invariants (no public endpoint regression, no auth fallback ambiguity, fail-closed JWKS, no Bull/anti-replay Redis coupling).

**Tech Stack:** NestJS 10, `bull` v4.16.5 + `@nestjs/bull` legacy, `ioredis`, `jose` v5.x (NEW), `cron-parser` (NEW), `@sentry/nestjs` v10.51.0, GitHub Actions OIDC federation, vitest/jest for tests.

**Source spec:** `docs/superpowers/specs/2026-05-16-sitemap-regen-auth-design.md` (commit `f0c34c61b`)

**Invariants (à honorer chaque phase) :**
1. **No public endpoint regression** — rate-limit `@RateLimitSitemap()` + guards conservés à chaque étape
2. **No auth fallback ambiguity** — chaque guard atomique, jamais `if/else` multi-paths interne
3. **Fail-closed on JWKS failure** — Redis/jose down → reject, jamais bypass auth
4. **No Bull queue coupling with anti-replay Redis** — DB 1 dédiée, client ioredis séparé

---

## File Structure (across all phases)

### Create
- `backend/src/auth/github-oidc.service.ts` — JWT + JWKS + claims validation + (Phase 4) anti-replay
- `backend/src/auth/github-oidc.guard.ts` — Bearer-only atomic guard
- `backend/src/auth/admin-session.guard.ts` — cookie session + level≥7 atomic guard
- `backend/src/auth/legacy-internal-key.guard.ts` — kill-switch wrapper of InternalApiKeyGuard
- `backend/src/auth/any-of.guard.ts` — composite factory mixin via ModuleRef
- `backend/src/types/express.d.ts` — Request module augmentation for `_authPath`, `_authClaims`
- `backend/src/auth/github-oidc.service.test.ts`
- `backend/src/auth/github-oidc.guard.test.ts`
- `backend/src/auth/admin-session.guard.test.ts`
- `backend/src/auth/legacy-internal-key.guard.test.ts`
- `backend/src/auth/any-of.guard.test.ts`
- `backend/src/modules/seo/__tests__/sitemap-auth.integration.test.ts`
- `.github/workflows/sitemap-daily-regen.yml`
- `.github/workflows/test-oidc-claims.yml` (temporaire — supprimé après évidence collectée pré-PR-A1)

### Modify
- `backend/package.json` — add deps `jose`, `cron-parser` ; ensure `ioredis` present
- `backend/tsconfig.json` — include `src/types/express.d.ts`
- `backend/.env.example` (or env reference doc) — add new vars
- `docker-compose.prod.yml:38` — propagate new env vars
- `docker-compose.ci-deploy.yml:40` — same
- `backend/src/modules/seo/controllers/sitemap-v10.controller.ts` — replace `@UseGuards` per-method
- `backend/src/modules/seo/controllers/sitemap-unified.controller.ts` — same
- `backend/src/modules/seo/controllers/sitemap-streaming.controller.ts` — same
- `backend/src/modules/seo/controllers/sitemap-delta.controller.ts` — same
- `backend/src/modules/seo/seo.module.ts` — register new providers + `SitemapSchedulerDiagnosticController`
- `backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts` — add heartbeat + lifecycle logs + onModuleDestroy
- `backend/src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.ts` — enriched response

### Reference (read-only)
- `backend/src/auth/internal-api-key.guard.ts:16` — base for LegacyInternalKeyGuard wrapper
- `backend/src/auth/is-admin.guard.ts:10` — pattern source for AdminSessionGuard
- `backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts:49` — service to extend
- `backend/src/instrument.ts:1-40` — Sentry init entry point

---

# Phase 0 — Foundation: deps + env schema + typing

**PR title:** `chore(auth): foundation for sitemap regen OIDC (deps, env, typing)`
**Branch:** `feat/seo-sitemap-auth-phase-0-foundation`
**Mergeable independently:** YES (no behavior change)

### Task 0.1: Install deps and pin versions

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Check current state**

Run: `cd backend && grep -E '"(jose|cron-parser|ioredis)":' package.json`
Expected: `ioredis` present (via bull dep), `jose` and `cron-parser` ABSENT.

- [ ] **Step 2: Install jose**

Run: `cd backend && npm install jose@^5.9.0 --save --save-exact=false`
Expected: package.json updated, no peer warnings.

- [ ] **Step 3: Install cron-parser**

Run: `cd backend && npm install cron-parser@^4.9.0 --save --save-exact=false`
Expected: package.json updated.

- [ ] **Step 4: Verify ioredis available directly (not just via bull)**

Run: `cd backend && node -e "console.log(require('ioredis').default.name)"`
Expected: `Redis` printed. If error, add `npm install ioredis@^5.4.1 --save`.

- [ ] **Step 5: Commit**

```bash
cd /opt/automecanik/app
git add backend/package.json backend/package-lock.json
git commit -m "chore(auth): add jose + cron-parser deps for sitemap OIDC auth"
```

### Task 0.2: Express Request module augmentation

**Files:**
- Create: `backend/src/types/express.d.ts`
- Modify: `backend/tsconfig.json` (add to `include`)

- [ ] **Step 1: Write the augmentation**

Create `backend/src/types/express.d.ts`:
```ts
// Augmentation of Express Request to carry auth metadata across guards.
// Each guard writes _authPath on success; GithubOidcGuard also writes _authClaims.

// Forward declaration to avoid circular import. The concrete type lives in
// github-oidc.service.ts and is imported there for real use.
interface GithubOidcClaimsLike {
  repository?: string;
  event_name?: string;
  ref?: string;
  workflow_ref?: string;
  job_workflow_ref?: string;
  sub?: string;
  run_id?: string;
  actor?: string;
  sha?: string;
  jti?: string;
}

declare module 'express' {
  interface Request {
    _authPath?: 'admin-session' | 'github-oidc' | 'internal-key-legacy';
    _authClaims?: GithubOidcClaimsLike;
  }
}

export {};
```

- [ ] **Step 2: Reference in tsconfig**

Check `backend/tsconfig.json` `include` field. If `src/**/*.ts` already covers `src/types/`, no change needed. Otherwise add:
```json
{
  "include": ["src/**/*.ts", "src/types/**/*.d.ts"]
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd backend && NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add backend/src/types/express.d.ts backend/tsconfig.json
git commit -m "chore(auth): add Express Request type augmentation for auth metadata"
```

### Task 0.3: Env schema + docker-compose propagation

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.ci-deploy.yml`
- Modify: `backend/.env` (local only — DO NOT commit secrets)

- [ ] **Step 1: Add to docker-compose.prod.yml backend service environment block**

Find the `environment:` block under `backend:` service in `docker-compose.prod.yml`. Add (after existing `INTERNAL_API_KEY=${INTERNAL_API_KEY}` line):
```yaml
      # GitHub OIDC federation (Phase 1-4 — sitemap regen authentication)
      - GITHUB_OIDC_AUDIENCE=${GITHUB_OIDC_AUDIENCE:-automecanik-sitemap-regen}
      - GITHUB_OIDC_REPOSITORY=${GITHUB_OIDC_REPOSITORY:-ak125/nestjs-remix-monorepo}
      - GITHUB_OIDC_ALLOWED_EVENTS=${GITHUB_OIDC_ALLOWED_EVENTS:-schedule,workflow_dispatch}
      - GITHUB_OIDC_ALLOWED_REFS=${GITHUB_OIDC_ALLOWED_REFS:-refs/heads/main}
      - GITHUB_OIDC_ALLOWED_JOB_REFS=${GITHUB_OIDC_ALLOWED_JOB_REFS}
      - GITHUB_OIDC_ALLOWED_SUBS=${GITHUB_OIDC_ALLOWED_SUBS}
      # Anti-replay Redis dedicated DB (isolation from Bull DB 0)
      - REDIS_OIDC_DB_INDEX=${REDIS_OIDC_DB_INDEX:-1}
      # Legacy kill-switch (default true Phase 5, flip false post Phase 6 verified)
      - SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=${SITEMAP_LEGACY_INTERNAL_KEY_ENABLED:-true}
```

- [ ] **Step 2: Same for docker-compose.ci-deploy.yml**

Append identical block in the CI deploy compose.

- [ ] **Step 3: Update backend/.env local (no commit)**

Add to `backend/.env`:
```bash
GITHUB_OIDC_AUDIENCE=automecanik-sitemap-regen
GITHUB_OIDC_REPOSITORY=ak125/nestjs-remix-monorepo
GITHUB_OIDC_ALLOWED_EVENTS=schedule,workflow_dispatch
GITHUB_OIDC_ALLOWED_REFS=refs/heads/main
GITHUB_OIDC_ALLOWED_JOB_REFS=ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main
GITHUB_OIDC_ALLOWED_SUBS=repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main
REDIS_OIDC_DB_INDEX=1
SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=true
```

- [ ] **Step 4: Update PROD GitHub Secrets**

Via GitHub UI (Settings → Secrets and variables → Actions) confirm or add :
- `GITHUB_OIDC_ALLOWED_JOB_REFS=ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main`
- `GITHUB_OIDC_ALLOWED_SUBS=repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main`

Other vars use compose defaults (no secret required since not sensitive).

- [ ] **Step 5: Commit (compose only — no .env)**

```bash
git add docker-compose.prod.yml docker-compose.ci-deploy.yml
git commit -m "chore(auth): propagate GitHub OIDC + Redis OIDC DB env vars in PROD compose"
```

### Phase 0 verification

- [ ] **Step 1: Open PR-A0**

```bash
git push -u origin feat/seo-sitemap-auth-phase-0-foundation
gh pr create --base main --title "chore(auth): foundation deps + env + typing for sitemap regen OIDC" --body "$(cat <<'EOF'
## Summary
Phase 0/11 du plan sitemap regen auth (cf. \`docs/superpowers/plans/2026-05-16-sitemap-regen-auth-impl.md\`).

Foundation : deps (jose, cron-parser), Express Request typing, env schema propagated in compose.

Zero behavior change. Pre-req for PR-A1 (GithubOidcService).

## Test plan
- [x] \`tsc --noEmit\` PASS
- [x] \`npm ci\` PASS dans le container
- [x] PROD deploy DEV preprod : container boots OK (Sentry init + Bull init normal)
EOF
)"
```

---

# Phase 1 — GithubOidcService isolated (no anti-replay yet)

**PR title:** `feat(auth): add GithubOidcService for JWT validation (no anti-replay yet)`
**Branch:** `feat/seo-sitemap-auth-phase-1-oidc-service`
**Mergeable independently:** YES (service registered but not used by any guard yet)

### Task 1.1: Pre-PR-A1 — Collect actual GitHub OIDC claim format

**Files:**
- Create: `.github/workflows/test-oidc-claims.yml` (TEMPORARY — deleted in same PR after evidence)

- [ ] **Step 1: Write temporary introspection workflow**

Create `.github/workflows/test-oidc-claims.yml`:
```yaml
name: test-oidc-claims-introspect
on: { workflow_dispatch: }
permissions: { id-token: write, contents: read }
jobs:
  introspect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const token = await core.getIDToken('automecanik-sitemap-regen');
            const [, payload] = token.split('.');
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
            core.info(JSON.stringify(decoded, null, 2));
            core.setOutput('jti_present', !!decoded.jti);
            core.setOutput('sub', decoded.sub);
```

- [ ] **Step 2: Push and trigger via UI**

```bash
git add .github/workflows/test-oidc-claims.yml
git commit -m "chore(auth): temporary workflow to introspect GitHub OIDC claims"
git push -u origin feat/seo-sitemap-auth-phase-1-oidc-service
```

Then via GitHub UI: Actions → "test-oidc-claims-introspect" → "Run workflow" → branch `feat/seo-sitemap-auth-phase-1-oidc-service`.

- [ ] **Step 3: Capture evidence**

From workflow run log, copy the JSON payload. Save it to a comment in the eventual PR-A1 description for reference. Critical fields to confirm :
- `jti` present and unique
- `sub` format: `repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main`
- All 5 pinned claims present : `repository`, `event_name=workflow_dispatch`, `ref`, `job_workflow_ref`, `sub`

- [ ] **Step 4: Delete the temporary workflow**

```bash
git rm .github/workflows/test-oidc-claims.yml
git commit -m "chore(auth): remove temporary OIDC claims introspection workflow (evidence collected)"
```

### Task 1.2: GithubOidcService skeleton (claims only, no anti-replay)

**Files:**
- Create: `backend/src/auth/github-oidc.service.ts`
- Create: `backend/src/auth/github-oidc.service.test.ts`

- [ ] **Step 1: Write the failing test (claims happy path)**

Create `backend/src/auth/github-oidc.service.test.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { GithubOidcService } from './github-oidc.service';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import nock from 'nock';

const ISS = 'https://token.actions.githubusercontent.com';
const AUD = 'automecanik-sitemap-regen';

async function setupKeyAndJwks() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-kid-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  nock(ISS)
    .persist()
    .get('/.well-known/jwks')
    .reply(200, { keys: [jwk] });
  return { privateKey };
}

async function signClaims(privateKey: any, claims: Record<string, any>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' })
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime('10m')
    .setJti(`jti-${Math.random()}`)
    .sign(privateKey);
}

function makeService(overrides: Partial<Record<string, string>> = {}) {
  const env: Record<string, string> = {
    GITHUB_OIDC_AUDIENCE: AUD,
    GITHUB_OIDC_REPOSITORY: 'ak125/nestjs-remix-monorepo',
    GITHUB_OIDC_ALLOWED_EVENTS: 'schedule,workflow_dispatch',
    GITHUB_OIDC_ALLOWED_REFS: 'refs/heads/main',
    GITHUB_OIDC_ALLOWED_JOB_REFS: 'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
    GITHUB_OIDC_ALLOWED_SUBS: 'repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main',
    ...overrides,
  };
  return Test.createTestingModule({
    providers: [
      GithubOidcService,
      { provide: ConfigService, useValue: { get: (k: string, d?: string) => env[k] ?? d } },
    ],
  }).compile().then((m) => {
    const svc = m.get(GithubOidcService);
    svc.onModuleInit();
    return svc;
  });
}

const VALID_CLAIMS = {
  repository: 'ak125/nestjs-remix-monorepo',
  event_name: 'schedule',
  ref: 'refs/heads/main',
  workflow: 'sitemap-daily-regen',
  workflow_ref: 'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
  job_workflow_ref: 'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
  sub: 'repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main',
  run_id: '12345',
  actor: 'ak125',
  sha: 'abc123',
};

describe('GithubOidcService (claims validation)', () => {
  let privateKey: any;

  beforeAll(async () => {
    ({ privateKey } = await setupKeyAndJwks());
  });
  afterAll(() => nock.cleanAll());

  it('validates a fully-conformant JWT', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, VALID_CLAIMS);
    const claims = await svc.validate(token);
    expect(claims.repository).toBe('ak125/nestjs-remix-monorepo');
    expect(claims.sub).toBe(VALID_CLAIMS.sub);
  });

  it('rejects on repository mismatch', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, { ...VALID_CLAIMS, repository: 'evil/fork' });
    await expect(svc.validate(token)).rejects.toThrow(ForbiddenException);
  });

  it('rejects on event_name not in allow-list', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, { ...VALID_CLAIMS, event_name: 'push' });
    await expect(svc.validate(token)).rejects.toThrow(ForbiddenException);
  });

  it('rejects on ref not in allow-list', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, { ...VALID_CLAIMS, ref: 'refs/heads/dev' });
    await expect(svc.validate(token)).rejects.toThrow(ForbiddenException);
  });

  it('rejects on job_workflow_ref mismatch', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, { ...VALID_CLAIMS, job_workflow_ref: 'evil@refs/heads/main' });
    await expect(svc.validate(token)).rejects.toThrow(ForbiddenException);
  });

  it('rejects on sub mismatch (R1)', async () => {
    const svc = await makeService();
    const token = await signClaims(privateKey, { ...VALID_CLAIMS, sub: 'repo:evil:ref:refs/heads/main' });
    await expect(svc.validate(token)).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && NODE_OPTIONS='--max-old-space-size=4096' npx jest src/auth/github-oidc.service.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL with "Cannot find module './github-oidc.service'"

- [ ] **Step 3: Write the service implementation (claims-only, no anti-replay yet)**

Create `backend/src/auth/github-oidc.service.ts` per spec § Components > GithubOidcService — **BUT REMOVE** the `assertNotReplayed` call and the `redis` initialization. Replace with a comment `// Phase 4 will add Redis anti-replay here`. Keep `assertClaims`, `auditLog`, and the JWKS setup.

Full content:
```ts
import { Injectable, OnModuleInit, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export interface GithubOidcClaims extends JWTPayload {
  repository: string;
  repository_owner: string;
  event_name: string;
  ref: string;
  workflow: string;
  workflow_ref: string;
  job_workflow_ref: string;
  run_id: string;
  run_number: string;
  run_attempt: string;
  actor: string;
  sha: string;
}

@Injectable()
export class GithubOidcService implements OnModuleInit {
  private readonly logger = new Logger(GithubOidcService.name);
  private jwks!: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.jwks = createRemoteJWKSet(
      new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
    );
  }

  async validate(token: string): Promise<GithubOidcClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience: this.config.get<string>('GITHUB_OIDC_AUDIENCE'),
      clockTolerance: 30,
    });
    this.assertClaims(payload);
    // Phase 4 will add Redis anti-replay here:
    //   await this.assertNotReplayed(payload);
    this.auditLog(payload);
    return payload as GithubOidcClaims;
  }

  private assertClaims(p: JWTPayload): void {
    const repo = this.config.get<string>('GITHUB_OIDC_REPOSITORY');
    const allowedEvents = this.config.get<string>('GITHUB_OIDC_ALLOWED_EVENTS', 'schedule,workflow_dispatch').split(',');
    const allowedRefs = this.config.get<string>('GITHUB_OIDC_ALLOWED_REFS', 'refs/heads/main').split(',');
    const allowedJobRefs = this.config.get<string>('GITHUB_OIDC_ALLOWED_JOB_REFS', '').split(',').filter(Boolean);
    const allowedSubs = this.config.get<string>('GITHUB_OIDC_ALLOWED_SUBS', '').split(',').filter(Boolean);

    if (p.repository !== repo) throw new ForbiddenException('claim repository mismatch');
    if (!allowedEvents.includes(p.event_name as string)) throw new ForbiddenException('claim event_name not allowed');
    if (!allowedRefs.includes(p.ref as string)) throw new ForbiddenException('claim ref not allowed');
    if (allowedJobRefs.length && !allowedJobRefs.includes(p.job_workflow_ref as string)) {
      throw new ForbiddenException('claim job_workflow_ref not allowed');
    }
    if (allowedSubs.length && !allowedSubs.includes(p.sub as string)) {
      throw new ForbiddenException('claim sub not allowed');
    }
  }

  private auditLog(p: JWTPayload): void {
    this.logger.log({
      event: 'github_oidc_auth_success',
      repository: p.repository,
      workflow: p.workflow,
      job_workflow_ref: p.job_workflow_ref,
      event_name: p.event_name,
      ref: p.ref,
      sub: p.sub,
      run_id: p.run_id,
      run_attempt: p.run_attempt,
      actor: p.actor,
      sha: p.sha,
      jti: p.jti,
    });
  }
}
```

- [ ] **Step 4: Run tests — expect ALL PASS**

Run: `cd backend && NODE_OPTIONS='--max-old-space-size=4096' npx jest src/auth/github-oidc.service.test.ts --no-coverage 2>&1 | tail -20`
Expected: `Tests: 6 passed, 6 total`

- [ ] **Step 5: Register service in AuthModule**

Modify `backend/src/auth/auth.module.ts` `providers` array — add `GithubOidcService`. Also add to `exports`:
```ts
providers: [..., GithubOidcService],
exports: [AuthService, PermissionsService, PermissionsGuard, GithubOidcService],
```
Import at top of file:
```ts
import { GithubOidcService } from './github-oidc.service';
```

- [ ] **Step 6: Typecheck**

Run: `cd backend && NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"`
Expected: `0`

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/github-oidc.service.ts backend/src/auth/github-oidc.service.test.ts backend/src/auth/auth.module.ts
git commit -m "feat(auth): add GithubOidcService for JWT validation with 5 pinned claims"
```

### Phase 1 verification

- [ ] **Open PR-A1**

```bash
git push -u origin feat/seo-sitemap-auth-phase-1-oidc-service
gh pr create --base main --title "feat(auth): add GithubOidcService for JWT validation (claims only)" --body "Phase 1/11 — GithubOidcService standalone with 5 pinned claims validation (repository, event_name, ref, job_workflow_ref, sub). No anti-replay yet (Phase 4). Service registered in AuthModule, no guard wired yet. Includes evidence from test-oidc-claims-introspect (workflow shipped + removed in same PR)."
```

- [ ] **Wait for CI green + merge**

---

# Phase 2 — AnyOf factory + AdminSessionGuard + GithubOidcGuard

**PR title:** `feat(auth): add AnyOf composite + AdminSessionGuard + GithubOidcGuard`
**Branch:** `feat/seo-sitemap-auth-phase-2-guards-core`
**Depends on:** Phase 1 merged
**Mergeable independently:** YES (guards created but not wired to controllers yet)

### Task 2.1: AnyOf factory mixin

**Files:**
- Create: `backend/src/auth/any-of.guard.ts`
- Create: `backend/src/auth/any-of.guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/any-of.guard.test.ts`:
```ts
import { Test } from '@nestjs/testing';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AnyOf } from './any-of.guard';

function ctx(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({}) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

@Injectable()
class AlwaysOk implements CanActivate { canActivate() { return true; } }
@Injectable()
class AlwaysThrow implements CanActivate { canActivate(): boolean { throw new UnauthorizedException('A'); } }
@Injectable()
class AlwaysThrowB implements CanActivate { canActivate(): boolean { throw new UnauthorizedException('B'); } }

async function build(...guards: any[]) {
  const Composite = AnyOf(...guards);
  const moduleRef = await Test.createTestingModule({
    providers: [Composite, ...guards],
  }).compile();
  return moduleRef.get(Composite);
}

describe('AnyOf composite guard', () => {
  it('returns true when first guard accepts (short-circuit)', async () => {
    const g = await build(AlwaysOk, AlwaysThrow);
    expect(await g.canActivate(ctx())).toBe(true);
  });

  it('returns true when second guard accepts after first throws', async () => {
    const g = await build(AlwaysThrow, AlwaysOk);
    expect(await g.canActivate(ctx())).toBe(true);
  });

  it('throws first guards error when all throw', async () => {
    const g = await build(AlwaysThrow, AlwaysThrowB);
    await expect(g.canActivate(ctx())).rejects.toMatchObject({ message: 'A' });
  });

  it('throws UnauthorizedException when guards list empty', async () => {
    const g = await build();
    await expect(g.canActivate(ctx())).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd backend && npx jest src/auth/any-of.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL "Cannot find module './any-of.guard'"

- [ ] **Step 3: Implement AnyOf**

Create `backend/src/auth/any-of.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, Logger, Type, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export function AnyOf(...guards: Type<CanActivate>[]): Type<CanActivate> {
  @Injectable()
  class CompositeGuard implements CanActivate {
    private readonly logger = new Logger('AnyOfGuard');
    constructor(private readonly moduleRef: ModuleRef) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
      const errors: Array<{ name: string; err: Error }> = [];
      for (const G of guards) {
        const instance = this.moduleRef.get(G, { strict: false });
        try {
          if (await instance.canActivate(ctx)) return true;
        } catch (err) {
          errors.push({ name: G.name, err: err as Error });
        }
      }
      this.logger.warn(`All auth paths rejected: ${errors.map((e) => e.name).join(', ')}`);
      throw errors[0]?.err ?? new UnauthorizedException('No auth method matched');
    }
  }
  return CompositeGuard;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/auth/any-of.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/any-of.guard.ts backend/src/auth/any-of.guard.test.ts
git commit -m "feat(auth): add AnyOf composite guard factory mixin"
```

### Task 2.2: AdminSessionGuard

**Files:**
- Create: `backend/src/auth/admin-session.guard.ts`
- Create: `backend/src/auth/admin-session.guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/admin-session.guard.test.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminSessionGuard } from './admin-session.guard';

function makeCtx(user?: any): ExecutionContext {
  const req: any = { user, method: 'POST', url: '/test', headers: {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('AdminSessionGuard', () => {
  let g: AdminSessionGuard;
  beforeEach(async () => {
    const m = await Test.createTestingModule({ providers: [AdminSessionGuard] }).compile();
    g = m.get(AdminSessionGuard);
  });

  it('accepts isAdmin=true', () => {
    expect(g.canActivate(makeCtx({ isAdmin: true, level: 0 }))).toBe(true);
  });
  it('accepts numeric level >=7', () => {
    expect(g.canActivate(makeCtx({ level: 7 }))).toBe(true);
  });
  it('accepts string level >=7 (legacy MD5)', () => {
    expect(g.canActivate(makeCtx({ level: '9' }))).toBe(true);
  });
  it('rejects level<7', () => {
    expect(() => g.canActivate(makeCtx({ level: 3 }))).toThrow(UnauthorizedException);
  });
  it('rejects no user', () => {
    expect(() => g.canActivate(makeCtx(undefined))).toThrow(UnauthorizedException);
  });
  it('writes _authPath=admin-session on success', () => {
    const ctx = makeCtx({ isAdmin: true });
    g.canActivate(ctx);
    const req = (ctx.switchToHttp().getRequest() as any);
    expect(req._authPath).toBe('admin-session');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest src/auth/admin-session.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL "Cannot find module"

- [ ] **Step 3: Implement**

Create `backend/src/auth/admin-session.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  private readonly logger = new Logger(AdminSessionGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException('Authentication required');
    const isAdmin = req.user.isAdmin === true || parseInt(String(req.user.level || 0), 10) >= 7;
    if (!isAdmin) {
      this.logger.warn(`Admin denied: ${req.user.email || 'anonymous'} on ${req.method} ${req.url}`);
      throw new UnauthorizedException('Admin level required');
    }
    req._authPath = 'admin-session';
    return true;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/auth/admin-session.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: `Tests: 6 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/admin-session.guard.ts backend/src/auth/admin-session.guard.test.ts
git commit -m "feat(auth): add AdminSessionGuard (atomic, cookie + level>=7)"
```

### Task 2.3: GithubOidcGuard (atomic, no fallback)

**Files:**
- Create: `backend/src/auth/github-oidc.guard.ts`
- Create: `backend/src/auth/github-oidc.guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/github-oidc.guard.test.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GithubOidcGuard } from './github-oidc.guard';
import { GithubOidcService } from './github-oidc.service';

function makeCtx(headers: Record<string, string>): ExecutionContext {
  const req: any = { headers, method: 'POST', url: '/test' };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

const VALID_CLAIMS = { repository: 'ak125/nestjs-remix-monorepo', sub: 'xxx' } as any;

describe('GithubOidcGuard (atomic, no fallback)', () => {
  let g: GithubOidcGuard;
  let oidc: { validate: jest.Mock };

  beforeEach(async () => {
    oidc = { validate: jest.fn() };
    const m = await Test.createTestingModule({
      providers: [
        GithubOidcGuard,
        { provide: GithubOidcService, useValue: oidc },
      ],
    }).compile();
    g = m.get(GithubOidcGuard);
  });

  it('throws when Authorization header missing', async () => {
    await expect(g.canActivate(makeCtx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws when Authorization not Bearer scheme', async () => {
    await expect(g.canActivate(makeCtx({ authorization: 'Basic foo' }))).rejects.toThrow(UnauthorizedException);
  });

  it('accepts Bearer token + writes _authPath + _authClaims', async () => {
    oidc.validate.mockResolvedValue(VALID_CLAIMS);
    const ctx = makeCtx({ authorization: 'Bearer abc.def.ghi' });
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    const req = (ctx.switchToHttp().getRequest() as any);
    expect(req._authPath).toBe('github-oidc');
    expect(req._authClaims).toBe(VALID_CLAIMS);
    expect(oidc.validate).toHaveBeenCalledWith('abc.def.ghi');
  });

  it('propagates service validate() error (fail-closed, no fallback)', async () => {
    const err = new UnauthorizedException('bad sig');
    oidc.validate.mockRejectedValue(err);
    await expect(g.canActivate(makeCtx({ authorization: 'Bearer x' }))).rejects.toBe(err);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest src/auth/github-oidc.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL "Cannot find module"

- [ ] **Step 3: Implement**

Create `backend/src/auth/github-oidc.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GithubOidcService } from './github-oidc.service';

@Injectable()
export class GithubOidcGuard implements CanActivate {
  constructor(private readonly oidc: GithubOidcService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const claims = await this.oidc.validate(auth.slice(7));
    req._authPath = 'github-oidc';
    req._authClaims = claims;
    return true;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/auth/github-oidc.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: `Tests: 4 passed`

- [ ] **Step 5: Register in AuthModule providers**

In `backend/src/auth/auth.module.ts`, add `GithubOidcGuard`, `AdminSessionGuard`, `AnyOf` related — actually `AnyOf` is a factory, not a class, so it's not directly a provider. Just add the two guards:
```ts
providers: [..., AdminSessionGuard, GithubOidcGuard, GithubOidcService],
exports: [..., AdminSessionGuard, GithubOidcGuard, GithubOidcService],
```

- [ ] **Step 6: Typecheck + final test sweep**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"` → expect `0`
Run: `npx jest src/auth/ --no-coverage 2>&1 | tail -5` → expect all guards green

- [ ] **Step 7: Commit + PR**

```bash
git add backend/src/auth/github-oidc.guard.ts backend/src/auth/github-oidc.guard.test.ts backend/src/auth/auth.module.ts
git commit -m "feat(auth): add GithubOidcGuard (atomic Bearer-only, fail-closed)"
git push -u origin feat/seo-sitemap-auth-phase-2-guards-core
gh pr create --base main --title "feat(auth): AnyOf + AdminSessionGuard + GithubOidcGuard (atomic guards)" --body "Phase 2/11 — 2 atomic guards + AnyOf factory. Not wired to controllers yet (Phase 5)."
```

---

# Phase 3 — LegacyInternalKeyGuard wrapper

**PR title:** `feat(auth): add LegacyInternalKeyGuard with kill-switch + Sentry deprecation telemetry`
**Branch:** `feat/seo-sitemap-auth-phase-3-legacy-wrapper`
**Depends on:** Phase 2 merged
**Mergeable independently:** YES (guard created but not wired)

### Task 3.1: LegacyInternalKeyGuard

**Files:**
- Create: `backend/src/auth/legacy-internal-key.guard.ts`
- Create: `backend/src/auth/legacy-internal-key.guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/legacy-internal-key.guard.test.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { LegacyInternalKeyGuard } from './legacy-internal-key.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs', () => ({ captureMessage: jest.fn() }));

function makeCtx(headers: Record<string, string>): ExecutionContext {
  const req: any = { headers, method: 'POST', url: '/api/sitemap/v10/generate-all' };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('LegacyInternalKeyGuard', () => {
  let g: LegacyInternalKeyGuard;
  let internal: { canActivate: jest.Mock };
  let configValues: Record<string, string>;

  beforeEach(async () => {
    (Sentry.captureMessage as jest.Mock).mockClear();
    internal = { canActivate: jest.fn() };
    configValues = { SITEMAP_LEGACY_INTERNAL_KEY_ENABLED: 'true' };
    const m = await Test.createTestingModule({
      providers: [
        LegacyInternalKeyGuard,
        { provide: InternalApiKeyGuard, useValue: internal },
        { provide: ConfigService, useValue: { get: (k: string) => configValues[k] } },
      ],
    }).compile();
    g = m.get(LegacyInternalKeyGuard);
  });

  it('rejects when header absent', async () => {
    await expect(g.canActivate(makeCtx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when kill-switch is OFF (env=false)', async () => {
    configValues.SITEMAP_LEGACY_INTERNAL_KEY_ENABLED = 'false';
    await expect(g.canActivate(makeCtx({ 'x-internal-key': 'k' }))).rejects.toThrow(UnauthorizedException);
    expect(internal.canActivate).not.toHaveBeenCalled();
  });

  it('rejects when kill-switch is UNSET (treated as false)', async () => {
    delete configValues.SITEMAP_LEGACY_INTERNAL_KEY_ENABLED;
    await expect(g.canActivate(makeCtx({ 'x-internal-key': 'k' }))).rejects.toThrow(UnauthorizedException);
  });

  it('delegates to InternalApiKeyGuard when kill-switch=true', async () => {
    internal.canActivate.mockResolvedValue(true);
    const ctx = makeCtx({ 'x-internal-key': 'k' });
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    expect(internal.canActivate).toHaveBeenCalled();
    const req = (ctx.switchToHttp().getRequest() as any);
    expect(req._authPath).toBe('internal-key-legacy');
  });

  it('captures Sentry deprecation message on success', async () => {
    internal.canActivate.mockResolvedValue(true);
    await g.canActivate(makeCtx({ 'x-internal-key': 'k' }));
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'legacy_auth_used',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ deprecation: 'PR-E' }),
      }),
    );
  });

  it('does not capture Sentry when InternalApiKeyGuard rejects', async () => {
    internal.canActivate.mockResolvedValue(false);
    const ctx = makeCtx({ 'x-internal-key': 'k' });
    await expect(g.canActivate(ctx)).resolves.toBe(false);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest src/auth/legacy-internal-key.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL "Cannot find module"

- [ ] **Step 3: Implement**

Create `backend/src/auth/legacy-internal-key.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@Injectable()
export class LegacyInternalKeyGuard implements CanActivate {
  private readonly logger = new Logger(LegacyInternalKeyGuard.name);

  constructor(
    private readonly internal: InternalApiKeyGuard,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.headers['x-internal-key']) {
      throw new UnauthorizedException('x-internal-key header required');
    }
    if (this.config.get('SITEMAP_LEGACY_INTERNAL_KEY_ENABLED') !== 'true') {
      this.logger.warn(`X-Internal-Key disabled by kill-switch on ${req.url}`);
      throw new UnauthorizedException('Legacy auth disabled — migrate to OIDC');
    }
    const ok = await this.internal.canActivate(ctx);
    if (!ok) return false;

    this.logger.warn(`LEGACY auth path used on ${req.url} — migrate to OIDC`);
    Sentry.captureMessage('legacy_auth_used', {
      level: 'warning',
      tags: {
        endpoint: req.url,
        method: req.method,
        deprecation: 'PR-E',
      },
    });
    req._authPath = 'internal-key-legacy';
    return true;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/auth/legacy-internal-key.guard.test.ts --no-coverage 2>&1 | tail -10`
Expected: `Tests: 6 passed`

- [ ] **Step 5: Register in AuthModule**

Add `LegacyInternalKeyGuard` and `InternalApiKeyGuard` (if not already) to `auth.module.ts` providers + exports.

- [ ] **Step 6: Commit + PR**

```bash
git add backend/src/auth/legacy-internal-key.guard.ts backend/src/auth/legacy-internal-key.guard.test.ts backend/src/auth/auth.module.ts
git commit -m "feat(auth): add LegacyInternalKeyGuard wrapper with kill-switch + Sentry telemetry"
git push -u origin feat/seo-sitemap-auth-phase-3-legacy-wrapper
gh pr create --base main --title "feat(auth): LegacyInternalKeyGuard wrapper (Phase 3)" --body "Phase 3/11 — atomic legacy wrapper for X-Internal-Key, gated by SITEMAP_LEGACY_INTERNAL_KEY_ENABLED env. Sentry captures deprecation tag PR-E on every accept. Not wired to controllers yet."
```

---

# Phase 4 — Add Redis anti-replay to GithubOidcService

**PR title:** `feat(auth): add jti anti-replay to GithubOidcService (dedicated Redis client)`
**Branch:** `feat/seo-sitemap-auth-phase-4-antireplay`
**Depends on:** Phase 1 merged
**Mergeable independently:** YES (extends existing service, no behavior change on consumers)

### Task 4.1: Extend GithubOidcService with assertNotReplayed

**Files:**
- Modify: `backend/src/auth/github-oidc.service.ts`
- Modify: `backend/src/auth/github-oidc.service.test.ts`

- [ ] **Step 1: Add failing tests for anti-replay**

Append to `backend/src/auth/github-oidc.service.test.ts`:
```ts
import Redis from 'ioredis-mock';

describe('GithubOidcService — anti-replay (Phase 4)', () => {
  let privateKey: any;
  let redisMock: any;

  beforeAll(async () => {
    ({ privateKey } = await setupKeyAndJwks());
  });

  beforeEach(() => {
    redisMock = new Redis();
  });

  async function makeServiceWithRedis() {
    const env: Record<string, string> = {
      GITHUB_OIDC_AUDIENCE: AUD,
      GITHUB_OIDC_REPOSITORY: 'ak125/nestjs-remix-monorepo',
      GITHUB_OIDC_ALLOWED_EVENTS: 'schedule',
      GITHUB_OIDC_ALLOWED_REFS: 'refs/heads/main',
      GITHUB_OIDC_ALLOWED_JOB_REFS: VALID_CLAIMS.job_workflow_ref,
      GITHUB_OIDC_ALLOWED_SUBS: VALID_CLAIMS.sub,
      REDIS_OIDC_DB_INDEX: '1',
    };
    const m = await Test.createTestingModule({
      providers: [
        GithubOidcService,
        { provide: ConfigService, useValue: { get: (k: string, d?: string) => env[k] ?? d } },
      ],
    }).compile();
    const svc: any = m.get(GithubOidcService);
    svc.redis = redisMock; // inject mock instead of real ioredis
    svc.onModuleInit();
    return svc as GithubOidcService;
  }

  it('accepts a fresh jti', async () => {
    const svc = await makeServiceWithRedis();
    const token = await signClaims(privateKey, VALID_CLAIMS);
    await expect(svc.validate(token)).resolves.toBeDefined();
  });

  it('rejects replay of same jti', async () => {
    const svc = await makeServiceWithRedis();
    const claims = { ...VALID_CLAIMS };
    // Sign two distinct tokens with same jti via custom signer
    const sameJti = `replay-${Math.random()}`;
    const t1 = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' })
      .setIssuer(ISS).setAudience(AUD).setIssuedAt()
      .setExpirationTime('10m').setJti(sameJti).sign(privateKey);
    const t2 = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' })
      .setIssuer(ISS).setAudience(AUD).setIssuedAt()
      .setExpirationTime('10m').setJti(sameJti).sign(privateKey);

    await expect(svc.validate(t1)).resolves.toBeDefined();
    await expect(svc.validate(t2)).rejects.toThrow('token already used');
  });

  it('rejects missing jti claim', async () => {
    const svc = await makeServiceWithRedis();
    const claims = { ...VALID_CLAIMS };
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' })
      .setIssuer(ISS).setAudience(AUD).setIssuedAt()
      .setExpirationTime('10m').sign(privateKey); // no setJti

    await expect(svc.validate(token)).rejects.toThrow('missing jti claim');
  });
});
```

- [ ] **Step 2: Install ioredis-mock for tests**

Run: `cd backend && npm install --save-dev ioredis-mock`

- [ ] **Step 3: Run failing test**

Run: `npx jest src/auth/github-oidc.service.test.ts --no-coverage 2>&1 | tail -15`
Expected: 3 new tests FAIL (assertNotReplayed not yet wired)

- [ ] **Step 4: Modify the service to add Redis + assertNotReplayed**

Edit `backend/src/auth/github-oidc.service.ts`. Add at top of imports:
```ts
import Redis from 'ioredis';
import * as Sentry from '@sentry/nestjs';
```

Add to class — new constructor body:
```ts
  private redis!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.jwks = createRemoteJWKSet(
      new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
    );
    // M2 — Redis client DEDICATED for anti-replay (isolation from Bull DB 0)
    if (!this.redis) {
      this.redis = new Redis({
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: +this.config.get<string>('REDIS_PORT', '6379'),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        db: +this.config.get<string>('REDIS_OIDC_DB_INDEX', '1'),
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
      void this.redis.connect().catch((err) => {
        this.logger.error(`Redis OIDC anti-replay connect failed: ${err.message}`);
      });
    }
  }
```

Replace `validate()` body — uncomment the assertNotReplayed line:
```ts
  async validate(token: string): Promise<GithubOidcClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience: this.config.get<string>('GITHUB_OIDC_AUDIENCE'),
      clockTolerance: 30,
    });
    this.assertClaims(payload);
    await this.assertNotReplayed(payload);
    this.auditLog(payload);
    return payload as GithubOidcClaims;
  }
```

Add new method:
```ts
  private async assertNotReplayed(p: JWTPayload): Promise<void> {
    if (!p.jti) throw new UnauthorizedException('missing jti claim');
    const ttl = Math.ceil(Math.max(60, (p.exp! * 1000 - Date.now()) / 1000) + 60);
    const ok = await this.redis.set(`oidc:jti:${p.jti}`, '1', 'EX', ttl, 'NX');
    if (ok !== 'OK') {
      this.logger.error(`Token replay detected: jti=${p.jti} repo=${p.repository}`);
      Sentry.captureMessage('oidc_token_replay', {
        level: 'error',
        tags: { jti: String(p.jti), repository: String(p.repository) },
      });
      throw new UnauthorizedException('token already used');
    }
  }
```

- [ ] **Step 5: Run all tests — expect PASS**

Run: `npx jest src/auth/github-oidc.service.test.ts --no-coverage 2>&1 | tail -15`
Expected: all 9 tests pass (6 from Phase 1 + 3 new).

- [ ] **Step 6: Commit + PR**

```bash
git add backend/src/auth/github-oidc.service.ts backend/src/auth/github-oidc.service.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(auth): add jti anti-replay via dedicated Redis client (DB 1)"
git push -u origin feat/seo-sitemap-auth-phase-4-antireplay
gh pr create --base main --title "feat(auth): jti anti-replay in GithubOidcService (Phase 4)" --body "Phase 4/11 — Dedicated Redis client (DB 1, isolated from Bull DB 0). SETNX TTL dynamique = exp+60s. Tests: replay rejected, missing jti rejected, fresh jti accepted."
```

---

# Phase 5 — Controller protection migration (4 sitemap controllers)

**PR title:** `fix(security): apply AnyOf(AdminSession, GithubOidc, LegacyInternalKey) to sitemap write endpoints`
**Branch:** `feat/seo-sitemap-auth-phase-5-controllers`
**Depends on:** Phases 1, 2, 3, 4 all merged
**Mergeable independently:** YES — this is the "production cutover" PR

### Task 5.1: Apply AnyOf composite to 4 controllers

**Files:**
- Modify: `backend/src/modules/seo/controllers/sitemap-v10.controller.ts`
- Modify: `backend/src/modules/seo/controllers/sitemap-unified.controller.ts`
- Modify: `backend/src/modules/seo/controllers/sitemap-streaming.controller.ts`
- Modify: `backend/src/modules/seo/controllers/sitemap-delta.controller.ts`
- Modify: `backend/src/modules/seo/seo.module.ts`

- [ ] **Step 1: Update sitemap-v10.controller.ts — replace existing AdminOrInternalKeyGuard import**

Edit `backend/src/modules/seo/controllers/sitemap-v10.controller.ts`:
- Remove import line: `import { AdminOrInternalKeyGuard } from '../../../auth/admin-or-internal-key.guard';`
- Add imports:
```ts
import { AdminSessionGuard } from '../../../auth/admin-session.guard';
import { GithubOidcGuard } from '../../../auth/github-oidc.guard';
import { LegacyInternalKeyGuard } from '../../../auth/legacy-internal-key.guard';
import { AnyOf } from '../../../auth/any-of.guard';
```
- Replace every occurrence of `@UseGuards(AdminOrInternalKeyGuard)` with:
```ts
@UseGuards(AnyOf(AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard))
```
- 6 occurrences (lines around 46, 109, 161, 203, 261, 371 per spec).

- [ ] **Step 2: Same for sitemap-unified.controller.ts**

1 occurrence of `@UseGuards(AdminOrInternalKeyGuard)` to replace (on `@Post('generate-all')`).

- [ ] **Step 3: Same for sitemap-streaming.controller.ts**

2 occurrences (`@Post('generate')` and `@Post('cleanup')`).

- [ ] **Step 4: Same for sitemap-delta.controller.ts**

2 occurrences (`@Post('generate')` and `@Post('cleanup')`).

- [ ] **Step 5: Register guards in seo.module.ts providers (so AnyOf can resolve via ModuleRef)**

Edit `backend/src/modules/seo/seo.module.ts`:
- Add imports at top (or wherever auth imports go):
```ts
import { AdminSessionGuard } from '../../auth/admin-session.guard';
import { GithubOidcGuard } from '../../auth/github-oidc.guard';
import { LegacyInternalKeyGuard } from '../../auth/legacy-internal-key.guard';
import { GithubOidcService } from '../../auth/github-oidc.service';
import { InternalApiKeyGuard } from '../../auth/internal-api-key.guard';
```
- Add to `providers` array:
```ts
    // Auth guards needed by AnyOf composite on sitemap controllers (Phase 5)
    AdminSessionGuard,
    GithubOidcGuard,
    LegacyInternalKeyGuard,
    GithubOidcService,
    InternalApiKeyGuard,
```

- [ ] **Step 6: Remove old AdminOrInternalKeyGuard file (created in PR-A v1)**

```bash
git rm backend/src/auth/admin-or-internal-key.guard.ts
git rm backend/src/auth/admin-or-internal-key.guard.test.ts
```

- [ ] **Step 7: Typecheck + run all auth tests**

Run: `cd backend && NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"` → expect `0`
Run: `npx jest src/auth/ --no-coverage 2>&1 | tail -10` → expect all green

- [ ] **Step 8: Manual smoke test against local DEV backend**

```bash
# Anonymous → expect 401
curl -sI -X POST http://localhost:3000/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/1.1 401

# With valid INTERNAL_API_KEY (kill-switch ON) → expect 201 + Sentry deprecation log
curl -sI -X POST -H "X-Internal-Key: $INTERNAL_API_KEY" http://localhost:3000/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/1.1 201

# With bad Bearer → expect 401
curl -sI -X POST -H "Authorization: Bearer invalid.jwt.here" http://localhost:3000/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/1.1 401
```

- [ ] **Step 9: Commit + PR**

```bash
git add backend/src/modules/seo/controllers/sitemap-v10.controller.ts \
        backend/src/modules/seo/controllers/sitemap-unified.controller.ts \
        backend/src/modules/seo/controllers/sitemap-streaming.controller.ts \
        backend/src/modules/seo/controllers/sitemap-delta.controller.ts \
        backend/src/modules/seo/seo.module.ts
git commit -m "fix(security): migrate sitemap write endpoints to AnyOf(AdminSession,GithubOidc,LegacyInternalKey)"
git push -u origin feat/seo-sitemap-auth-phase-5-controllers
gh pr create --base main --title "fix(security): production cutover — sitemap write endpoints to 3-path AnyOf auth" --body "$(cat <<'EOF'
## Production cutover
Phase 5/11 — Application des 3 guards atomiques (AdminSession + GithubOidc + LegacyInternalKey) sur 11 endpoints @Post de 4 controllers sitemap. Supprime AdminOrInternalKeyGuard de PR-A v1 (mono-composite remplacé par AnyOf 3-paths).

## Test plan
- [x] tsc PASS
- [x] All auth unit tests green
- [x] Local smoke : anon → 401, X-Internal-Key → 201, bad Bearer → 401
- [ ] Post-merge PROD smoke (3 checks ci-dessus contre https://www.automecanik.com)
- [ ] Sentry alert "legacy_auth_used" visible dans 1h post-deploy si caller utilise X-Internal-Key

## Rollback
git revert <commit> + tag PROD si 5xx burst détecté.
EOF
)"
```

---

# Phase 6 — GitHub Action OIDC daily regen workflow

**PR title:** `feat(seo): GitHub Action OIDC daily sitemap regen + workflow_dispatch admin manual`
**Branch:** `feat/seo-sitemap-auth-phase-6-workflow`
**Depends on:** Phase 5 merged + deployed PROD
**Mergeable independently:** YES (workflow can be created anytime, only runs at 03:00 UTC or on manual dispatch)

### Task 6.1: Create sitemap-daily-regen workflow

**Files:**
- Create: `.github/workflows/sitemap-daily-regen.yml`

- [ ] **Step 1: Write workflow file**

Create `.github/workflows/sitemap-daily-regen.yml` (full content per spec § Components > GitHub Action workflow — copied verbatim):
```yaml
name: sitemap-daily-regen
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:
permissions:
  id-token: write
  contents: read
  issues: write
concurrency:
  group: sitemap-daily-regen
  cancel-in-progress: false
jobs:
  regen:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Get OIDC token
        id: oidc
        uses: actions/github-script@v7
        with:
          script: |
            const token = await core.getIDToken('automecanik-sitemap-regen');
            core.setSecret(token);
            core.setOutput('token', token);

      - name: Trigger sitemap regen
        run: |
          curl -fsSL -X POST \
            --max-time 600 \
            --retry 2 --retry-delay 10 \
            --retry-connrefused \
            -H "Authorization: Bearer ${{ steps.oidc.outputs.token }}" \
            -H "User-Agent: AutoMecanikSitemapRegen/1.0 (+https://github.com/${{ github.repository }})" \
            https://www.automecanik.com/api/sitemap/v10/generate-all

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Sitemap regen failed - ${new Date().toISOString().slice(0,10)}`,
              labels: ['incident-sitemap-cron'],
              body: `Workflow run: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}\n\nEvent: ${context.eventName}\nActor: ${context.actor}`,
            });
```

- [ ] **Step 2: Verify YAML syntax locally**

Run: `cd /opt/automecanik/app && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/sitemap-daily-regen.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit + PR**

```bash
git add .github/workflows/sitemap-daily-regen.yml
git commit -m "feat(seo): GitHub Action OIDC daily sitemap regen (zero long-lived secret)"
git push -u origin feat/seo-sitemap-auth-phase-6-workflow
gh pr create --base main --title "feat(seo): GitHub Action OIDC daily sitemap regen workflow" --body "$(cat <<'EOF'
## Summary
Phase 6/11 — Workflow cron daily 03:00 UTC + manual workflow_dispatch (admin ops via GitHub UI). OIDC token (10min exp), audience automecanik-sitemap-regen, claims pinned côté backend.

## Pre-req
- [x] Phase 5 deployed PROD : endpoint /api/sitemap/v10/generate-all accepte Bearer JWT validés OIDC

## Test plan
- [ ] Workflow_dispatch run manual via GitHub UI (Actions → sitemap-daily-regen → Run workflow → main branch)
- [ ] Sitemap.xml last-modified updates to current date within 60s of run completion
- [ ] Sentry breadcrumb github_oidc_auth_success visible
- [ ] Next scheduled run at 03:00 UTC fires automatically
- [ ] Failure simulation (intentional invalid claim) → issue auto-created with label incident-sitemap-cron
EOF
)"
```

### Task 6.2: Verify in PROD post-merge

- [ ] **Step 1: Trigger workflow_dispatch manuellement via GitHub UI**

Actions → "sitemap-daily-regen" → "Run workflow" → branch `main` → green button.

- [ ] **Step 2: Verify sitemap freshness**

```bash
sleep 60
curl -sI https://www.automecanik.com/sitemap.xml | grep -i last-modified
# Expected: today's date
curl -sL https://www.automecanik.com/sitemap-pieces-1.xml | head -5 | grep lastmod
# Expected: <lastmod>YYYY-MM-DD</lastmod> = today
```

- [ ] **Step 3: Flip kill-switch (post 24h verification)**

After 24h with successful daily cron + zero Sentry `legacy_auth_used` from external callers, flip in PROD env:
```bash
ssh prod-automecanik 'docker compose exec backend bash -c "echo SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=false >> /tmp/env-update && docker compose restart backend"'
```
(or via Hetzner console if SSH refused — adapt to actual ops path)

---

# Phase 7 — Heartbeat scheduler observability

**PR title:** `feat(seo): heartbeat-based worker observability for sitemap scheduler`
**Branch:** `feat/seo-sitemap-auth-phase-7-heartbeat`
**Depends on:** Phase 0 merged (ioredis available)
**Mergeable independently:** YES (no behavior change on existing endpoints, just adds Redis key)

### Task 7.1: Add heartbeat + lifecycle logs to SitemapV10SchedulerService

**Files:**
- Modify: `backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts`

- [ ] **Step 1: Read current state**

```bash
sed -n '1,50p' backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts
```
Confirm imports of `Injectable, Logger, OnModuleInit`, `InjectQueue`, `Queue`. Current `onModuleInit` is `void` returning.

- [ ] **Step 2: Modify service — add OnModuleDestroy + heartbeat**

Edit imports at top of `sitemap-v10-scheduler.service.ts`:
```ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as os from 'node:os';
import Redis from 'ioredis';
```

Update class signature:
```ts
export class SitemapV10SchedulerService implements OnModuleInit, OnModuleDestroy {
```

Add private fields:
```ts
  private readonly heartbeatKey = `worker:seo-monitor:heartbeat:${process.pid}`;
  private readonly startedAt = new Date();
  private heartbeatTimer?: NodeJS.Timeout;
  private redis?: Redis;
```

Modify `onModuleInit` (preserving existing logic) :
```ts
  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('SEO_SITEMAP_CRON_ENABLED=false — sitemap regeneration scheduler skipped');
      return;
    }
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: +this.configService.get<string>('REDIS_PORT', '6379'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: +this.configService.get<string>('REDIS_OIDC_DB_INDEX', '1'),
    });

    this.logger.log({
      event: 'sitemap_scheduler_worker_online',
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      bullVersion: '4.16.5',
      cron: this.getCron(),
      timezone: 'UTC',
      startedAt: this.startedAt.toISOString(),
    });

    void this.configureRepeatableJob();
    this.heartbeatTimer = setInterval(() => void this.writeHeartbeat(), 30_000);
    void this.writeHeartbeat();
  }
```

Add new method `onModuleDestroy`:
```ts
  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.logger.log({
      event: 'sitemap_scheduler_worker_offline',
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      reason: 'shutdown',
    });
    if (this.redis) {
      await this.redis.del(this.heartbeatKey).catch(() => undefined);
      await this.redis.quit().catch(() => undefined);
    }
  }
```

Add `writeHeartbeat` method:
```ts
  private async writeHeartbeat(): Promise<void> {
    if (!this.redis) return;
    const payload = {
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      bullVersion: '4.16.5',
      startedAt: this.startedAt.toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
    };
    await this.redis.set(this.heartbeatKey, JSON.stringify(payload), 'EX', 60).catch((err) => {
      this.logger.error(`Heartbeat write failed: ${err.message}`);
    });
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"` → expect `0`

- [ ] **Step 4: Manual smoke test (local DEV)**

```bash
# Start dev server, wait 5s
# Check Redis DB 1
docker compose exec redis redis-cli -n 1 KEYS 'worker:seo-monitor:heartbeat:*'
# Expected: 1 key
docker compose exec redis redis-cli -n 1 GET worker:seo-monitor:heartbeat:<PID>
# Expected: JSON payload with pid, hostname, startedAt, lastHeartbeatAt, uptimeSec
```

- [ ] **Step 5: Commit + PR**

```bash
git add backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts
git commit -m "feat(seo): add heartbeat + lifecycle logs to sitemap scheduler (R2+R3)"
git push -u origin feat/seo-sitemap-auth-phase-7-heartbeat
gh pr create --base main --title "feat(seo): heartbeat observability for sitemap scheduler (Phase 7)" --body "$(cat <<'EOF'
Phase 7/11 — SitemapV10SchedulerService writes structured heartbeat to Redis DB 1 every 30s (TTL 60s sliding) + lifecycle logs at boot/shutdown. Enables PR-B diagnostic to detect workerRunning without relying on bull v4 getWorkers() (which is not in @types/bull).

Heartbeat payload: pid, hostname, queue, bullVersion, startedAt, lastHeartbeatAt, uptimeSec.

No behavior change on existing endpoints. Pre-req for Phase 8 (diagnostic endpoint).
EOF
)"
```

---

# Phase 8 — Diagnostic endpoint v2 enriched

**PR title:** `feat(seo): enrich /api/admin/sitemap/scheduler-status with worker+heartbeat+nextRuns`
**Branch:** `feat/seo-sitemap-auth-phase-8-diagnostic`
**Depends on:** Phases 0, 7 merged
**Mergeable independently:** YES

### Task 8.1: Enrich diagnostic controller response

**Files:**
- Modify: `backend/src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.ts`
- Modify: `backend/src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.test.ts`

- [ ] **Step 1: Update response interface**

In `sitemap-scheduler-diagnostic.controller.ts`, replace `SchedulerStatusResponse` with the v2 interface from spec § Diagnostic endpoint v2 (full content). Notable additions:
```ts
  schedulerInitialized: boolean;
  workerRunning: boolean;
  workerCount: number;
  workers: Array<{
    pid: number; hostname: string; queue: string; bullVersion: string;
    startedAt: string; lastHeartbeatAt: string; uptimeSec: number;
  }>;
  redisConnected: boolean;
  lastSitemapRunIso: string | null;
  hoursSinceLastSitemapRun: number | null;
  lastAnyJobCompletedIso: string | null;
  nextRuns: string[];
```

- [ ] **Step 2: Inject dedicated Redis client (for heartbeat scan)**

Add field and inject via ConfigService — using same DB 1 as scheduler heartbeats:
```ts
  private diagRedis!: Redis;

  // in constructor or onModuleInit
  this.diagRedis = new Redis({
    host: this.configService.get('REDIS_HOST', 'localhost'),
    port: +this.configService.get('REDIS_PORT', 6379),
    password: this.configService.get('REDIS_PASSWORD') || undefined,
    db: +this.configService.get('REDIS_OIDC_DB_INDEX', 1),
  });
```

- [ ] **Step 3: Implement heartbeat scan + last completed query**

Replace `getSchedulerStatus()` body. Key additions:
```ts
async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  // ... existing computations ...

  // Heartbeat scan
  const heartbeatKeys = await this.diagRedis.keys('worker:seo-monitor:heartbeat:*');
  const workersRaw = await Promise.all(
    heartbeatKeys.map(async (k) => {
      const raw = await this.diagRedis.get(k);
      return raw ? JSON.parse(raw) : null;
    }),
  );
  const workers = workersRaw.filter((w): w is NonNullable<typeof w> => w !== null);

  // Last completed sitemap regen
  const completed = await this.seoMonitorQueue.getCompleted(0, 49);
  const lastSitemap = completed.find((j) => j.name === SITEMAP_REGENERATE_JOB_NAME);
  const lastAny = completed[0];

  // Next runs via cron-parser
  const CronParser = require('cron-parser');
  let nextRuns: string[] = [];
  try {
    const it = CronParser.parseExpression(cron, { utc: true });
    for (let i = 0; i < 5; i++) nextRuns.push(it.next().toISOString());
  } catch { /* invalid cron string */ }

  return {
    now: new Date().toISOString(),
    schedulerInitialized: !!repeatableJobs.length, // proxy: if jobs registered, init ran
    workerRunning: workers.length > 0,
    workerCount: workers.length,
    workers,
    redisConnected: (this.seoMonitorQueue.client as any)?.status === 'ready',
    lastSitemapRunIso: lastSitemap?.finishedOn ? new Date(lastSitemap.finishedOn).toISOString() : null,
    hoursSinceLastSitemapRun: lastSitemap?.finishedOn
      ? Math.round(((Date.now() - lastSitemap.finishedOn) / 36e5) * 100) / 100
      : null,
    lastAnyJobCompletedIso: lastAny?.finishedOn ? new Date(lastAny.finishedOn).toISOString() : null,
    cron,
    cronEnvOverride,
    expectedJobId: SITEMAP_REGENERATE_JOB_ID,
    nextRuns,
    repeatableJobs,
    ourRepeatableFound,
    counts: { waiting, delayed, active, failed, completed: completed.length, paused },
  };
}
```

Add import top of file:
```ts
import Redis from 'ioredis';
import { SITEMAP_REGENERATE_JOB_NAME } from '../services/sitemap-v10-scheduler.service';
```
Note: `SITEMAP_REGENERATE_JOB_NAME` constant must be exported from scheduler service — check existing exports.

- [ ] **Step 4: Add tests for new fields**

Extend existing test file to cover new response keys:
```ts
it('returns workerRunning=true when heartbeat keys present', async () => {
  redisMock.keys.mockResolvedValue(['worker:seo-monitor:heartbeat:123']);
  redisMock.get.mockResolvedValue(JSON.stringify({
    pid: 123, hostname: 'h', queue: 'seo-monitor', bullVersion: '4.16.5',
    startedAt: '2026-05-16T03:00:00Z', lastHeartbeatAt: '2026-05-16T09:00:00Z', uptimeSec: 21600,
  }));
  const result = await ctrl.getSchedulerStatus();
  expect(result.workerRunning).toBe(true);
  expect(result.workerCount).toBe(1);
  expect(result.workers[0].pid).toBe(123);
});

it('returns workerRunning=false when no heartbeat keys', async () => {
  redisMock.keys.mockResolvedValue([]);
  const result = await ctrl.getSchedulerStatus();
  expect(result.workerRunning).toBe(false);
  expect(result.workerCount).toBe(0);
});

it('returns nextRuns array for daily cron', async () => {
  const result = await ctrl.getSchedulerStatus();
  expect(result.nextRuns).toHaveLength(5);
  expect(result.nextRuns[0]).toMatch(/T03:00:00/);
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.test.ts --no-coverage 2>&1 | tail -15`
Expected: all green.

- [ ] **Step 6: Manual smoke test (local DEV)**

```bash
curl -s -H "X-Internal-Key: $INTERNAL_API_KEY" http://localhost:3000/api/admin/sitemap/scheduler-status | jq
# Expected: full enriched JSON including workers array
```

- [ ] **Step 7: Commit + PR**

```bash
git add backend/src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.ts \
        backend/src/modules/seo/controllers/sitemap-scheduler-diagnostic.controller.test.ts
git commit -m "feat(seo): enrich diagnostic endpoint with workers + nextRuns + redis status"
git push -u origin feat/seo-sitemap-auth-phase-8-diagnostic
gh pr create --base main --title "feat(seo): enriched scheduler-status diagnostic (Phase 8)" --body "Phase 8/11 — Adds workers array (full heartbeat payload), nextRuns (cron-parser), redisConnected, lastSitemapRunIso, hoursSinceLastSitemapRun. Enables PR-D root cause diagnosis in one HTTP call."
```

---

# Phase 9 — Integration tests + PROD deploy verification

**PR title:** `test(seo): integration tests for sitemap auth + PROD verification SOP`
**Branch:** `feat/seo-sitemap-auth-phase-9-integration`
**Depends on:** All phases 0-8 merged
**Mergeable independently:** YES

### Task 9.1: Integration test full HTTP flow

**Files:**
- Create: `backend/src/modules/seo/__tests__/sitemap-auth.integration.test.ts`

- [ ] **Step 1: Write integration test using supertest + nock**

```ts
// Full content per spec § Testing strategy > Integration test
// Covers: anonymous → 401, valid JWT → 201, replay → 401, X-Internal-Key kill ON → 201,
// X-Internal-Key kill OFF → 401, admin session → 201, non-admin session → 401.
```
(write the full test using `supertest` against a built `TestingModule` containing SitemapV10Controller + all auth guards + mocked SitemapV10Service)

- [ ] **Step 2: Run integration test**

Run: `npx jest src/modules/seo/__tests__/sitemap-auth.integration.test.ts --no-coverage 2>&1 | tail -10`
Expected: 7 tests pass.

- [ ] **Step 3: Commit + PR + Wait merge**

### Task 9.2: PROD deploy verification SOP

After Phase 9 merged AND PROD redeployed (tag push), run these checks:

- [ ] **Anonymous POST → 401**
```bash
curl -sI -X POST https://www.automecanik.com/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/2 401
```

- [ ] **Bad Bearer → 401**
```bash
curl -sI -X POST -H "Authorization: Bearer foo.bar.baz" https://www.automecanik.com/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/2 401
```

- [ ] **X-Internal-Key (kill-switch ON during transition) → 201 + Sentry warn**
```bash
curl -sI -X POST -H "X-Internal-Key: $INTERNAL_API_KEY" https://www.automecanik.com/api/sitemap/v10/generate-all | head -1
# Expected: HTTP/2 201
# Then check Sentry dashboard for "legacy_auth_used" warning event
```

- [ ] **GitHub Action workflow_dispatch (real OIDC) → 201**
GitHub UI → Actions → "sitemap-daily-regen" → "Run workflow" → main → wait green
Then:
```bash
curl -sI https://www.automecanik.com/sitemap.xml | grep -i last-modified
# Expected: today's date
```

- [ ] **Diagnostic endpoint shows workerRunning=true**
```bash
curl -s -H "X-Internal-Key: $INTERNAL_API_KEY" https://www.automecanik.com/api/admin/sitemap/scheduler-status | jq '.workerRunning, .workerCount, .ourRepeatableFound, .nextRuns[0]'
# Expected: true, >=1, true, ISO timestamp
```

- [ ] **Wait 24h, verify scheduled cron fires**
```bash
# Tomorrow morning post 03:00 UTC :
curl -sI https://www.automecanik.com/sitemap.xml | grep -i last-modified
# Expected: lastModified date is yesterday or today (incremented daily)
```

---

# Phase 10 — Legacy X-Internal-Key removal prep

**PR title:** `chore(auth): remove LegacyInternalKeyGuard from sitemap AnyOf (J+7 cleanup)`
**Branch:** `chore/seo-sitemap-auth-phase-10-legacy-removal`
**Depends on:** 7 days post Phase 6 PROD deployed AND zero Sentry `legacy_auth_used` events from external callers
**Mergeable independently:** YES

### Task 10.1: Flip kill-switch to false (env change only)

- [ ] **Step 1: Update PROD env**

Modify `docker-compose.prod.yml`:
```yaml
      - SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=${SITEMAP_LEGACY_INTERNAL_KEY_ENABLED:-false}  # was: true
```

- [ ] **Step 2: Update README/CHANGELOG**

Note in `CHANGELOG.md`:
> 2026-MM-DD: X-Internal-Key auth path for sitemap endpoints disabled by default (kill-switch flipped). Use GitHub OIDC via /api/sitemap/v10/generate-all with Bearer JWT. Internal scripts must migrate before next release.

- [ ] **Step 3: Commit + PR + Deploy + Wait 7d Sentry zero**

### Task 10.2: Code removal

After 7d post flip with zero Sentry warnings :

**Files:**
- Delete: `backend/src/auth/legacy-internal-key.guard.ts`
- Delete: `backend/src/auth/legacy-internal-key.guard.test.ts`
- Modify: 4 sitemap controllers (remove `LegacyInternalKeyGuard` from `AnyOf(...)`)
- Modify: `backend/src/modules/seo/seo.module.ts` (remove `LegacyInternalKeyGuard` provider)
- Modify: `docker-compose.prod.yml` (remove env var)

- [ ] **Step 1: Remove guard from AnyOf in each controller**

In each of the 4 controllers:
```ts
@UseGuards(AnyOf(AdminSessionGuard, GithubOidcGuard))  // was: AnyOf(AdminSession, GithubOidc, LegacyInternalKey)
```

- [ ] **Step 2: Remove imports of LegacyInternalKeyGuard from controllers**

- [ ] **Step 3: Remove file + tests**

```bash
git rm backend/src/auth/legacy-internal-key.guard.ts backend/src/auth/legacy-internal-key.guard.test.ts
```

- [ ] **Step 4: Remove from seo.module.ts providers**

- [ ] **Step 5: Remove env var from docker-compose.prod.yml**

- [ ] **Step 6: Typecheck + unit tests + integration test sweep**

- [ ] **Step 7: Commit + PR**

```bash
git add ...
git commit -m "chore(auth): remove legacy X-Internal-Key path (J+7 cleanup, zero Sentry warnings observed)"
```

---

## Self-Review

### Spec coverage check

| Spec section | Task(s) implementing |
|--------------|---------------------|
| § 1 jose lib | Task 0.1 |
| § 2 GithubOidcService | Task 1.2 + Task 4.1 (anti-replay split for testability) |
| § 3 AdminSessionGuard | Task 2.2 |
| § 4 GithubOidcGuard | Task 2.3 |
| § 5 LegacyInternalKeyGuard | Task 3.1 |
| § 6 AnyOf factory | Task 2.1 |
| § 7 Express Request typing | Task 0.2 |
| § 8 Scheduler heartbeat | Task 7.1 |
| § 9 GitHub Action workflow | Task 6.1 |
| Config env vars | Task 0.3 |
| Diagnostic endpoint v2 | Task 8.1 |
| Integration tests | Task 9.1 |
| PROD verification | Task 9.2 |
| Rollback strategy | Documented in Phase 5 PR body |
| Legacy removal PR-E | Phase 10 |

All spec sections covered.

### Placeholder scan

No "TBD", "TODO", "implement later" remaining. The temporary workflow `test-oidc-claims.yml` is created AND removed in same PR (Task 1.1).

### Type consistency

- `GithubOidcClaims` interface : defined Task 1.2, used in `_authClaims` (Phase 0 augmentation) — consistent.
- `_authPath` enum : `'admin-session' | 'github-oidc' | 'internal-key-legacy'` — used identically in all 3 guards.
- `SITEMAP_REGENERATE_JOB_NAME` constant : already exported from `sitemap-v10-scheduler.service.ts` (verified in spec).
- Redis DB 1 : referenced by Phase 4 (anti-replay), Phase 7 (heartbeat), Phase 8 (diagnostic scan) — all consistent.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-sitemap-regen-auth-impl.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per Phase (or per Task for big phases), review between phases, fast iteration. Each subagent gets one phase's tasks + invariants. PR-by-PR merge cadence.

**2. Inline Execution** — Execute Phases 0-10 in this session using executing-plans skill. Batch execution with checkpoints between phases for review.

**Which approach?**
