import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/**
 * Modes d'exécution des chains SEO :
 *   - `off`    : chain désactivée, comportement legacy V4 préservé.
 *   - `shadow` : chain exécutée mais résultat NON renvoyé (audit/observabilité).
 *   - `on`     : chain exécutée et résultat injecté en prod.
 *
 * Convention env var : `SEO_CHAIN_<FLAG>_MODE` (ex: `SEO_CHAIN_R8_MODE=shadow`).
 */
export const SeoChainModeSchema = z.enum(['off', 'shadow', 'on']);
export type SeoChainMode = z.infer<typeof SeoChainModeSchema>;

export const SeoChainFlagKeySchema = z.enum([
  'RM', // /api/rm/page-v2 (R1 produit)
  'GAMME', // /api/gamme-rest (R1 fallback)
  'R7', // hub marque
  'R8', // véhicule
  'HOME', // R0
  'R2', // fiche produit (différé)
  'BLOG', // différé
  'DUPLICATE_GATE', // PR-9
]);
export type SeoChainFlagKey = z.infer<typeof SeoChainFlagKeySchema>;

/**
 * Centralise la lecture des `SEO_CHAIN_*_MODE` (env vars). Lecture lazy :
 * pas de cache pour permettre les changements à chaud lors du rollout.
 */
@Injectable()
export class SeoFeatureFlagRegistry {
  /** Lit le mode pour un flag donné. Default 'off'. */
  mode(flag: SeoChainFlagKey): SeoChainMode {
    SeoChainFlagKeySchema.parse(flag);
    const envKey = `SEO_CHAIN_${flag}_MODE`;
    const raw = process.env[envKey] ?? 'off';
    const parsed = SeoChainModeSchema.safeParse(raw);
    return parsed.success ? parsed.data : 'off'; // fallback off si valeur invalide
  }

  /** Liste tous les flags disponibles. */
  list(): SeoChainFlagKey[] {
    return SeoChainFlagKeySchema.options as SeoChainFlagKey[];
  }

  /** Snapshot { flag → mode } courant. Utile pour audit log + dashboards. */
  snapshot(): Record<SeoChainFlagKey, SeoChainMode> {
    const out = {} as Record<SeoChainFlagKey, SeoChainMode>;
    for (const flag of this.list()) {
      out[flag] = this.mode(flag);
    }
    return out;
  }
}
