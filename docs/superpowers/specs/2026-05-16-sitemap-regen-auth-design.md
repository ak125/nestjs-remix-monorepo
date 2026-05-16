# Sitemap Regeneration — Service Authentication Design

**Date:** 2026-05-16
**Status:** Draft v2 (post second user review — 18 refinements integrated)
**Owner:** Fafa
**Driver:** incident traffic-drop 2026-04-22 ; cron BullMQ muet en PROD depuis 2026-05-13

> **v2 changes vs v1** : 3 atomic guards via `AnyOf()` (M1) — Redis client dédié anti-replay (M2) — audience métier per-endpoint (M3) — ADR-069 vault référencé (M4) — heartbeat Redis remplace `getWorkers()` absent en bull v4 (M5) — clockTolerance + nbf doc (A2-A3) — Bull v4 fallback heartbeat (A4→M5) — timeouts CI étendus (A5) — rollback strategy (A6) — Express Request typing (A7) — Sentry au lieu de Prometheus fictif (A8) — JWKS default cache (m1) — retry-connrefused (m2) — force-push traçabilité (m3) — failure notify (m4) — concurrency docs (m5) — sub claim pin (R1) — heartbeat payload structuré (R2) — lifecycle logs (R3) — workflow_dispatch ops bénéfice (R4).

---

## Context

`POST /api/sitemap/v10/generate-all` (et 7 endpoints sœurs) ont été détectés ouverts au public en PROD 2026-05-16 09:00 UTC durant l'investigation du cron BullMQ qui ne fire pas. Un caller anonyme pouvait déclencher 15s CPU + 102 395 écritures fichier / requête. Rate-limit existant 3 req/min ne discrimine pas l'origine.

Parallèlement, PR-C (cron daily sitemap regen) nécessite un mécanisme d'authentification entre GitHub Actions et le backend.

## Goals

1. **Bloquer l'accès anonyme** aux endpoints d'écriture sitemap (8 endpoints).
2. **Permettre l'automation** GitHub Actions → backend sans secret persistant long-lived.
3. **Préserver l'accès admin manuel** (incident response, recovery playbook).
4. **Permettre regen manuel ops via GitHub UI** (workflow_dispatch) — zéro SSH, zéro Hetzner console, zéro endpoint public.
5. **Pattern réutilisable** pour PR-D et future automation interne.
6. **Auditabilité** : chaque appel automatisé corrélable à un workflow GitHub run.
7. **Atomicité de la suppression legacy** : retirer X-Internal-Key path (PR-E) sans toucher au reste.

## Non-goals

- Refonte complète du modèle auth backend (out of scope).
- Migration des autres endpoints `/internal/*` vers OIDC (peut suivre dans un sprint séparé).
- mTLS, Hardware Security Module, JWT signé asymétrique : rejetés au profit de GitHub OIDC (cf. comparaison ci-dessous).

## Comparaison des approches (synthèse)

| Approche | Long-lived secret | Replay-safe | Claims auth | Audit | Verdict |
|----------|------------------|-------------|-------------|-------|---------|
| **A. GitHub OIDC federation** | ❌ aucun | ✅ JWT 10min + jti SETNX | ✅ 5 claims pinned | ✅ run_id/actor/sha | 🥇 Retenu |
| B. JWT asymétrique (clé Ed25519) | ✅ private key | ✅ exp=5min | ❌ no claims | ⚠️ limité | Rejeté (rotation manuelle) |
| C. Bearer statique dédié | ✅ long-lived | ❌ | ❌ | ❌ | Rejeté (bricolage pré-2020) |

Industry references: AWS IAM Roles for GitHub Actions, GCP Workload Identity Federation, Azure Federated Credentials utilisent tous OIDC federation.

## Design

### Architecture auth (M1 — 3 guards atomiques + AnyOf)

```
                  ┌──────────────────────────────────────────┐
                  │ GitHub Actions (cron OR workflow_dispatch)│
                  │ permission id-token: write               │
                  │ core.getIDToken('automecanik-sitemap-…') │
                  └──────────┬───────────────────────────────┘
                             │ JWT exp=10min
                             ▼
                  Authorization: Bearer <jwt>
                             │
                             ▼
   ┌──────────────────────────────────────────────────────────┐
   │  NestJS backend — endpoint sitemap                       │
   │                                                          │
   │  @UseGuards(AnyOf(                                       │
   │    AdminSessionGuard,        // humans, cookie           │
   │    GithubOidcGuard,          // machines, Bearer JWT     │
   │    LegacyInternalKeyGuard,   // legacy, kill-switched    │
   │  ))                                                      │
   │                                                          │
   │  AnyOfGuard tente chaque guard en séquence, retourne     │
   │  true au premier OK. Écrit `req._authPath = G.name`      │
   │  pour audit middleware. Sinon throw l'erreur du premier. │
   │                                                          │
   │  Pourquoi 3 guards atomiques au lieu d'un composite :    │
   │  - chaque guard est indépendamment testable              │
   │  - chaque path log/audit/instrument séparément           │
   │  - PR-E supprime LegacyInternalKeyGuard du AnyOf(...)    │
   │    et du module providers — atomique, zéro touch sur     │
   │    OIDC ni admin                                         │
   └──────────────────────────────────────────────────────────┘
```

### Components

#### 1. `jose` lib (NEW dependency)
- Mature, 6M+ downloads/sem, zero-dep, maintainer Filip Skokan
- API : `createRemoteJWKSet(url)` + `jwtVerify(token, jwks, opts)`
- Auto-cache JWKS, auto-refresh on signature failure (m1 : on garde defaults — pas de `cacheMaxAge` custom)

#### 2. `backend/src/auth/github-oidc.service.ts` (NEW)

```ts
import { Injectable, OnModuleInit, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import Redis from 'ioredis';
import * as Sentry from '@sentry/nestjs';

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
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    // M2 — Redis client DÉDIÉ pour anti-replay (pas réutilisation queue.client de Bull)
    this.redis = new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: +config.get('REDIS_PORT', 6379),
      password: config.get('REDIS_PASSWORD') || undefined,
      db: +config.get('REDIS_OIDC_DB_INDEX', 1), // DB 1 pour isolation namespace
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  onModuleInit(): void {
    // m1 — JWKS default cache (jose handles rotation via auto-refresh on verify-fail)
    this.jwks = createRemoteJWKSet(
      new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
    );
    void this.redis.connect().catch((err) => {
      this.logger.error(`Redis OIDC anti-replay connect failed: ${err.message}`);
    });
  }

  async validate(token: string): Promise<GithubOidcClaims> {
    // A2 — clockTolerance pour skew runner GitHub ↔ PROD VPS (typiquement <5s, on tolère 30s)
    // A3 — jose vérifie exp/nbf/iat par défaut. clockTolerance s'applique aux trois.
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience: this.config.get('GITHUB_OIDC_AUDIENCE'),
      clockTolerance: 30,
    });
    this.assertClaims(payload);
    await this.assertNotReplayed(payload);
    this.auditLog(payload);
    return payload as GithubOidcClaims;
  }

  private assertClaims(p: JWTPayload): void {
    const repo = this.config.get<string>('GITHUB_OIDC_REPOSITORY');
    const allowedEvents = this.config.get<string>('GITHUB_OIDC_ALLOWED_EVENTS', 'schedule,workflow_dispatch').split(',');
    const allowedRefs = this.config.get<string>('GITHUB_OIDC_ALLOWED_REFS', 'refs/heads/main').split(',');
    const allowedJobRefs = this.config.get<string>('GITHUB_OIDC_ALLOWED_JOB_REFS', '').split(',').filter(Boolean);
    const allowedSubs = this.config.get<string>('GITHUB_OIDC_ALLOWED_SUBS', '').split(',').filter(Boolean); // R1

    if (p.repository !== repo) throw new ForbiddenException('claim repository mismatch');
    if (!allowedEvents.includes(p.event_name as string)) throw new ForbiddenException('claim event_name not allowed');
    if (!allowedRefs.includes(p.ref as string)) throw new ForbiddenException('claim ref not allowed');
    if (allowedJobRefs.length && !allowedJobRefs.includes(p.job_workflow_ref as string)) {
      throw new ForbiddenException('claim job_workflow_ref not allowed');
    }
    // R1 — sub claim pin (invariant compact supplémentaire)
    if (allowedSubs.length && !allowedSubs.includes(p.sub as string)) {
      throw new ForbiddenException('claim sub not allowed');
    }
  }

  private async assertNotReplayed(p: JWTPayload): Promise<void> {
    if (!p.jti) throw new UnauthorizedException('missing jti claim');
    // TTL dynamique : (exp - now) + 60s safety margin. Floor 60s.
    const ttl = Math.ceil(Math.max(60, (p.exp! * 1000 - Date.now()) / 1000) + 60);
    const ok = await this.redis.set(`oidc:jti:${p.jti}`, '1', 'EX', ttl, 'NX');
    if (ok !== 'OK') {
      this.logger.error(`Token replay detected: jti=${p.jti} repo=${p.repository}`);
      Sentry.captureMessage('oidc_token_replay', {
        level: 'error',
        tags: { jti: p.jti, repository: String(p.repository) },
      });
      throw new UnauthorizedException('token already used');
    }
  }

  private auditLog(p: JWTPayload): void {
    this.logger.log({
      event: 'github_oidc_auth_success',
      repository: p.repository,
      workflow: p.workflow,
      workflow_ref: p.workflow_ref,
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

#### 3. `backend/src/auth/admin-session.guard.ts` (NEW, extraction atomique)

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

#### 4. `backend/src/auth/github-oidc.guard.ts` (NEW, atomique — pas de fallback)

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

#### 5. `backend/src/auth/legacy-internal-key.guard.ts` (NEW wrapper — kill-switch + deprecation tracking)

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

    // A8 — Sentry capture pour deprecation tracking (pas de Prometheus en stack monorepo)
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

#### 6. `backend/src/auth/any-of.guard.ts` (NEW factory mixin)

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

#### 7. `backend/src/types/express.d.ts` (NEW — A7 module augmentation)

```ts
import { GithubOidcClaims } from '../auth/github-oidc.service';

declare module 'express' {
  interface Request {
    _authPath?: 'admin-session' | 'github-oidc' | 'internal-key-legacy';
    _authClaims?: GithubOidcClaims;
  }
}
```

Référencé dans `backend/tsconfig.json > include`.

#### 8. `backend/src/modules/seo/services/sitemap-v10-scheduler.service.ts` (UPDATE — heartbeat R2 + lifecycle R3)

Étend le service existant. Ajout :

```ts
import * as os from 'node:os';
import Redis from 'ioredis';

private readonly heartbeatKey = `worker:seo-monitor:heartbeat:${process.pid}`;
private readonly startedAt = new Date();
private heartbeatTimer?: NodeJS.Timeout;
private redis!: Redis;

onModuleInit(): void {
  if (!this.isEnabled()) {
    this.logger.log('SEO_SITEMAP_CRON_ENABLED=false — sitemap regeneration scheduler skipped');
    return;
  }
  this.redis = new Redis({
    host: this.configService.get('REDIS_HOST', 'localhost'),
    port: +this.configService.get('REDIS_PORT', 6379),
    password: this.configService.get('REDIS_PASSWORD') || undefined,
    db: +this.configService.get('REDIS_OIDC_DB_INDEX', 1),
  });

  // R3 — lifecycle log structuré au boot
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
  // R2 — heartbeat structuré toutes les 30s
  this.heartbeatTimer = setInterval(() => void this.writeHeartbeat(), 30_000);
  void this.writeHeartbeat(); // immediate
}

async onModuleDestroy(): Promise<void> {
  // R3 — symmetric shutdown log
  if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  this.logger.log({
    event: 'sitemap_scheduler_worker_offline',
    pid: process.pid,
    hostname: os.hostname(),
    queue: 'seo-monitor',
    uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
    reason: 'shutdown',
  });
  await this.redis?.del(this.heartbeatKey).catch(() => undefined);
  await this.redis?.quit().catch(() => undefined);
}

private async writeHeartbeat(): Promise<void> {
  const payload = {
    pid: process.pid,
    hostname: os.hostname(),
    queue: 'seo-monitor',
    bullVersion: '4.16.5',
    startedAt: this.startedAt.toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
  };
  await this.redis.set(this.heartbeatKey, JSON.stringify(payload), 'EX', 60);
}
```

#### 9. GitHub Action workflow `.github/workflows/sitemap-daily-regen.yml` (NEW)

```yaml
name: sitemap-daily-regen
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:           # R4 — admin manuel via UI sans SSH/console
permissions:
  id-token: write              # OBLIGATOIRE pour OIDC
  contents: read               # MINIMAL — fork ne peut pas modifier le workflow
  issues: write                # m4 — open issue on failure
concurrency:
  group: sitemap-daily-regen
  cancel-in-progress: false    # m5 — queue manual_dispatch derrière cron (pas kill)
jobs:
  regen:
    runs-on: ubuntu-latest
    timeout-minutes: 15        # A5 — peak: 102k URLs + 113 hub files
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
            --max-time 600 \                              # A5
            --retry 2 --retry-delay 10 \
            --retry-connrefused \                         # m2 — real network transients
            -H "Authorization: Bearer ${{ steps.oidc.outputs.token }}" \
            -H "User-Agent: AutoMecanikSitemapRegen/1.0 (+https://github.com/${{ github.repository }})" \
            https://www.automecanik.com/api/sitemap/v10/generate-all

      - name: Notify on failure
        if: failure()                                     # m4
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

### Configuration (env vars)

```bash
# Backend PROD env (docker-compose.prod.yml — propagate ${VAR})
# M3 — audience métier per-endpoint (pas globale)
GITHUB_OIDC_AUDIENCE=automecanik-sitemap-regen

# Claims whitelist (M1 + R1)
GITHUB_OIDC_REPOSITORY=ak125/nestjs-remix-monorepo
GITHUB_OIDC_ALLOWED_EVENTS=schedule,workflow_dispatch
GITHUB_OIDC_ALLOWED_REFS=refs/heads/main
GITHUB_OIDC_ALLOWED_JOB_REFS=ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main
# R1 — sub format pour event_name=schedule + ref=refs/heads/main :
GITHUB_OIDC_ALLOWED_SUBS=repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main

# M2 — anti-replay Redis dédié (DB séparée, namespace isolé)
REDIS_OIDC_DB_INDEX=1
# REDIS_HOST, REDIS_PORT, REDIS_PASSWORD : déjà existants

# PR-A kill-switch legacy (default true en PR-A v2, flip false post PR-C deploy, removed PR-E)
SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=true
```

**Future audiences pattern** : `automecanik-<purpose>-<action>` (per-endpoint, least-privilege). Ex. `automecanik-cache-flush`, `automecanik-rag-reindex`. Leak d'un JWT n'affecte que son endpoint.

### Diagnostic endpoint v2 (M5 + R2 + R3 — heartbeat-based, pas getWorkers)

Réponse JSON enrichie :

```ts
interface SchedulerStatusResponse {
  now: string;

  // Scheduler health (M5)
  schedulerInitialized: boolean;      // SitemapV10SchedulerService.configureRepeatableJob done sans erreur
  workerRunning: boolean;             // heartbeat keys count > 0
  workerCount: number;                // count workers actifs
  workers: Array<{                    // R2 — full structured heartbeat
    pid: number;
    hostname: string;
    queue: string;
    bullVersion: string;
    startedAt: string;
    lastHeartbeatAt: string;
    uptimeSec: number;
  }>;
  redisConnected: boolean;            // queue.client.status === 'ready'

  // Runtime signals
  lastSitemapRunIso: string | null;   // last completed sitemap-regenerate-all
  hoursSinceLastSitemapRun: number | null;
  lastAnyJobCompletedIso: string | null;

  // Cron config
  cron: string;
  cronEnvOverride: string | null;
  expectedJobId: string;
  nextRuns: string[];                 // 5 prochaines occurrences via cron-parser

  // BullMQ state
  repeatableJobs: RepeatableJobInfo[];
  ourRepeatableFound: boolean;
  counts: {
    waiting: number; delayed: number; active: number;
    failed: number; completed: number; paused: boolean;
  };
}
```

Implémentation diagnostic :
```ts
async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  // ... existing queries ...

  // M5 + R2 — heartbeat scan
  const heartbeatKeys = await this.diagRedis.keys('worker:seo-monitor:heartbeat:*');
  const workers = await Promise.all(
    heartbeatKeys.map(async (k) => {
      const raw = await this.diagRedis.get(k);
      return raw ? JSON.parse(raw) : null;
    }),
  ).then((arr) => arr.filter(Boolean));

  return {
    ...,
    workerRunning: workers.length > 0,
    workerCount: workers.length,
    workers,
    redisConnected: this.seoMonitorQueue.client.status === 'ready',
    // ...
  };
}
```

### Data flow PR-C (cron OR workflow_dispatch)

1. **03:00 UTC** → GitHub schedules workflow `sitemap-daily-regen.yml` (OU admin clique "Run workflow" via GitHub UI = workflow_dispatch)
2. Runner Linux démarre, permission `id-token: write`
3. `actions/github-script@v7` appelle `core.getIDToken('automecanik-sitemap-regen')` → POST `https://token.actions.githubusercontent.com/...` → JWT exp=10min, claims signés (incluant `sub`)
4. `curl -X POST` vers `https://www.automecanik.com/api/sitemap/v10/generate-all` avec `Authorization: Bearer <jwt>` + UA identifiable
5. **Backend `AnyOf(AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard)`** :
   - AdminSessionGuard throw (no cookie session) → catch
   - GithubOidcGuard détecte Bearer → délègue à `GithubOidcService.validate()`
6. **`GithubOidcService.validate`** :
   - JWKS fetched (cache miss au boot, hit ensuite — m1)
   - `jwtVerify(token, jwks, {issuer, audience, clockTolerance: 30})` → sig OK + exp/nbf/iat OK (A2-A3)
   - `assertClaims` : repository / event_name / ref / job_workflow_ref / sub tous OK (M1 + R1)
   - `assertNotReplayed` : Redis SET NX `oidc:jti:<jti>` → OK
   - `auditLog` : structured log `{repo, workflow, run_id, actor, sha, jti, sub, event_name}`
7. Controller exécute `sitemapService.generateAll()` → 15s, 102k URLs régénérés
8. HTTP 201 + body → curl exit 0
9. Workflow success → next run scheduled +24h (ou retour UI admin pour dispatch)

### Error handling

| Cas | Path | HTTP | Log level | Sentry capture | Action |
|-----|------|------|-----------|----------------|--------|
| Aucun cookie + aucun header | All | 401 | warn | non | Reject |
| Bearer JWT signature invalide | GithubOidc | 401 | **error** | yes (security) | Reject + alert |
| Bearer JWT exp dépassé (clockTolerance dépassé) | GithubOidc | 401 | warn | non | Reject |
| Claim repository mismatch | GithubOidc | 403 | **error** | yes (security) | Reject + alert |
| Claim event_name pas dans allow-list | GithubOidc | 403 | **error** | yes (security) | Reject + alert |
| Claim ref hors allow-list | GithubOidc | 403 | **error** | yes (security) | Reject + alert |
| Claim job_workflow_ref hors allow-list | GithubOidc | 403 | **error** | yes (security) | Reject + alert |
| Claim sub hors allow-list (R1) | GithubOidc | 403 | **error** | yes (security) | Reject + alert |
| JWT jti déjà vu (replay) | GithubOidc | 401 | **error** | yes (security) | Reject + alert |
| Missing jti claim | GithubOidc | 401 | error | yes | Reject |
| JWKS fetch fail | GithubOidc | 503 | error | yes | Reject (fail-closed) |
| X-Internal-Key valid + kill-switch ON | LegacyInternalKey | 200 | **warn** | yes (deprecation tag) | Allow + Sentry tag deprecation:PR-E |
| X-Internal-Key + kill-switch OFF | LegacyInternalKey | 401 | warn | non | Reject |
| Admin session level<7 | AdminSession | 401 | warn | non | Reject |

### Testing strategy

#### Unit tests

`backend/src/auth/github-oidc.service.test.ts` — validate avec JWT mocks signés via clé locale + JWKS mocké :
- happy path (toutes les claims OK incluant sub)
- signature invalide
- exp passé (au-delà clockTolerance)
- exp passé mais dans clockTolerance → still OK
- mismatch chaque claim individuellement (repository / event_name / ref / job_workflow_ref / sub)
- replay détecté (Redis SETNX retourne not OK)
- jti manquant
- JWKS fetch fail → throw + Sentry capture

`backend/src/auth/github-oidc.guard.test.ts` :
- Bearer header → délègue OIDC service
- No Bearer → 401
- OIDC validate throws → propagate

`backend/src/auth/legacy-internal-key.guard.test.ts` :
- No x-internal-key header → 401
- kill-switch=true + valid key → 200 + Sentry deprecation message
- kill-switch=false → 401 (même avec valid key)

`backend/src/auth/admin-session.guard.test.ts` :
- level≥7 → ok
- isAdmin=true → ok
- level<7 → 401
- no user → 401

`backend/src/auth/any-of.guard.test.ts` :
- première guard OK → bypass autres
- première guard throw + seconde OK → return true
- toutes throw → throw première erreur
- empty list → throw

#### Integration test

`backend/src/modules/seo/__tests__/sitemap-auth.integration.test.ts` (nock mocks GitHub JWKS) :
- POST avec JWT valide → 201
- POST sans auth → 401
- POST avec JWT valide mais déjà utilisé (replay) → 401
- POST avec X-Internal-Key (kill-switch ON) → 201 + warn log
- POST avec X-Internal-Key (kill-switch OFF) → 401
- POST avec session admin (cookie) → 201
- POST avec session non-admin → 401

#### Pre-PR-A integration check (A1)

Workflow temporaire `.github/workflows/test-oidc-claims.yml` :
```yaml
on: { workflow_dispatch: }
permissions: { id-token: write }
jobs:
  introspect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const token = await core.getIDToken('test-audience');
            const [, payload] = token.split('.');
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
            core.info(JSON.stringify(decoded, null, 2));
```
Run 1× via UI dispatch, confirme présence `jti`, format `sub`, valeurs réelles des claims. **Workflow supprimé après évidence collectée** (avant merge PR-A v2).

#### Deploy verification (manual post-merge)

- PROD : `curl -X POST https://www.automecanik.com/api/sitemap/v10/generate-all` → expect **401**
- PROD : `curl -X POST -H "X-Internal-Key: $KEY" …` → expect **201** + deprecation warn dans Sentry
- GitHub Action manual `workflow_dispatch` → expect green run + sitemap `<lastmod>` updated + audit log Sentry breadcrumb `github_oidc_auth_success`
- Diagnostic endpoint : `curl -H "X-Internal-Key: $KEY" https://www.automecanik.com/api/admin/sitemap/scheduler-status` → expect `workerRunning: true, workerCount: 1, workers[0].uptimeSec > 0`

## Migration / Rollout

### PR-A v2 (Foundation security + OIDC + 3 atomic guards)

**Branche** : `fix/seo-secure-sitemap-write-endpoints` (force-push de la v1).

**m3 — Force-push traçabilité** : avant `git push --force`, poster un comment sur PR #550 :
```
### v2 design (force-push)
v1 commit `8af0f5885` (AdminOrInternalKeyGuard 2-paths composite) remplacé par v2 :
- 3 guards atomiques (AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard) via AnyOf()
- GitHub OIDC federation + jti anti-replay + sub claim pin
- Kill-switch legacy X-Internal-Key (env-flagged, supprimé PR-E)
- Sentry deprecation tracking, pas de Prometheus
- Express Request typing
- Spec doc : commit `<NEW_COMMIT_HASH>` — `docs/superpowers/specs/2026-05-16-sitemap-regen-auth-design.md`
```

**Files** :
- Add deps : `jose`, `ioredis` (likely déjà via bull, à confirmer)
- New : `github-oidc.service.ts`, `github-oidc.guard.ts`, `admin-session.guard.ts`, `legacy-internal-key.guard.ts`, `any-of.guard.ts` + 5 fichiers `.test.ts`
- New : `backend/src/types/express.d.ts` + référencé dans `tsconfig.json`
- Modify : 4 sitemap controllers utilisent `@UseGuards(AnyOf(AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard))`
- Modify : `docker-compose.prod.yml` propagate `GITHUB_OIDC_*` + `REDIS_OIDC_DB_INDEX` + `SITEMAP_LEGACY_INTERNAL_KEY_ENABLED`
- Modify : `backend/.env` add same vars

### PR-B v2 (Diagnostic endpoint enrichi avec heartbeat)

**Files** :
- Add dep `cron-parser`
- Modify `sitemap-v10-scheduler.service.ts` : ajouter heartbeat + lifecycle logs (R2 + R3)
- Modify `sitemap-scheduler-diagnostic.controller.ts` : ajouter `workerRunning`, `workerCount`, `workers[]`, `redisConnected`, `lastSitemapRunIso`, `hoursSinceLastSitemapRun`, `lastAnyJobCompletedIso`, `nextRuns[]`, `schedulerInitialized`
- Tests expanded

### PR-C (GitHub Action OIDC)

**Bénéfice opérationnel R4** : `workflow_dispatch` permet à l'admin de déclencher un regen manuel via GitHub UI sans :
- SSH PROD (refusé en session courante)
- Hetzner console (lourd)
- Endpoint backend public (compromettrait la sécurité)
- Token static à protéger

Le token OIDC généré au click est identique au token cron (sauf `event_name=workflow_dispatch`, `actor=<user>`). Validé par les mêmes guards. Single-use via jti anti-replay → pas de leak si admin clique 2×.

### PR-D (Root cause BullMQ)

Based sur PR-B diagnostic en PROD. Scope défini par signal observé :
- `workerRunning=false` → worker container down (fix : vérifier compose worker service)
- `workerRunning=true` + `ourRepeatableFound=false` → onModuleInit n'a pas appelé configureRepeatableJob ou throw silencieux (fix : add try/catch + Sentry)
- `redisConnected=false` → Redis flapping (fix : reconnect strategy)
- `nextRuns[0] < now` → timezone drift (fix : explicit tz)

### PR-E (Cleanup legacy X-Internal-Key)

**Timing** : J+7 à J+14 post merge PR-C, après confirmation zero `legacy_auth_used` Sentry messages.

**Steps** :
1. Flip `SITEMAP_LEGACY_INTERNAL_KEY_ENABLED=false` en PROD env (cluster restart)
2. Wait 7d → confirm Sentry alert rule reports 0 `legacy_auth_used`
3. Open PR-E : retirer `LegacyInternalKeyGuard` du `AnyOf(...)` dans les 4 controllers + retirer le file `legacy-internal-key.guard.ts` + retirer env var
4. Atomique grâce à la séparation M1

## Rollback strategy (A6)

**Trigger** :
- 5xx burst (>5%/min) sur `/api/sitemap/v10/*` post-deploy PR-A v2
- Sitemap regen absent >36h post merge
- Sentry alert `oidc_token_replay` ou `oidc_jwks_fetch_fail` répété

**SOP** (5-10 min) :
1. `git revert <commit-pr-a-v2> && git push origin main` → CI deploy DEV preprod
2. Si DEV OK : `git tag v2026.05.NN-revert-sitemap-auth-oidc && git push --tags` → deploy PROD
3. Verify : `curl -X POST https://www.automecanik.com/api/sitemap/v10/generate-all` retourne 401 (kill-switch encore en place via revert state)
4. Manual regen via session admin pour rétablir sitemap freshness immédiatement
5. Post-mortem dans `governance-vault/ledger/incidents/`

**Pas de bypass auth env-flag** : compromet l'objectif sécurité de PR-A v2. Revert = seul chemin sain.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub OIDC outage upstream | Low | High (cron fail) | Workflow_dispatch fallback via admin UI. PR-D scheduler BullMQ reste primaire ; PR-C est safety net externe. |
| JWKS rotation breaks validation | Low | High | `jose` auto-refresh JWKS sur signature failure (m1). Tested via key rotation simulation. |
| Redis OIDC anti-replay down | Medium | Medium | Fail-closed (reject auth). Admin session reste disponible. Sentry alert. |
| Old workflow forks réutilisent audience | Very Low | Low | `job_workflow_ref` + `sub` pin (M1 + R1) → fork ne peut pas générer JWT valide même avec audience leak. |
| Kill-switch oublié activé 18 mois | Medium | Medium | Sentry capture `legacy_auth_used` à chaque accept + alert email si > 0 dans 7d window. Calendrier PR-E. |
| Clock drift PROD VPS vs GitHub runner | Low | Low | `clockTolerance: 30s` (A2). |
| Worker container down silencieux | Medium | High | Heartbeat R2 + diagnostic endpoint → détection instantanée par PR-B + alerte ops. |

## References

- ADR-069 **"Service authentication: GitHub OIDC federation for CI → backend"** (à filer dans `ak125/governance-vault/ledger/decisions/adr/ADR-069-sitemap-regen-auth-oidc.md`, parallèle à PR-A v2)
- Memory [[feedback_dont_industrialize_open_vulnerability]]
- Memory [[feedback_no_overclaim_security_words]]
- Memory [[feedback_no_bricolage_escalate_to_industry_standard]]
- Memory [[feedback_separate_guard_per_auth_path]] (M1 principle)
- Memory [[feedback_oidc_federation_over_long_lived_bearer]] (architectural choice)
- GitHub OIDC docs: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- `jose` lib: https://github.com/panva/jose
- Incident traffic-drop 2026-04-22 + PR #487/488
- PR #550 (PR-A v1 — à force-push pour v2)
- PR #551 (PR-B v1 — à rebase sur PR-A v2)
- Industry refs: AWS IAM Roles for GHA, GCP Workload Identity Federation, Azure Federated Credentials

---

**Spec status** : v2 amendé avec 18 raffinements (13 review initiale + 1 finding exploration + 4 second review user). Pending user approval avant `writing-plans` invocation.
