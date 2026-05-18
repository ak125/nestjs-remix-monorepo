/**
 * LegacyInternalKeyGuard — kill-switched wrapper for X-Internal-Key auth.
 *
 * Phase 3/11 of sitemap regen auth plan. Atomic guard composed with
 * `AdminSessionGuard` + `GithubOidcGuard` via `AnyOf()` on sitemap write
 * endpoints (Phase 5 cutover).
 *
 * **Transitional only** : retained behind a kill-switch env flag during the
 * cutover window. Default behavior on Phase 5 deploy = `true` (legacy
 * X-Internal-Key still accepted). After Phase 6 (GitHub Action OIDC cron
 * proven for 7 days), flip env to `false` to disable. Phase 10 removes this
 * file entirely.
 *
 * Logic :
 *   1. If no `X-Internal-Key` header → throw (other AnyOf paths handle it).
 *   2. If kill-switch `SITEMAP_LEGACY_INTERNAL_KEY_ENABLED !== 'true'` → throw.
 *   3. Delegate to `InternalApiKeyGuard.canActivate(ctx)` (timing-safe match).
 *   4. On accept : Sentry breadcrumb `legacy_auth_used` (level=warning, tag
 *      `deprecation=PR-E`) for tracking deprecation usage in PROD.
 *
 * Sentry was confirmed as the monorepo's only observability stack (cf. memory
 * `feedback_hardcode_invariants_env_only_for_knobs`). No Prometheus / metric
 * exporter is wired ; `Sentry.captureMessage` is the canonical alert path.
 *
 * Writes `req._authPath = 'internal-key-legacy'` on success for audit
 * middleware.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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

    if (!req.headers?.['x-internal-key']) {
      throw new UnauthorizedException('x-internal-key header required');
    }

    if (
      this.config.get<string>('SITEMAP_LEGACY_INTERNAL_KEY_ENABLED') !== 'true'
    ) {
      this.logger.warn(
        `X-Internal-Key disabled by kill-switch on ${req.method} ${req.url}`,
      );
      throw new UnauthorizedException('Legacy auth disabled — migrate to OIDC');
    }

    const accepted = await this.internal.canActivate(ctx);
    if (accepted !== true) {
      return false;
    }

    this.logger.warn(
      `LEGACY auth path used on ${req.method} ${req.url} — migrate to OIDC`,
    );
    Sentry.captureMessage('legacy_auth_used', {
      level: 'warning',
      tags: {
        endpoint: String(req.url),
        method: String(req.method),
        deprecation: 'PR-E',
      },
    });

    req._authPath = 'internal-key-legacy';
    return true;
  }
}
