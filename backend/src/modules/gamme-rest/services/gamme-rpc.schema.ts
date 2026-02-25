import { z } from 'zod';

/**
 * Schema Zod pour la reponse RPC `get_gamme_page_data_optimized`.
 *
 * Mode: LOGGING-ONLY — ne bloque pas le flux, log les ecarts.
 * Objectif: detecter les regressions de schema (colonnes manquantes,
 * types inattendus) sans casser la production.
 */

const SeoFragmentRowSchema = z.object({
  sis_id: z.number(),
  sis_content: z.string(),
});

const MotorizationRowSchema = z
  .object({
    type_id: z.number(),
    marque_name: z.string().optional(),
    modele_name: z.string().optional(),
    type_name: z.string().optional(),
    type_fuel: z.string().optional(),
    cgc_level: z.string().optional(),
  })
  .passthrough();

const ConseilRowSchema = z
  .object({
    sgc_id: z.union([z.string(), z.number()]),
    sgc_title: z.string().nullable().optional(),
    sgc_content: z.string().nullable().optional(),
  })
  .passthrough();

const EquipementierRowSchema = z
  .object({
    seg_pm_id: z.union([z.string(), z.number()]).optional(),
    pm_name: z.string().optional(),
  })
  .passthrough();

const CgcLevelStatsSchema = z.object({
  level_1: z.number(),
  level_2: z.number(),
  level_3: z.number(),
  level_5: z.number(),
  total: z.number(),
});

const SeoValidationSchema = z.object({
  family_count: z.number(),
  gamme_count: z.number(),
});

const PageInfoSchema = z
  .object({
    pg_name: z.string().nullable().optional(),
    pg_alias: z.string().nullable().optional(),
    pg_level: z.union([z.string(), z.number()]).nullable().optional(),
    pg_img: z.string().nullable().optional(),
    pg_wall: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Schema top-level de la reponse RPC aggregee.
 *
 * Chaque sous-objet est optionnel car le RPC peut retourner des resultats
 * partiels (ex: gamme sans conseils, sans blog, etc.).
 */
export const GammeRpcAggregatedDataSchema = z
  .object({
    page_info: PageInfoSchema,
    seo: z.record(z.unknown()).nullable().optional(),
    conseils: z.array(ConseilRowSchema).optional(),
    informations: z.array(z.record(z.unknown())).optional(),
    equipementiers: z.array(EquipementierRowSchema).optional(),
    blog: z.record(z.unknown()).nullable().optional(),
    catalogue_famille: z.array(z.record(z.unknown())).optional(),
    famille_info: z.record(z.unknown()).nullable().optional(),
    motorisations_enriched: z.array(MotorizationRowSchema).optional(),
    seo_fragments_1: z.array(SeoFragmentRowSchema).optional(),
    seo_fragments_2: z.array(SeoFragmentRowSchema).optional(),
    cgc_level_stats: CgcLevelStatsSchema.optional(),
    motorisations_blog: z.array(MotorizationRowSchema).optional(),
    seo_validation: SeoValidationSchema.optional(),
  })
  .passthrough();

export type GammeRpcAggregatedData = z.infer<
  typeof GammeRpcAggregatedDataSchema
>;
