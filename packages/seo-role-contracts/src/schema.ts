/**
 * Zod schemas pour @repo/seo-role-contracts.
 *
 * Implémente ADR-047 (SoT comportemental R-stack séparé de l'identité).
 * Couvre les 4 trous comportementaux v2 du plan refondation :
 *   - inputs (trou #5)
 *   - gate_strictness (trou #6)
 *   - output_consumers (trou #7)
 *   - quality_metrics (trou #8)
 */

import { z } from 'zod';
import { RoleId } from '@repo/seo-roles';

// ─────────────────────────────────────────────────────────────────────────────
// SectionSpec — borne longueur + obligation par section d'un rôle
// ─────────────────────────────────────────────────────────────────────────────

export const SectionSpec = z.object({
  id: z.string().min(1), // ex: "R1_S0", "R1_S4_MICRO_SEO"
  min_chars: z.number().int().nonnegative(),
  max_chars: z.number().int().nonnegative(),
  required: z.boolean().default(true),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs — sources requises par un enricher (Wiki + DB + KW/KP)
// ─────────────────────────────────────────────────────────────────────────────

export const InputSpec = z.object({
  required: z.boolean(),
  description: z.string().optional(),
});

export const RoleInputs = z.object({
  wiki: InputSpec.extend({
    source_pattern: z.string().optional(), // ex: "rag/knowledge/gammes/${pgAlias}.md"
    fallback_policy: z.enum(['fail', 'skip']).default('fail'),
  }).optional(),
  db: InputSpec.extend({
    tables: z.array(z.string()).default([]),
    rpcs: z.array(z.string()).default([]),
  }).optional(),
  kw: InputSpec.extend({
    plan_table: z.string().nullable().default(null), // ex: "__seo_r1_keyword_plan"
    read_columns: z.array(z.string()).default([]),
  }).optional(),
});
export type RoleInputs = z.infer<typeof RoleInputs>;

// ─────────────────────────────────────────────────────────────────────────────
// Gate strictness — fail-closed vs warn par gate type
// ─────────────────────────────────────────────────────────────────────────────

export const GateMode = z.enum(['fail-closed', 'warn']);

export const GateStrictness = z.object({
  quality_gate: GateMode.default('fail-closed'),
  forbidden_overlap: GateMode.default('fail-closed'),
  min_chars_pre_write: GateMode.default('warn'),
});
export type GateStrictness = z.infer<typeof GateStrictness>;

// ─────────────────────────────────────────────────────────────────────────────
// Output consumers — qui lit les outputs (sitemap, dynamic SEO, maillage)
// ─────────────────────────────────────────────────────────────────────────────

export const OutputConsumers = z.object({
  sitemap: z
    .object({
      include_predicate_sql: z.string().optional(), // ex: "gatekeeper_score >= 70"
      threshold_gatekeeper_score: z.number().int().min(0).max(100).default(70),
    })
    .optional(),
  dynamic_seo_v4: z
    .object({
      source_columns: z.array(z.string()).default([]),
      fallback_to_aggregates: z.boolean().default(true),
    })
    .optional(),
  maillage_targets: z.array(z.nativeEnum(RoleId)).default([]),
});
export type OutputConsumers = z.infer<typeof OutputConsumers>;

// ─────────────────────────────────────────────────────────────────────────────
// Quality metrics — métriques trackées + seuils alertes (ADR-050)
// ─────────────────────────────────────────────────────────────────────────────

export const QualityMetric = z.enum([
  'char_count',
  'gatekeeper_score',
  'entropy_shannon',
  'specific_content_ratio',
  'boilerplate_ratio',
  'jaccard_inter_gamme',
  'template_phrase_ratio',
]);

export const SnapshotFrequency = z.enum(['monthly', 'weekly']);

export const AlertThreshold = z.object({
  metric: QualityMetric,
  drop_pct: z.number().min(0).max(1), // ex: 0.15 = drop > 15%
  window_days: z.number().int().positive().default(30),
});

export const QualityMetrics = z.object({
  tracked_metrics: z.array(QualityMetric).default(['char_count', 'gatekeeper_score']),
  snapshot_frequency: SnapshotFrequency.default('monthly'),
  alert_thresholds: z.array(AlertThreshold).default([]),
});
export type QualityMetrics = z.infer<typeof QualityMetrics>;

// ─────────────────────────────────────────────────────────────────────────────
// Promotion gate — validations requises avant L1→L2
// ─────────────────────────────────────────────────────────────────────────────

export const PromotionValidation = z.enum([
  'semantic',
  'role',
  'diagnostic',
  'license',
]);

export const PromotionGate = z.object({
  requires_validations: z.array(PromotionValidation).default([
    'semantic',
    'role',
    'diagnostic',
    'license',
  ]),
});
export type PromotionGate = z.infer<typeof PromotionGate>;

// ─────────────────────────────────────────────────────────────────────────────
// Schema.org allowed schemas
// ─────────────────────────────────────────────────────────────────────────────

export const AllowedSchema = z.enum([
  'Article',
  'FAQPage',
  'HowTo',
  'Product',
  'Offer',
  'AggregateRating',
  'Review',
  'Brand',
  'Vehicle',
  'BreadcrumbList',
  'WebPage',
  'CollectionPage',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Content contracts — patterns canon par section
// ─────────────────────────────────────────────────────────────────────────────

export const ContentContracts = z.object({
  definition: z.string().optional(),
  procedure: z.string().optional(),
  comparison: z.string().optional(),
  diagnostic: z.string().optional(),
  decision: z.string().optional(),
  identity: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Semantic intents
// ─────────────────────────────────────────────────────────────────────────────

export const SemanticIntent = z.enum([
  'transactional',
  'informational',
  'navigational',
  'investigational',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Uniqueness thresholds (anti-thin content)
// ─────────────────────────────────────────────────────────────────────────────

export const UniquenessThresholds = z
  .object({
    min_specific_ratio: z.number().min(0).max(1).default(0.6),
    max_boilerplate: z.number().min(0).max(1).default(0.4),
    min_entropy_shannon: z.number().nonnegative().optional(),
    max_jaccard_inter_gamme: z.number().min(0).max(1).optional(),
    max_template_phrase_ratio: z.number().min(0).max(1).optional(),
  })
  .partial();

// ─────────────────────────────────────────────────────────────────────────────
// RoleContract — la struct centrale, 1 par RoleId
// ─────────────────────────────────────────────────────────────────────────────

export const RoleContract = z.object({
  id: z.nativeEnum(RoleId),

  // Sections + longueurs
  allowed_sections: z.array(SectionSpec),

  // Anti-cannibalisation : termes ou rôles dont on évite l'overlap
  forbidden_overlap: z.array(z.union([z.string(), z.nativeEnum(RoleId)])).default([]),

  // Schemas Schema.org émis
  allowed_schemas: z.array(AllowedSchema).default([]),

  // Patterns canon par section
  content_contracts: ContentContracts.partial().default({}),

  // Intent SEO du rôle
  semantic_intents: z.array(SemanticIntent).default([]),

  // Anti-thin content
  uniqueness_thresholds: UniquenessThresholds.default({}),

  // Promotion L1→L2 fail-closed multi-domaine
  promotion_gate: PromotionGate.default({
    requires_validations: ['semantic', 'role', 'diagnostic', 'license'],
  }),

  // EXTENSION v2 — sceller les 4 trous comportementaux
  inputs: RoleInputs.default({}),
  inputs_completeness_gate: GateMode.default('fail-closed'),
  gate_strictness: GateStrictness.default({}),
  output_consumers: OutputConsumers.default({}),
  quality_metrics: QualityMetrics.default({}),
});
export type RoleContract = z.infer<typeof RoleContract>;
