import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sampler déterministe pour `SeoShadowObservatory`.
 *
 * Hash sha1(`${surface}:${entityId}`) % 2^32 / 2^32 ∈ [0, 1[ comparé au taux
 * d'échantillonnage. La même paire (surface, entityId) est **toujours** ou
 * **jamais** échantillonnée pour un taux fixe — ça permet :
 *   - Un diff reproductible en preprod (même URLs sont observées).
 *   - Une couverture homogène quel que soit le trafic.
 *   - Des tests stables sans `jest.spyOn(Math, 'random')`.
 *
 * Default conservateur : 1% (`0.01`). Volume `__seo_event_log` inconnu pour
 * cette nouvelle source ; on commence bas, on évalue J+1 avant d'augmenter.
 *
 * @see plan seo-v9 PR-6 §4.2
 */
@Injectable()
export class SeoShadowSampler {
  private readonly rate: number;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('SEO_CHAIN_SHADOW_SAMPLE_RATE') ?? '0.01';
    const parsed = Number.parseFloat(raw);
    this.rate =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.01;
  }

  /** Décide si l'observation doit être réalisée pour cette paire. */
  shouldSample(surface: string, entityId: string): boolean {
    if (this.rate <= 0) return false;
    if (this.rate >= 1) return true;
    const digest = createHash('sha1').update(`${surface}:${entityId}`).digest();
    const bucket = digest.readUInt32BE(0) / 0xffffffff;
    return bucket < this.rate;
  }

  /** Exposé pour observabilité (tests, audit logs). */
  get sampleRate(): number {
    return this.rate;
  }
}
