import { z } from 'zod';

import { SurfaceKeySchema } from '@repo/seo-role-contracts';

/**
 * Snapshot SEO comparable côté legacy (extrait du payload RPC R7/R8).
 * Tous les champs optionnels — un legacy minimaliste reste exploitable.
 */
const LegacySeoSnapshotSchema = z
  .object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    h1: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    keywords: z.string().nullable().optional(),
    canonical: z.string().nullable().optional(),
    robots: z.string().nullable().optional(),
  })
  .passthrough();
export type LegacySeoSnapshot = z.infer<typeof LegacySeoSnapshotSchema>;

/**
 * Snapshot SEO côté chaîne (résultat normalisé après orchestrateur + canonical
 * + indexability). Les `null` sont autorisés quand l'info n'est pas calculable.
 */
export const ChainSeoSnapshotSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  h1: z.string().nullable(),
  content: z.string().nullable(),
  keywords: z.string().nullable(),
  canonical: z.string().nullable(),
  robots: z.string().nullable(),
});
export type ChainSeoSnapshot = z.infer<typeof ChainSeoSnapshotSchema>;

/**
 * Input du `SeoShadowObservatory.observe()`. Validé Zod à chaque appel
 * (fail-fast). Caller buggé → log + no-op, jamais de crash propagé.
 */
export const ShadowObservationInputSchema = z.object({
  surface: SurfaceKeySchema,
  legacy: LegacySeoSnapshotSchema,
  requestUrl: z.string().min(1),
  ids: z.record(z.string(), z.union([z.string(), z.number()])),
  vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  entityId: z.string().min(1),
});
export type ShadowObservationInput = z.infer<
  typeof ShadowObservationInputSchema
>;

/**
 * Diff structuré d'un champ SEO. `equal=null` = non comparable
 * (ex: legacy.robots absent, ou skip explicite — cf. R8 canonical).
 */
export interface FieldDiff {
  field:
    | 'title'
    | 'description'
    | 'h1'
    | 'content'
    | 'keywords'
    | 'canonical'
    | 'robots';
  equal: boolean | null;
  legacyHash: string | null; // sha256 12 hex chars
  chainHash: string | null;
  legacyLen: number | null;
  chainLen: number | null;
  /** Renseigné si `equal=null` par décision explicite. */
  skip_reason?: string;
}

/**
 * Résultat global du diff pour une observation shadow. Persisté en
 * `__seo_event_log.payload` (cf. SeoShadowEventSink).
 */
export interface DiffResult {
  diffs: FieldDiff[];
  /** Sous-ensemble de fields où `equal=false` (jamais `null`). */
  divergenceTypes: string[];
  /** True si canonical_eq=false OU robots_eq=false. */
  policyDivergence: boolean;
  /** Résumé compact pour log warn. */
  summary: {
    surface: string;
    divergenceCount: number;
    divergenceTypes: string[];
  };
}
