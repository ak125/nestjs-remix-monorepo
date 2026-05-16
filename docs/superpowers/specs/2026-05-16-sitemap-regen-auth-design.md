# Sitemap Regeneration — Service Authentication Design

**Date:** 2026-05-16
**Status:** Draft (pending user approval)
**Owner:** Fafa
**Driver:** incident traffic-drop 2026-04-22 ; cron BullMQ muet en PROD depuis 2026-05-13

---

## Context

`POST /api/sitemap/v10/generate-all` (et 7 endpoints sœurs) ont été détectés ouverts au public en PROD 2026-05-16 09:00 UTC durant l'investigation du cron BullMQ qui ne fire pas. Un caller anonyme pouvait déclencher 15s CPU + 102 395 écritures fichier / requête. Rate-limit existant 3 req/min ne discrimine pas l'origine.

Parallèlement, PR-C (cron daily sitemap regen) nécessite un mécanisme d'authentification entre GitHub Actions et le backend.

## Goals

1. **Bloquer l'accès anonyme** aux endpoints d'écriture sitemap (8 endpoints).
2. **Permettre l'automation** GitHub Actions → backend sans secret persistant long-lived.
3. **Préserver l'accès admin manuel** (incident response, recovery playbook).
4. **Pattern réutilisable** pour PR-D et future automation interne.
5. **Auditabilité** : chaque appel automatisé corrélable à un workflow GitHub run.

## Non-goals

- Refonte complète du modèle auth backend (out of scope).
- Migration des autres endpoints `/internal/*` vers OIDC (peut suivre dans un sprint séparé).
- mTLS, Hardware Security Module, JWT signé asymétrique : rejetés au profit de GitHub OIDC (cf. comparaison ci-dessous).

## Comparaison des approches (synthèse)

| Approche | Long-lived secret | Replay-safe | Claims auth | Audit | Verdict |
|----------|------------------|-------------|-------------|-------|---------|
| **A. GitHub OIDC federation** | ❌ aucun | ✅ JWT 10min | ✅ repo/workflow/event | ✅ run_id/actor/sha | 🥇 Retenu |
| B. JWT asymétrique (clé Ed25519) | ✅ private key | ✅ exp=5min | ❌ | ⚠️ | Rejeté (rotation manuelle) |
| C. Bearer statique dédié | ✅ long-lived | ❌ | ❌ | ❌ | Rejeté (bricolage pré-2020) |

Industry references: AWS IAM Roles for GitHub Actions, GCP Workload Identity Federation, Azure Federated Credentials utilisent tous OIDC federation.

## Design

### Architecture auth

```
                  ┌──────────────────────────────────────────┐
                  │ GitHub Actions (cron 0 3 * * * UTC)      │
                  │ permission id-token: write               │
                  │ core.getIDToken('automecanik-sitemap…') │
                  └──────────┬───────────────────────────────┘
                             │ JWT exp=10min
                             ▼
                  Authorization: Bearer <jwt>
                             │
                             ▼
   ┌──────────────────────────────────────────────────────────┐
   │  NestJS backend — endpoint sitemap                       │
   │                                                          │
   │  @UseGuards(AnyOf(AdminSessionGuard,                     │
   │                   ServiceAutomationGuard))               │
   │                                                          │
   │  AnyOfGuard tente chaque guard, retourne true au         │
   │  premier OK, throw sinon. req._authPath = G.name         │
   │  écrit pour audit middleware.                            │
   │                                                          │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │ AdminSessionGuard                                  │  │
   │  │   = AuthenticatedGuard + IsAdminGuard composés     │  │
   │  │   (cookie session + level >= 7)                    │  │
   │  └────────────────────────────────────────────────────┘  │
   │                                                          │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │ ServiceAutomationGuard                             │  │
   │  │                                                    │  │
   │  │ Path A (PRIMARY) : Authorization: Bearer <jwt>     │  │
   │  │   1. jose.jwtVerify avec JWKS GitHub (24h cache)   │  │
   │  │   2. assertClaims (iss, aud, exp, repository,      │  │
   │  │      event_name, ref, job_workflow_ref)            │  │
   │  │   3. Redis SET NX oidc:jti:<jti> EX (exp-now+60)   │  │
   │  │      → token usage quasi unique                    │  │
   │  │   4. Audit log {repo, workflow, run_id, actor, sha}│  │
   │  │                                                    │  │
   │  │ Path B (LEGACY) : X-Internal-Key header            │  │
   │  │   kill-switch SITEMAP_LEGACY_INTERNAL_KEY_ENABLED  │  │
   │  │   default=true en PR-A, flip=false post PR-C,      │  │
   │  │   code path supprimé en PR-E (J+7-14)              │  │
   │  └────────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────────┘
```

### Components

#### 1. `jose` lib (NEW dependency)
- Mature, 6M+ downloads/sem, zero-dep
- API : `createRemoteJWKSet(url)` + `jwtVerify(token, jwks, opts)`
- Auto-cache JWKS, auto-refresh on key rotation

#### 2. `backend/src/auth/github-oidc.service.ts` (NEW)
```ts
@Injectable()
export class GithubOidcService implements OnModuleInit {
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  onModuleInit() {
    this.jwks = createRemoteJWKSet(
      new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
      { cacheMaxAge: 24 * 3600 * 1000 },
    );
  }

  async validate(token: string): Promise<GithubOidcClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience: this.audience,
    });
    this.assertClaims(payload);
    await this.assertNotReplayed(payload);
    return payload as GithubOidcClaims;
  }

  private assertClaims(p: JWTPayload): void {
    const repo = this.config.get('GITHUB_OIDC_REPOSITORY');
    const allowedEvents = this.config.get('GITHUB_OIDC_ALLOWED_EVENTS', 'schedule,workflow_dispatch').split(',');
    const allowedRefs = this.config.get('GITHUB_OIDC_ALLOWED_REFS', 'refs/heads/main').split(',');
    const allowedJobRefs = this.config.get('GITHUB_OIDC_ALLOWED_JOB_REFS', '').split(',');

    if (p.repository !== repo) throw new ForbiddenException('repository mismatch');
    if (!allowedEvents.includes(p.event_name as string)) throw new ForbiddenException('event_name not allowed');
    if (!allowedRefs.includes(p.ref as string)) throw new ForbiddenException('ref not allowed');
    if (!allowedJobRefs.includes(p.job_workflow_ref as string)) throw new ForbiddenException('job_workflow_ref not allowed');
  }

  private async assertNotReplayed(p: JWTPayload): Promise<void> {
    if (!p.jti) throw new UnauthorizedException('missing jti');
    const ttl = Math.ceil(Math.max(60, (p.exp! * 1000 - Date.now()) / 1000) + 60);
    const ok = await this.redis.set(`oidc:jti:${p.jti}`, '1', 'EX', ttl, 'NX');
    if (ok !== 'OK') throw new UnauthorizedException('token replay detected');
  }
}
```

#### 3. `backend/src/auth/service-automation.guard.ts` (NEW)
```ts
@Injectable()
export class ServiceAutomationGuard implements CanActivate {
  constructor(
    private readonly oidc: GithubOidcService,
    private readonly internalKeyGuard: InternalApiKeyGuard,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    // Path A: Bearer GitHub OIDC (primary, modern)
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const claims = await this.oidc.validate(auth.slice(7));
      req._authPath = 'github-oidc';
      req._authClaims = claims;
      return true;
    }

    // Path B: X-Internal-Key (legacy, kill-switch)
    if (req.headers['x-internal-key']) {
      if (this.config.get('SITEMAP_LEGACY_INTERNAL_KEY_ENABLED') !== 'true') {
        this.logger.warn(`X-Internal-Key disabled by kill-switch on ${req.url}`);
        throw new UnauthorizedException('Legacy auth disabled');
      }
      this.logger.warn(`LEGACY auth path used on ${req.url} — migrate to OIDC`);
      const ok = await this.internalKeyGuard.canActivate(ctx);
      if (ok) req._authPath = 'internal-key-legacy';
      return ok;
    }

    throw new UnauthorizedException('Service authentication required');
  }
}
```

#### 4. `backend/src/auth/admin-session.guard.ts` (NEW, extraction)
Compose `AuthenticatedGuard` + `IsAdminGuard` logic en un seul Guard pour usage via `AnyOf()` :
```ts
@Injectable()
export class AdminSessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException('Authentication required');
    const isAdmin = req.user.isAdmin === true || parseInt(String(req.user.level || 0), 10) >= 7;
    if (!isAdmin) throw new UnauthorizedException('Admin level required');
    req._authPath = 'admin-session';
    return true;
  }
}
```

#### 5. `backend/src/auth/any-of.guard.ts` (NEW factory)
```ts
export function AnyOf(...guards: Type<CanActivate>[]): Type<CanActivate> {
  @Injectable()
  class CompositeGuard implements CanActivate {
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
      throw errors[0]?.err ?? new UnauthorizedException('No auth method matched');
    }
  }
  return CompositeGuard;
}
```

#### 6. GitHub Action workflow `.github/workflows/sitemap-daily-regen.yml`
```yaml
name: sitemap-daily-regen
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:
permissions:
  id-token: write
  contents: read
concurrency:
  group: sitemap-daily-regen
  cancel-in-progress: false
jobs:
  regen:
    runs-on: ubuntu-latest
    timeout-minutes: 5
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
            --max-time 60 --retry 2 --retry-delay 10 \
            -H "Authorization: Bearer ${{ steps.oidc.outputs.token }}" \
            -H "User-Agent: AutoMecanikSitemapRegen/1.0 (+https://github.com/${{ github.repository }})" \
            https://www.automecanik.com/api/sitemap/v10/generate-all
```

### Configuration (env vars)

```bash
# Backend PROD env (docker-compose.prod.yml)
GITHUB_OIDC_AUDIENCE=automecanik-sitemap-regen
GITHUB_OIDC_REPOSITORY=ak125/nestjs-remix-monorepo
GITHUB_OIDC_ALLOWED_EVENTS=schedule,workflow_dispatch
GITHUB_OIDC_ALLOWED_REFS=refs/heads/main
GITHUB_OIDC_ALLOWED_JOB_REFS=ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main

# Kill-switch legacy (default true en PR-A, flip false post PR-C deploy)
SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=true
```

### Diagnostic endpoint v2 (PR-B refinement)

```ts
interface SchedulerStatusResponse {
  now: string;

  // Scheduler health
  schedulerInitialized: boolean;        // SitemapV10SchedulerService.configureRepeatableJob completed sans erreur
  workerRunning: boolean;               // (await queue.getWorkers()).length > 0
  redisConnected: boolean;              // queue.client.status === 'ready'

  // Runtime signals
  lastHeartbeat: string | null;         // last completed job (any) sur seo-monitor
  lastSitemapRunIso: string | null;     // last completed sitemap-regenerate-all
  hoursSinceLastSitemapRun: number | null;

  // Cron config
  cron: string;
  cronEnvOverride: string | null;
  expectedJobId: string;
  nextRuns: string[];                   // 5 prochaines occurrences via cron-parser

  // BullMQ state
  repeatableJobs: RepeatableJobInfo[];
  ourRepeatableFound: boolean;
  counts: {
    waiting: number; delayed: number; active: number;
    failed: number; completed: number; paused: boolean;
  };
}
```

### Data flow PR-C (cron flow)

1. **03:00 UTC** → GitHub schedules workflow `sitemap-daily-regen.yml`
2. Runner Linux ubuntu-latest démarre, perms `id-token: write`
3. `actions/github-script@v7` appelle `core.getIDToken('automecanik-sitemap-regen')` → POST `https://token.actions.githubusercontent.com/...` → JWT exp=10min, claims signés
4. `curl -X POST` vers `https://www.automecanik.com/api/sitemap/v10/generate-all` avec `Authorization: Bearer <jwt>` + UA identifiable
5. **Backend `AnyOf(AdminSessionGuard, ServiceAutomationGuard)`** :
   - AdminSessionGuard throw (no cookie session) → catch
   - ServiceAutomationGuard détecte Bearer → délègue à GithubOidcService
6. **GithubOidcService.validate** :
   - JWKS fetched (cache miss au boot, hit ensuite)
   - `jwtVerify(token, jwks, {issuer, audience})` → sig OK
   - `assertClaims` : repository/event_name/ref/job_workflow_ref tous OK
   - `assertNotReplayed` : Redis SET NX → OK
   - Audit log `{repo, workflow, run_id, actor, sha, jti}`
7. Controller exécute `sitemapService.generateAll()` → 15s, 102k URLs régénérés
8. HTTP 201 + body `{success: true, data: {...}}` → curl exit 0
9. Workflow success → next run scheduled +24h

### Error handling

| Cas | Path | HTTP | Log level | Action |
|-----|------|------|-----------|--------|
| Aucun cookie + aucun header | All | 401 | warn | Reject |
| Bearer JWT signature invalide | ServiceAutomation.A | 401 | **error (security)** | Reject + alert |
| Bearer JWT exp dépassé | ServiceAutomation.A | 401 | warn | Reject |
| Claim repository mismatch | ServiceAutomation.A | 403 | **error (security)** | Reject + alert |
| Claim event_name pas dans allow-list | ServiceAutomation.A | 403 | **error (security)** | Reject + alert |
| Claim ref/job_workflow_ref hors allow-list | ServiceAutomation.A | 403 | **error (security)** | Reject + alert |
| JWT jti déjà vu (replay) | ServiceAutomation.A | 401 | **error (security)** | Reject + alert |
| Missing jti claim | ServiceAutomation.A | 401 | error | Reject |
| JWKS fetch fail | ServiceAutomation.A | 503 | error | Reject (fail-closed) + alert |
| X-Internal-Key valid + kill-switch ON | ServiceAutomation.B | 200 | **warn (deprecation)** | Allow + emit metric |
| X-Internal-Key + kill-switch OFF | ServiceAutomation.B | 401 | warn | Reject |
| Admin session level<7 | AdminSession | 401 | warn | Reject |

### Testing strategy

#### Unit tests
- `github-oidc.service.test.ts` — validate avec JWT mocks signés via clé locale + JWKS mocké :
  - happy path (toutes les claims OK)
  - signature invalide
  - exp passé
  - mismatch chaque claim individuellement (repository/event/ref/job_workflow_ref)
  - replay détecté
  - jti manquant
  - JWKS fetch fail
- `service-automation.guard.test.ts` :
  - Bearer present → délègue OIDC
  - X-Internal-Key + kill-switch ON → délègue internal-key
  - X-Internal-Key + kill-switch OFF → 401
  - aucun header → 401
- `admin-session.guard.test.ts` :
  - level≥7 → ok
  - level<7 → 401
  - no user → 401
- `any-of.guard.test.ts` :
  - première guard OK → bypass autres
  - première guard throw + seconde OK → return true
  - toutes throw → throw première erreur

#### Integration test
- `sitemap-auth.integration.test.ts` (nock mocks GitHub JWKS) :
  - POST avec JWT valide → 201
  - POST sans auth → 401
  - POST avec JWT valide mais déjà utilisé (replay) → 401
  - POST avec X-Internal-Key (kill-switch ON) → 201 + warn log
  - POST avec session admin (cookie) → 201
  - POST avec session non-admin → 401

#### Deploy verification (manual post-merge)
- PROD : `curl -X POST https://www.automecanik.com/api/sitemap/v10/generate-all` → expect 401
- PROD : `curl -X POST -H "X-Internal-Key: $KEY" …` → expect 201 + deprecation warn dans logs
- GitHub Action manual `workflow_dispatch` → expect green run + sitemap `<lastmod>` updated

## Migration / Rollout

### PR-A v2 (Foundation security + OIDC)
- Add deps `jose`, `ioredis` (likely already via bull)
- New files: `github-oidc.service.ts`, `service-automation.guard.ts`, `admin-session.guard.ts`, `any-of.guard.ts` + tests
- Modify : 4 sitemap controllers utilisent `@UseGuards(AnyOf(AdminSessionGuard, ServiceAutomationGuard))`
- Env new : `GITHUB_OIDC_AUDIENCE`, `GITHUB_OIDC_REPOSITORY`, `GITHUB_OIDC_ALLOWED_EVENTS`, `GITHUB_OIDC_ALLOWED_REFS`, `GITHUB_OIDC_ALLOWED_JOB_REFS`, `SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=true`
- Update `docker-compose.prod.yml` to propagate new env vars

### PR-B v2 (Diagnostic endpoint enrichi)
- Add dep `cron-parser`
- Modify `sitemap-scheduler-diagnostic.controller.ts` :
  - Add `workerRunning`, `redisConnected`, `lastHeartbeat`, `lastSitemapRunIso`, `hoursSinceLastSitemapRun`, `nextRuns[]`, `schedulerInitialized`
- Add `schedulerInitialized` flag in `SitemapV10SchedulerService` (set true en fin de `configureRepeatableJob`)
- Tests expanded

### PR-C (GitHub Action OIDC)
- Create `.github/workflows/sitemap-daily-regen.yml`
- Zero secret requis côté CI
- Tested via `workflow_dispatch` post-merge

### PR-D (Root cause)
- Based sur PR-B diagnostic en PROD
- Scope défini par signal observé (workerRunning false / repeatable absent / etc.)

### PR-E (Cleanup legacy)
- Flip `SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=false` (env change PROD)
- Wait 7d sans usage métric → delete code path `// Path B` dans ServiceAutomationGuard
- Remove env var entirely

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub OIDC outage | Low | High (cron fail) | Fallback admin manuel possible. PR-D scheduler BullMQ reste primaire ; PR-C est safety net. |
| JWKS rotation breaks validation | Low | High | `jose` lib auto-refresh JWKS sur signature failure. Tested via key rotation simulation. |
| Redis down → anti-replay impossible | Medium | Medium | Fail-closed (reject auth). Admin manuel reste disponible. Metric alert. |
| Old workflow forks réutilisent audience | Low | Low | `job_workflow_ref` pin + `repository` pin → fork ne peut pas générer JWT valide. |
| Kill-switch oublié activé 18 mois | Medium | Medium | Metric `legacy_auth_used_total` + alert si > 0 après J+7. Calendrier PR-E. |

## References

- Memory `feedback_dont_industrialize_open_vulnerability.md`
- Memory `feedback_no_overclaim_security_words.md` (claims pas "100% safe", on dit "fortement réduit")
- Memory `feedback_no_bricolage_escalate_to_industry_standard.md`
- GitHub OIDC docs: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- `jose` lib: https://github.com/panva/jose
- Incident traffic-drop 2026-04-22 + PR #487/488
- PR #550 (PR-A v1, à force-push pour v2)
- PR #551 (PR-B v1, à update pour v2)

---

**Approval requested.** Si validé, je passe à l'invocation de `writing-plans` pour découper l'implémentation en steps testables.
