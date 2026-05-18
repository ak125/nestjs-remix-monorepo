/**
 * ADR-066 — R2 Feature Flag Service (kill-switch)
 *
 * Controls global activation of the R2 v2 pipeline via env var + Redis runtime
 * override. Cf improvement self-review D : kill-switch immédiat sans redeploy.
 *
 * Resolution order :
 *   1. Redis key `r2:v2:enabled` (admin runtime toggle) — wins if set
 *   2. Env var `R2_V2_ENABLED` (deploy-time default)
 *   3. Default false (safe — pipeline OFF until explicit enable)
 *
 * Used by R2EligibilityService and R2CompositionService entrypoints :
 * if `isEnabled() === false` → no-op + log warn (Rego policy will deny
 * pipeline_generated writes too).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  FEATURE_FLAG_ENV_VAR,
  FEATURE_FLAG_REDIS_KEY,
} from '../constants/r2-eligibility.constants';

export const R2_FEATURE_FLAG_REDIS_TOKEN = 'R2_FEATURE_FLAG_REDIS';

@Injectable()
export class R2FeatureFlagService {
  private readonly logger = new Logger(R2FeatureFlagService.name);
  private cachedValue: boolean | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5_000; // 5s cache to avoid hammering Redis on hot path

  constructor(
    @Inject(R2_FEATURE_FLAG_REDIS_TOKEN)
    private readonly redis: Redis | null,
  ) {}

  /**
   * Check if R2 v2 pipeline is enabled.
   * Sync cached read for hot-path performance (refreshed async).
   */
  async isEnabled(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedValue !== null && now < this.cacheExpiry) {
      return this.cachedValue;
    }

    let value = false;

    // 1. Redis runtime override (admin toggle)
    if (this.redis) {
      try {
        const raw = await this.redis.get(FEATURE_FLAG_REDIS_KEY);
        if (raw !== null) {
          value = raw === 'true' || raw === '1';
          this.updateCache(value);
          return value;
        }
      } catch (err) {
        this.logger.warn(
          `Redis lookup failed for ${FEATURE_FLAG_REDIS_KEY}: ${err}`,
        );
        // Fall through to env var
      }
    }

    // 2. Env var default
    const envVal = process.env[FEATURE_FLAG_ENV_VAR];
    value = envVal === 'true' || envVal === '1';

    this.updateCache(value);
    return value;
  }

  /**
   * Admin toggle (writes Redis override). Used by admin endpoint
   * POST /api/admin/seo/r2/feature-flag.
   */
  async setEnabled(enabled: boolean, actor: string): Promise<void> {
    if (!this.redis) {
      this.logger.warn(
        `Cannot set runtime feature flag without Redis (actor=${actor})`,
      );
      throw new Error('Redis unavailable for runtime feature flag override');
    }
    await this.redis.set(FEATURE_FLAG_REDIS_KEY, enabled ? 'true' : 'false');
    this.cachedValue = enabled;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    this.logger.log(`R2_V2_ENABLED → ${enabled} by actor=${actor}`);
  }

  private updateCache(value: boolean): void {
    this.cachedValue = value;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
  }
}
