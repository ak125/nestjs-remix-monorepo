import { z } from 'zod';

/**
 * Schema Zod des ENV vars consommées par le module observatory.
 * Validé au démarrage (`onModuleInit` du module) — fail-fast sur valeur
 * malformée (`SEO_CHAIN_R7_MODE=tru` → throw, container ne boot pas).
 *
 * Defense in depth (cf. plan PR-6 §4.7) :
 *   - Zod refuse les valeurs malformées au démarrage.
 *   - Boot guard `throw` refuse `mode=on` (PR-6 ne livre PAS la branche on).
 *   - CI guard refuse `SEO_CHAIN_R*_MODE=on` dans la config commit.
 *
 * Default `SEO_CHAIN_SHADOW_SAMPLE_RATE=0.01` (1%) — démarrage conservateur,
 * volume `__seo_event_log` inconnu sur cette nouvelle source.
 */
export const SeoShadowEnvSchema = z.object({
  SEO_CHAIN_R7_MODE: z.enum(['off', 'shadow', 'on']).default('off'),
  SEO_CHAIN_R8_MODE: z.enum(['off', 'shadow', 'on']).default('off'),
  SEO_CHAIN_SHADOW_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.01),
});
export type SeoShadowEnv = z.infer<typeof SeoShadowEnvSchema>;
