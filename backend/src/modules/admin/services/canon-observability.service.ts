import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

/**
 * Canon violation observability — single entry point for emitting structured
 * Sentry events when role-purity rules fire.
 *
 * Usage : `runCanonGate` in role enrichers (R3 PR-C, future R6/R7/R8) calls
 * `recordViolation(role, gamme, violation)` for each canon failure before
 * returning the `CANON_BLOCK` result.
 *
 * Sentry counter cardinality (Plan §viii) :
 *   - flag    : ~5-10 unique values (CANON_FLAGS set)
 *   - role    : ~9 unique values (RoleId enum, minus deprecated)
 *   - gamme   : ~232 unique values — high cardinality, opt-out available
 *   - source  : ~3-5 unique values ('script' | 'agent' | 'manual' | 'enricher')
 *
 * Set `SENTRY_CANON_DROP_GAMME=true` to drop the gamme tag (use event log
 * JSONB in DB for investigation instead) if Sentry tier hits cardinality
 * limits.
 *
 * No-op if `SENTRY_DSN` unset (local dev) — same pattern as `instrument.ts`.
 */
@Injectable()
export class CanonObservabilityService {
  private readonly logger = new Logger(CanonObservabilityService.name);
  private readonly dropGammeTag: boolean;

  constructor() {
    this.dropGammeTag = process.env.SENTRY_CANON_DROP_GAMME === 'true';
  }

  /**
   * Emit a structured warning to Sentry for a canon violation.
   *
   * @param role     The canonical role being enforced (e.g. 'R3_CONSEILS')
   * @param gamme    Gamme alias (or pg_id stringified). Dropped if
   *                 `SENTRY_CANON_DROP_GAMME=true`.
   * @param violation `{ flag: string, evidence: string }` from the canon gate
   * @param source   The component that emitted this — defaults to 'enricher'.
   *                 Use 'script' for batch scripts, 'agent' for AI agents,
   *                 'manual' for admin UI writes.
   */
  recordViolation(
    role: string,
    gamme: string,
    violation: { flag: string; evidence: string },
    source: 'enricher' | 'script' | 'agent' | 'manual' = 'enricher',
  ): void {
    const tags: Record<string, string> = {
      role,
      flag: violation.flag,
      source,
    };
    if (!this.dropGammeTag) {
      tags.gamme = gamme;
    }

    // Logger first — local visibility regardless of Sentry config.
    this.logger.warn(
      `[canon-violation] role=${role} gamme=${gamme} flag=${violation.flag} ` +
        `evidence=${violation.evidence}`,
    );

    Sentry.captureMessage(`canon_violation: ${violation.flag}`, {
      level: 'warning',
      tags,
      extra: {
        evidence: violation.evidence,
        gamme_full: gamme, // kept in extra for investigation when tag dropped
      },
    });
  }

  /**
   * Emit a batch of violations from a single enrichment cycle.
   * Each violation produces one Sentry event for granular grouping.
   */
  recordViolations(
    role: string,
    gamme: string,
    violations: ReadonlyArray<{ flag: string; evidence: string }>,
    source?: 'enricher' | 'script' | 'agent' | 'manual',
  ): void {
    for (const v of violations) {
      this.recordViolation(role, gamme, v, source);
    }
  }
}
