/**
 * Brand RAG Frontmatter Schema — Zod contract canonique pour les .md
 * constructeur ingérés par le R7 enricher.
 *
 * Un seul vocabulaire (EN), sources de vérité explicites, fail-fast au chargement.
 * Remplace l'ancien shim `normalizeBrandRag` qui tolérait FR/EN silencieusement.
 *
 * Alimenté par : scripts/rag/build-brand-rag.py (Wikidata + DB RPC + Wikipedia REST).
 * Lu par : R7BrandEnricherService.loadBrandRag → composeBlocks.
 */

import { z } from 'zod';

// ── Sub-schemas ─────────────────────────────────────────

export const BrandHeadquartersSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
});

export const BrandTopModelSchema = z.object({
  name: z.string().min(1).max(80),
  years: z.string().max(40).optional(), // ex: "2016-present", "1987-1994"
  modele_id: z.number().int().positive().optional(), // FK auto_modele si connu
});

export const BrandTopEngineSchema = z.object({
  code: z.string().min(1).max(40), // ex: "B48", "PureTech"
  displacement_cc: z.number().int().positive().optional(),
  fuel: z.enum(['diesel', 'essence', 'hybrid', 'electric', 'lpg']).optional(),
  power_ps: z.number().int().positive().optional(),
});

export const BrandFaqEntrySchema = z.object({
  q: z.string().min(5).max(200),
  a: z.string().min(20).max(1000),
});

export const BrandIssueSchema = z.object({
  symptom: z.string().min(5).max(200),
  cause: z.string().min(5).max(300).optional(),
  fix_hint: z.string().min(5).max(300).optional(),
});

export const BrandMaintenanceTipSchema = z.object({
  part: z.string().min(1).max(80),
  interval_km: z.number().int().positive().optional(),
  interval_years: z.number().int().positive().optional(),
  note: z.string().max(300).optional(),
});

export const BrandSourceOfTruthSchema = z.object({
  country: z.enum(['wikidata', 'manual', 'unknown']).default('unknown'),
  founded_year: z.enum(['wikidata', 'manual', 'unknown']).default('unknown'),
  group: z.enum(['wikidata', 'manual', 'unknown']).default('unknown'),
  headquarters: z.enum(['wikidata', 'manual', 'unknown']).default('unknown'),
  top_models: z.enum(['db', 'manual', 'unknown']).default('unknown'),
  top_engines: z.enum(['db', 'manual', 'unknown']).default('unknown'),
  history: z.enum(['wikipedia', 'manual', 'unknown']).default('unknown'),
  // Note : faq/common_issues/maintenance_tips ne sont PLUS dans le frontmatter .md.
  // Lus directement depuis __seo_brand_editorial par l'enricher pour éviter
  // la resync manuelle après édition admin. Cf. brand-editorial.service.ts.
});

export const BrandLifecycleSchema = z.object({
  last_enriched_at: z.string().min(10), // ISO date YYYY-MM-DD
  last_enriched_by: z.string().min(1),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{16,}$/),
  schema_version: z.literal(1),
});

// ── Top-level canonical schema ──────────────────────────

export const BrandRagFrontmatterSchema = z.object({
  // Identity (required)
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case lowercase required'),
  brand_id: z.number().int().positive(),
  brand_name: z.string().min(1),
  wikidata_qid: z
    .string()
    .regex(/^Q\d+$/)
    .optional(),

  // Factual metadata (from Wikidata)
  country: z.string().min(2).optional(),
  founded_year: z.number().int().min(1800).max(2100).optional(),
  group: z.string().min(1).max(120).optional(),
  headquarters: BrandHeadquartersSchema.optional(),
  logo_uri: z.string().url().optional(),

  // Catalog metadata (from DB)
  top_models: z.array(BrandTopModelSchema).max(20).default([]),
  top_engines: z.array(BrandTopEngineSchema).max(20).default([]),

  // Prose encyclopédique (from Wikipedia REST). Les champs éditoriaux
  // (faq/common_issues/maintenance_tips) ne sont PAS dans le frontmatter :
  // l'enricher les charge directement depuis __seo_brand_editorial au runtime.
  history: z.string().min(100).max(2000).optional(),

  // Provenance + governance (required)
  source_of_truth: BrandSourceOfTruthSchema,
  lifecycle: BrandLifecycleSchema,

  // Passthrough for pipeline-internal fields (doc_id, content_hash legacy, etc.)
  // Kept flexible to avoid breaking adjacent tooling.
  category: z.literal('constructeur').optional(),
  doc_family: z.string().optional(),
  source_type: z.string().optional(),
  truth_level: z.string().optional(),
  verification_status: z
    .enum(['draft', 'oem_verified', 'editorial_reviewed'])
    .optional(),
  lang: z.literal('fr').default('fr'),
  doc_id: z.string().optional(),
  content_hash: z.string().optional(),
  updated_at: z.string().optional(),
  intent_targets: z.array(z.string()).optional(),
  business_priority: z.enum(['high', 'medium', 'low']).optional(),
  domain: z
    .object({
      role: z.string().optional(),
      must_be_true: z.array(z.string()).optional(),
      must_not_contain: z.array(z.string()).optional(),
    })
    .optional(),
});

export type BrandRagFrontmatter = z.infer<typeof BrandRagFrontmatterSchema>;
export type BrandTopModel = z.infer<typeof BrandTopModelSchema>;
export type BrandTopEngine = z.infer<typeof BrandTopEngineSchema>;
export type BrandFaqEntry = z.infer<typeof BrandFaqEntrySchema>;
export type BrandIssue = z.infer<typeof BrandIssueSchema>;
export type BrandMaintenanceTip = z.infer<typeof BrandMaintenanceTipSchema>;

/**
 * Parse + validate frontmatter YAML. Throws a ZodError with a readable
 * message when the .md does not match the canonical contract.
 */
export function parseBrandRagFrontmatter(raw: unknown): BrandRagFrontmatter {
  return BrandRagFrontmatterSchema.parse(raw);
}

/**
 * Safe variant that returns { success, data | error } without throwing.
 * Useful when ingesting 36 .md and reporting partial failures.
 */
export function safeParseBrandRagFrontmatter(raw: unknown) {
  return BrandRagFrontmatterSchema.safeParse(raw);
}
