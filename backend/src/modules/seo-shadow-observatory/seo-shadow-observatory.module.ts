import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SeoModule } from '@modules/seo/seo.module';

import { SeoShadowEnvSchema } from './env.schema';
import { SeoShadowChainRunner } from './seo-shadow-chain-runner.service';
import { SeoShadowDiffEngine } from './seo-shadow-diff-engine.service';
import { SeoShadowEventSink } from './seo-shadow-event-sink.service';
import { SeoShadowObservatory } from './seo-shadow-observatory.service';
import { SeoShadowPurgeCron } from './seo-shadow-purge.cron';
import { SeoShadowSampler } from './seo-shadow-sampler.service';
import { SeoShadowUrlNormalizer } from './seo-shadow-url-normalizer.service';

/**
 * `SeoShadowObservatoryModule` — observabilité shadow réutilisable, dédiée.
 *
 * **Imports** :
 *   - `SeoModule` — UNIQUEMENT pour `SeoChainOrchestratorService` +
 *     `SeoFeatureFlagRegistry`. Seul `SeoShadowChainRunner` consomme ces
 *     services. Sampler / Normalizer / DiffEngine / Sink restent purs.
 *   - `ConfigModule` — pour `SeoShadowEnvSchema` (Zod) + `READ_ONLY` gate cron.
 *
 * **Exports** :
 *   - `SeoShadowObservatory` — API publique (caller : R7/R8 services).
 *   - `SeoShadowPurgeCron` — exposé pour potentiel admin endpoint trigger.
 *
 * **Boot guard** (`onModuleInit`) :
 *   - Zod parse les ENV. `SEO_CHAIN_R7_MODE=tru` (typo) → throw, container ne boot pas.
 *   - `mode=on` détecté → throw (PR-6 ne livre PAS la branche on ; flip
 *     requiert ADR-054 sign-off + PR dédié).
 *
 * @see plan seo-v9 PR-6 §4.7
 */
@Module({
  imports: [SeoModule, ConfigModule],
  providers: [
    SeoShadowObservatory,
    SeoShadowSampler,
    SeoShadowUrlNormalizer,
    SeoShadowChainRunner,
    SeoShadowDiffEngine,
    SeoShadowEventSink,
    SeoShadowPurgeCron,
  ],
  exports: [SeoShadowObservatory, SeoShadowPurgeCron],
})
export class SeoShadowObservatoryModule implements OnModuleInit {
  private readonly logger = new Logger(SeoShadowObservatoryModule.name);

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit(): void {
    const env = SeoShadowEnvSchema.parse({
      SEO_CHAIN_R7_MODE: this.cfg.get<string>('SEO_CHAIN_R7_MODE'),
      SEO_CHAIN_R8_MODE: this.cfg.get<string>('SEO_CHAIN_R8_MODE'),
      SEO_CHAIN_RM_MODE: this.cfg.get<string>('SEO_CHAIN_RM_MODE'),
      SEO_CHAIN_SHADOW_SAMPLE_RATE: this.cfg.get<string>(
        'SEO_CHAIN_SHADOW_SAMPLE_RATE',
      ),
    });
    if (
      env.SEO_CHAIN_R7_MODE === 'on' ||
      env.SEO_CHAIN_R8_MODE === 'on' ||
      env.SEO_CHAIN_RM_MODE === 'on'
    ) {
      throw new Error(
        `[SEO_SHADOW_BOOT_GUARD] mode=on forbidden (no on-branch shipped). ` +
          `Detected R7=${env.SEO_CHAIN_R7_MODE} R8=${env.SEO_CHAIN_R8_MODE} RM=${env.SEO_CHAIN_RM_MODE}. ` +
          `Flip mode=on requires ADR-055 sign-off + dedicated PR — see governance-vault.`,
      );
    }
    this.logger.log(
      `[SEO_SHADOW] boot OK — R7=${env.SEO_CHAIN_R7_MODE} R8=${env.SEO_CHAIN_R8_MODE} RM=${env.SEO_CHAIN_RM_MODE} sample_rate=${env.SEO_CHAIN_SHADOW_SAMPLE_RATE}`,
    );
  }
}
