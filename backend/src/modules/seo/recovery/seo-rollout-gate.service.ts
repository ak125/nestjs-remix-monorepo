/**
 * PR-E — SEO Rollout Gate (GrowthBook-compatible, env-fallback for dev/test)
 *
 * Single source of truth for rollout decisions in the H1 recovery pipeline.
 * The recovery worker consults this service BEFORE calling the gateway —
 * the gateway itself stays pure (OPA-only), no flag awareness.
 *
 * Two flags govern the recovery rollout (per plan §8) :
 *   - seo.h1.recovery.enabled    (bool, kill-switch)
 *   - seo.h1.recovery.rollout_pct (0..100, % of assets eligible)
 *
 * Implementation : env-based fallback for PR-E (no external GrowthBook SDK
 * dependency). A future PR can plug in @growthbook/growthbook-nodejs without
 * changing this service's API.
 *
 * Env vars :
 *   SEO_H1_RECOVERY_ENABLED      = "true" | "false" (default: false)
 *   SEO_H1_RECOVERY_ROLLOUT_PCT  = "0".."100"        (default: 0)
 *
 * Deterministic bucketing : `hash(asset_id) % 100 < rollout_pct` → eligible.
 * Same asset always ends up in the same bucket across runs.
 *
 * Plan : §8 Phase E
 * Memory : feedback_slo_must_be_multi_source — flag check is one gate among
 *          synthetic + runtime + GSC validation downstream.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class SeoRolloutGateService {
  private readonly logger = new Logger(SeoRolloutGateService.name);

  /** Kill-switch : if false, no recovery write happens, period. */
  isRecoveryEnabled(): boolean {
    return (process.env.SEO_H1_RECOVERY_ENABLED ?? '').toLowerCase() === 'true';
  }

  /** 0..100. Returns 0 if unset or invalid → no asset is eligible. */
  getRolloutPct(): number {
    const raw = process.env.SEO_H1_RECOVERY_ROLLOUT_PCT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.floor(n)));
  }

  /**
   * Returns true iff THIS asset is eligible for recovery in the current
   * rollout window. Combines :
   *   1. Kill-switch enabled
   *   2. Deterministic hash bucket vs rollout_pct
   *
   * If either condition fails, the asset is NOT eligible — worker skips it,
   * gateway is NOT called.
   */
  isAssetEligible(assetId: string): boolean {
    if (!this.isRecoveryEnabled()) return false;
    const pct = this.getRolloutPct();
    if (pct <= 0) return false;
    if (pct >= 100) return true;
    const bucket = this.bucketize(assetId);
    return bucket < pct;
  }

  /**
   * Deterministic 0..99 bucket based on SHA-256 of asset_id. Same asset
   * always lands in the same bucket — no flapping between worker runs.
   */
  bucketize(assetId: string): number {
    const hex = createHash('sha256').update(assetId, 'utf8').digest('hex');
    // First 8 hex chars = 32-bit uint. Modulo 100 = bucket.
    const slice = hex.slice(0, 8);
    return parseInt(slice, 16) % 100;
  }

  /** Health endpoint helper. */
  describeState(): {
    enabled: boolean;
    rolloutPct: number;
    backend: 'env_fallback';
  } {
    return {
      enabled: this.isRecoveryEnabled(),
      rolloutPct: this.getRolloutPct(),
      backend: 'env_fallback',
    };
  }
}
