/**
 * GithubOidcService — JWT validation for GitHub Actions OIDC tokens.
 *
 * Phase 1/11 of sitemap regen auth plan (`docs/superpowers/plans/2026-05-16-sitemap-regen-auth-impl.md`).
 *
 * **Paradigm (Phase 0.6)**: validation invariants are HARDCODED as `static readonly`
 * class constants, NOT env vars. They don't change between deployments of this code
 * — they're contractual invariants of "this codebase deploys here, uses this audience,
 * accepts these workflow refs". Forks customize via source edit (versioned, reviewable).
 *
 * Cf. memory `feedback_hardcode_invariants_env_only_for_knobs`.
 *
 * **This phase (1) — claims validation only.** Phase 4 will extend with `jti`
 * anti-replay (Redis SETNX dedicated DB 1). Phase 2-3 will wrap this service in
 * `GithubOidcGuard` + `LegacyInternalKeyGuard` for controller-level usage.
 *
 * **Fail-closed**: any claim mismatch, signature failure, or JWKS unavailability
 * throws an exception. No silent fallback. This is the "industry standard 2026"
 * pattern for service-to-service auth (memory
 * `feedback_oidc_federation_over_long_lived_bearer`).
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import Redis from 'ioredis';

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
export class GithubOidcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GithubOidcService.name);

  constructor(private readonly config: ConfigService) {}

  // ─────────────────────────────────────────────────────────────────
  // Hardcoded invariants (Phase 0.6 paradigm — never env-overridable).
  // To change for a legitimate fork: edit here, get PR review, redeploy.
  // ─────────────────────────────────────────────────────────────────

  /** GitHub Actions OIDC issuer — only valid value globally. */
  static readonly ISSUER = 'https://token.actions.githubusercontent.com';

  /** Audience claim — must match `core.getIDToken('automecanik-sitemap-regen')`. */
  static readonly AUDIENCE = 'automecanik-sitemap-regen';

  /** Repository claim — only this repo's workflows may auth. */
  static readonly REPOSITORY = 'ak125/nestjs-remix-monorepo';

  /** Event names accepted (cron + admin manual via GitHub UI workflow_dispatch). */
  static readonly ALLOWED_EVENTS: readonly string[] = [
    'schedule',
    'workflow_dispatch',
  ];

  /** Refs accepted — main only. Feature branches don't get prod auth. */
  static readonly ALLOWED_REFS: readonly string[] = ['refs/heads/main'];

  /** Exact job_workflow_ref allowed — pins to a specific workflow file on main. */
  static readonly ALLOWED_JOB_REFS: readonly string[] = [
    'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
  ];

  /** Sub claim format — defense in depth alongside job_workflow_ref. */
  static readonly ALLOWED_SUBS: readonly string[] = [
    'repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main',
  ];

  /** Clock tolerance for exp/nbf/iat (runner ↔ PROD VPS time skew). */
  static readonly CLOCK_TOLERANCE_SECONDS = 30;

  /**
   * Redis DB index for jti anti-replay store. Isolated from Bull (DB 0).
   * Hardcoded per Phase 0.6 paradigm — invariant by convention.
   */
  static readonly REDIS_DB_INDEX = 1;

  /**
   * Redis key prefix for jti anti-replay records.
   * Namespace separation from Bull's `bull:*` keys.
   */
  static readonly REDIS_JTI_PREFIX = 'oidc:jti:';

  // ─────────────────────────────────────────────────────────────────

  /**
   * JWKS resolver. Initialized in `onModuleInit` from the remote endpoint.
   * Tests override via `setJwksForTesting()`.
   */
  protected jwks!: JWTVerifyGetKey;

  /**
   * Dedicated Redis client for anti-replay (Phase 4) — separate connection
   * from Bull's queue.client (DB 0). Lazy-connect, max 3 retries per command.
   * Tests override via `setRedisForTesting()`.
   */
  protected redis!: Redis;

  onModuleInit(): void {
    this.jwks = this.createJwks();
    if (!this.redis) {
      this.redis = this.createRedis();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  /**
   * Factory hook — production uses `createRemoteJWKSet` against GitHub's JWKS
   * endpoint. Tests override this method in a subclass (or use
   * `setJwksForTesting`) to inject a local JWKS via `createLocalJWKSet`.
   */
  protected createJwks(): JWTVerifyGetKey {
    return createRemoteJWKSet(
      new URL(GithubOidcService.ISSUER + '/.well-known/jwks'),
    );
  }

  /**
   * Factory hook for Redis — production opens a dedicated connection to the
   * anti-replay DB. Tests override via `setRedisForTesting()` with an
   * ioredis-mock instance.
   */
  protected createRedis(): Redis {
    return new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: GithubOidcService.REDIS_DB_INDEX,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Test seam — override the JWKS resolver post-init (vitest/jest unit tests).
   * Production code MUST NOT call this.
   */
  setJwksForTesting(jwks: JWTVerifyGetKey): void {
    this.jwks = jwks;
  }

  /**
   * Test seam — override the Redis client post-init (vitest/jest unit tests).
   * Pass an ioredis-mock instance or a similar mock.
   * Production code MUST NOT call this.
   */
  setRedisForTesting(redis: Redis): void {
    this.redis = redis;
  }

  /**
   * Validate a Bearer JWT from a GitHub Actions OIDC token.
   * - Verifies signature, iss, aud, exp, nbf, iat (with clockTolerance).
   * - Verifies all 5 pinned claims (repository, event_name, ref, job_workflow_ref, sub).
   * - Asserts jti has not been seen before (Phase 4 anti-replay via Redis SETNX).
   * - Audit-logs success.
   * - Fail-closed: throws on any mismatch / replay / Redis unavailability.
   */
  async validate(token: string): Promise<GithubOidcClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: GithubOidcService.ISSUER,
      audience: GithubOidcService.AUDIENCE,
      clockTolerance: GithubOidcService.CLOCK_TOLERANCE_SECONDS,
    });
    this.assertClaims(payload);
    await this.assertNotReplayed(payload);
    this.auditLog(payload);
    return payload as GithubOidcClaims;
  }

  /**
   * Anti-replay : SETNX `oidc:jti:<jti>` with TTL = (exp - now) + 60s safety.
   * Returns successfully if the key was created (first time we see this jti).
   * Throws UnauthorizedException if the key already exists (replay detected).
   *
   * Fail-closed : if jti claim is absent or Redis is unavailable, throws. We
   * never silently accept a token without anti-replay verification.
   */
  private async assertNotReplayed(p: JWTPayload): Promise<void> {
    if (!p.jti) {
      throw new UnauthorizedException('missing jti claim');
    }

    const expMs = (p.exp ?? 0) * 1000;
    const remainingSec = Math.max(60, (expMs - Date.now()) / 1000);
    const ttlSec = Math.ceil(remainingSec + 60);
    const key = GithubOidcService.REDIS_JTI_PREFIX + String(p.jti);

    const result = await this.redis.set(key, '1', 'EX', ttlSec, 'NX');

    if (result !== 'OK') {
      this.logger.error(
        `Token replay detected: jti=${p.jti} repo=${p.repository}`,
      );
      Sentry.captureMessage('oidc_token_replay', {
        level: 'error',
        tags: {
          jti: String(p.jti),
          repository: String(p.repository),
        },
      });
      throw new UnauthorizedException('token already used');
    }
  }

  private assertClaims(p: JWTPayload): void {
    if (p.repository !== GithubOidcService.REPOSITORY) {
      throw new ForbiddenException('claim repository mismatch');
    }
    if (!GithubOidcService.ALLOWED_EVENTS.includes(p.event_name as string)) {
      throw new ForbiddenException('claim event_name not allowed');
    }
    if (!GithubOidcService.ALLOWED_REFS.includes(p.ref as string)) {
      throw new ForbiddenException('claim ref not allowed');
    }
    if (
      !GithubOidcService.ALLOWED_JOB_REFS.includes(p.job_workflow_ref as string)
    ) {
      throw new ForbiddenException('claim job_workflow_ref not allowed');
    }
    if (!GithubOidcService.ALLOWED_SUBS.includes(p.sub as string)) {
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
