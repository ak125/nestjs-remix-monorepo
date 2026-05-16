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
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

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

  // ─────────────────────────────────────────────────────────────────

  /**
   * JWKS resolver. Initialized in `onModuleInit` from the remote endpoint.
   * Tests override via `setJwksForTesting()`.
   */
  protected jwks!: JWTVerifyGetKey;

  onModuleInit(): void {
    this.jwks = this.createJwks();
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
   * Test seam — override the JWKS resolver post-init (vitest/jest unit tests).
   * Production code MUST NOT call this.
   */
  setJwksForTesting(jwks: JWTVerifyGetKey): void {
    this.jwks = jwks;
  }

  /**
   * Validate a Bearer JWT from a GitHub Actions OIDC token.
   * - Verifies signature, iss, aud, exp, nbf, iat (with clockTolerance).
   * - Verifies all 5 pinned claims (repository, event_name, ref, job_workflow_ref, sub).
   * - Audit-logs success.
   * - Fail-closed: throws on any mismatch.
   *
   * Phase 4 will add `assertNotReplayed(payload)` here (Redis SETNX on jti).
   */
  async validate(token: string): Promise<GithubOidcClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: GithubOidcService.ISSUER,
      audience: GithubOidcService.AUDIENCE,
      clockTolerance: GithubOidcService.CLOCK_TOLERANCE_SECONDS,
    });
    this.assertClaims(payload);
    this.auditLog(payload);
    return payload as GithubOidcClaims;
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

// Suppress unused-import warning for UnauthorizedException — used in Phase 4
// for the anti-replay path. Kept here so the Phase 4 PR diff is minimal.
void UnauthorizedException;
