import { Injectable, Logger } from '@nestjs/common';

import {
  SeoFeatureFlagRegistry,
  type SeoChainFlagKey,
} from '@modules/seo/registries/seo-feature-flag.registry';

import type { SurfaceKey } from '@repo/seo-role-contracts';

import { SeoShadowSampler } from './seo-shadow-sampler.service';
import {
  SeoShadowChainRunner,
  SeoShadowChainTimeoutError,
} from './seo-shadow-chain-runner.service';
import { SeoShadowDiffEngine } from './seo-shadow-diff-engine.service';
import { SeoShadowEventSink } from './seo-shadow-event-sink.service';
import {
  ShadowObservationInputSchema,
  type ShadowObservationInput,
} from './types';

/**
 * Mapping `surface → flag` (clé `SeoFeatureFlagRegistry`).
 * Étendre quand une surface est wirée (cf. README onboarding checklist).
 *
 * PR-6 (initial) : R7 + R8.
 * Retrofit rm-builder : R1_GAMME_VEHICLE_ROUTER (flag `RM`).
 */
const SURFACE_TO_FLAG: Partial<Record<SurfaceKey, SeoChainFlagKey>> = {
  R7_BRAND_HUB: 'R7',
  R8_VEHICLE: 'R8',
  R1_GAMME_VEHICLE_ROUTER: 'RM',
};

/**
 * Service public du module observatory.
 *
 * API : `observe(input)` — synchrone, return immédiat. La comparaison réelle
 * est dispatchée via `setImmediate` (vraie fire-and-forget) ; le chemin
 * réponse HTTP du caller n'attend RIEN.
 *
 * Garanties :
 *   - Input invalide (Zod fail) → log + no-op, jamais de crash propagé.
 *   - Mode `off` ou non-shadow → no-op silencieux.
 *   - Sampler négatif → no-op silencieux.
 *   - Circuit breaker ouvert (>50 timeouts/60s) → no-op silencieux.
 *   - **Aucune branche `mode === 'on'`** dans le code — un flip ENV ne peut
 *     pas activer la chaîne en prod. Boot guard + CI guard + ADR-054
 *     formalisent le pré-requis pour le flip futur.
 *
 * @see plan seo-v9 PR-6 §4.1
 */
@Injectable()
export class SeoShadowObservatory {
  private readonly logger = new Logger(SeoShadowObservatory.name);
  private static readonly TIMEOUT_WINDOW_MS = 60_000;
  private static readonly TIMEOUT_THRESHOLD = 50;
  private recentTimeouts: number[] = [];

  constructor(
    private readonly flags: SeoFeatureFlagRegistry,
    private readonly sampler: SeoShadowSampler,
    private readonly chainRunner: SeoShadowChainRunner,
    private readonly diffEngine: SeoShadowDiffEngine,
    private readonly sink: SeoShadowEventSink,
  ) {}

  /** Sync — return immédiat. La comparaison réelle court via `setImmediate`. */
  observe(rawInput: unknown): void {
    let input: ShadowObservationInput;
    try {
      input = ShadowObservationInputSchema.parse(rawInput);
    } catch (err) {
      this.logger.error(
        `[SEO_SHADOW] invalid input: ${(err as Error).message}`,
      );
      return;
    }

    if (!this.shouldObserve(input)) return;
    if (this.isCircuitOpen()) return;

    setImmediate(() => {
      void this.runComparison(input).catch((err: unknown) => {
        const e = err as Error;
        this.logger.error(
          `[SEO_SHADOW][${input.surface}] runComparison threw: ${e?.message ?? String(err)}`,
        );
      });
    });
  }

  private shouldObserve(input: ShadowObservationInput): boolean {
    const flag = SURFACE_TO_FLAG[input.surface];
    if (!flag) return false; // surface non câblée pour shadow
    const mode = this.flags.mode(flag);
    if (mode !== 'shadow') return false;
    return this.sampler.shouldSample(input.surface, input.entityId);
  }

  private isCircuitOpen(): boolean {
    const cutoff = Date.now() - SeoShadowObservatory.TIMEOUT_WINDOW_MS;
    this.recentTimeouts = this.recentTimeouts.filter((t) => t > cutoff);
    return this.recentTimeouts.length >= SeoShadowObservatory.TIMEOUT_THRESHOLD;
  }

  private async runComparison(input: ShadowObservationInput): Promise<void> {
    let chain;
    try {
      chain = await this.chainRunner.compute(input);
    } catch (err) {
      if (err instanceof SeoShadowChainTimeoutError) {
        this.recentTimeouts.push(Date.now());
      }
      throw err;
    }
    const diff = this.diffEngine.compare(
      input.legacy,
      chain,
      input.requestUrl,
      input.surface,
    );
    if (diff.policyDivergence) {
      this.logger.warn(
        `[SEO_SHADOW][${input.surface}] policy_divergence ${JSON.stringify(diff.summary)}`,
      );
    }
    await this.sink.write(
      input.surface,
      input.entityId,
      input.requestUrl,
      diff,
    );
  }
}
