/**
 * DiagnosticIntent — V1A.0 Intent Resolution
 *
 * 7 valeurs runtime-only. JAMAIS exposé comme taxonomy SEO / URLs / sitemaps.
 *
 * Source de vérité : ADR vault "Intent Resolution V1 doctrine".
 */
import { z } from 'zod';

export const DiagnosticIntentEnum = z.enum([
  'urgence',
  'garage',
  'maintenance',
  'commerce',
  'devis',
  'education',
  'reassurance',
]);
export type DiagnosticIntent = z.infer<typeof DiagnosticIntentEnum>;

/**
 * ConfidenceBucket — analytics-ready bucketing depuis confidence ∈ [0,1].
 * Cf. ConfidencePolicy ADR + `confidence-policy.ts:getConfidenceBucket()`.
 */
export const ConfidenceBucketEnum = z.enum([
  'weak',
  'ambiguous',
  'plausible',
  'strong',
  'very_strong',
]);
export type ConfidenceBucket = z.infer<typeof ConfidenceBucketEnum>;
