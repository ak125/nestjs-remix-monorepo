/**
 * PR-E+1 — SEO Rollout Gate with real GrowthBook SDK (env fallback retained)
 *
 * Backend resolution order (first that returns a definite value wins) :
 *   1. GrowthBook SDK (if GROWTHBOOK_CLIENT_KEY is set and features loaded).
 *   2. Env fallback (SEO_H1_RECOVERY_ENABLED / SEO_H1_RECOVERY_ROLLOUT_PCT) —
 *      used for local dev, CI, and safety net if GrowthBook is unreachable.
 *
 * Two flags govern the recovery rollout (per plan §8) :
 *   - seo.h1.recovery.enabled    (bool, kill-switch)
 *   - seo.h1.recovery.rollout_pct (0..100, % of assets eligible)
 *
 * Deterministic bucketing : `hash(asset_id) % 100 < rollout_pct` → eligible.
 *
 * Memory : materialized-views-and-feature-flags-rules (GrowthBook canon),
 *          feedback_slo_must_be_multi_source
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { GrowthBook } from '@growthbook/growthbook';

const FLAG_ENABLED = 'seo.h1.recovery.enabled';
const FLAG_ROLLOUT_PCT = 'seo.h1.recovery.rollout_pct';

type GrowthBookBackend = 'sdk_remote' | 'env_fallback' | 'disabled';

@Injectable()
export class SeoRolloutGateService implements OnModuleInit {
  private readonly logger = new Logger(SeoRolloutGateService.name);
  private gb: GrowthBook | null = null;
  private gbReady = false;
  private readonly clientKey = process.env.GROWTHBOOK_CLIENT_KEY ?? '';
  private readonly apiHost =
    process.env.GROWTHBOOK_API_HOST ?? 'https://cdn.growthbook.io';

  onModuleInit(): void {
    if (!this.clientKey) {
      this.logger.warn(
        '[SeoRolloutGate] GROWTHBOOK_CLIENT_KEY unset — falling back to env vars (dev/CI mode).',
      );
      return;
    }
    void this.initGrowthBook();
  }

  private async initGrowthBook(): Promise<void> {
    try {
      this.gb = new GrowthBook({
        apiHost: this.apiHost,
        clientKey: this.clientKey,
        enableDevMode: false,
        trackingCallback: () => undefined,
      });
      await this.gb.loadFeatures({ timeout: 5000 });
      this.gbReady = true;
      this.logger.log(
        `✓ GrowthBook features loaded (host=${this.apiHost}) — backend=sdk_remote`,
      );
    } catch (err) {
      this.logger.error(
        `[SeoRolloutGate] GrowthBook init failed (${err instanceof Error ? err.message : String(err)}) — falling back to env vars.`,
      );
      this.gb = null;
      this.gbReady = false;
    }
  }

  /** Kill-switch : if false, no recovery write happens, period. */
  isRecoveryEnabled(): boolean {
    if (this.gbReady && this.gb) {
      return this.gb.isOn(FLAG_ENABLED) === true;
    }
    return (process.env.SEO_H1_RECOVERY_ENABLED ?? '').toLowerCase() === 'true';
  }

  /** 0..100. Returns 0 if unset or invalid → no asset is eligible. */
  getRolloutPct(): number {
    if (this.gbReady && this.gb) {
      const value = this.gb.getFeatureValue(FLAG_ROLLOUT_PCT, 0);
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.min(100, Math.max(0, Math.floor(n)));
    }
    const raw = process.env.SEO_H1_RECOVERY_ROLLOUT_PCT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.floor(n)));
  }

  isAssetEligible(assetId: string): boolean {
    if (!this.isRecoveryEnabled()) return false;
    const pct = this.getRolloutPct();
    if (pct <= 0) return false;
    if (pct >= 100) return true;
    return this.bucketize(assetId) < pct;
  }

  bucketize(assetId: string): number {
    const hex = createHash('sha256').update(assetId, 'utf8').digest('hex');
    return parseInt(hex.slice(0, 8), 16) % 100;
  }

  describeState(): {
    enabled: boolean;
    rolloutPct: number;
    backend: GrowthBookBackend;
  } {
    const backend: GrowthBookBackend = this.gbReady
      ? 'sdk_remote'
      : this.clientKey
        ? 'disabled'
        : 'env_fallback';
    return {
      enabled: this.isRecoveryEnabled(),
      rolloutPct: this.getRolloutPct(),
      backend,
    };
  }
}
