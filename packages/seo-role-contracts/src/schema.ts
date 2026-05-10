/**
 * RoleContract Zod schema — SoT comportemental R-stack
 *
 * Single source of truth pour les règles métier R0..R8 :
 *   - sections autorisées + longueurs min/max
 *   - forbidden_overlap (termes interdits par paire de rôles)
 *   - schemas Schema.org émis par template_type
 *   - intents sémantiques
 *   - uniqueness_thresholds (entropy, jaccard, template-phrase ratio)
 *   - promotion_gate (validations multi-domaine fail-closed)
 *
 * Cf. ADR-046 § L1.5 CONTRACTS + ADR-047 (governance-vault PR #183 accepted).
 */
import { z } from "zod";
import { RoleId } from "@repo/seo-roles";

/** Spec d'une section éditoriale d'un rôle (ex: R1_S0..R1_S9). */
export const SectionSpec = z.object({
  id: z.string().min(1),
  min_chars: z.number().int().nonnegative(),
  max_chars: z.number().int().nonnegative(),
  required: z.boolean().default(true),
  description: z.string().optional(),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

/** Schema.org types acceptés par template_type SEO. */
export const SchemaOrgType = z.enum([
  "Article",
  "FAQPage",
  "HowTo",
  "Product",
  "Offer",
  "AggregateRating",
  "Review",
  "Brand",
  "Vehicle",
  "BreadcrumbList",
]);
export type SchemaOrgType = z.infer<typeof SchemaOrgType>;

/** Intents sémantiques canon (alignés sur @repo/seo-roles intents.ts). */
export const SemanticIntent = z.enum([
  "transactional",
  "informational",
  "navigational",
  "investigational",
]);
export type SemanticIntent = z.infer<typeof SemanticIntent>;

/** Validations multi-domaine requises pour promotion L1 wiki → L2 exports. */
export const ValidationDomain = z.enum([
  "semantic",
  "role",
  "diagnostic",
  "license",
]);
export type ValidationDomain = z.infer<typeof ValidationDomain>;

/** Règles de contenu spécifiques (definitions, procedures, comparisons, ...). */
export const ContentContracts = z
  .object({
    definition: z.string().optional(),
    procedure: z.string().optional(),
    comparison: z.string().optional(),
    diagnostic: z.string().optional(),
  })
  .partial();
export type ContentContracts = z.infer<typeof ContentContracts>;

/** Seuils de diversité/unicité (entropy lexicale Shannon, Jaccard inter-gamme, template-phrase ratio, ...). */
export const UniquenessThresholds = z
  .object({
    min_specific_ratio: z.number().min(0).max(1).optional(),
    max_boilerplate: z.number().min(0).max(1).optional(),
    min_entropy_shannon: z.number().nonnegative().optional(),
    max_jaccard_inter_gamme: z.number().min(0).max(1).optional(),
    max_template_phrase_ratio: z.number().min(0).max(1).optional(),
  })
  .partial();
export type UniquenessThresholds = z.infer<typeof UniquenessThresholds>;

/** Promotion gate L1 → L2 — fail-closed multi-domaine. */
export const PromotionGate = z.object({
  requires_validations: z.array(ValidationDomain).min(1),
});
export type PromotionGate = z.infer<typeof PromotionGate>;

/**
 * Contract canonique d'un rôle R\* (1 instance par RoleId actif).
 *
 * Lecteurs canoniques (DI seul moyen) :
 *   - L4 enrichers backend (`r1-enricher`, `conseil-enricher`, ...)
 *   - Validators (`r1-router-validator`, `gatekeeper`, `content-quality-gate`)
 *   - Frontend badges qualité admin
 *   - AGENTS.md (référence textuelle vers `contracts/r{N}.ts`)
 */
export const RoleContract = z.object({
  id: z.nativeEnum(RoleId),
  allowed_sections: z.array(SectionSpec),
  forbidden_overlap: z.array(z.union([z.string(), z.nativeEnum(RoleId)])),
  allowed_schemas: z.array(SchemaOrgType),
  content_contracts: ContentContracts,
  semantic_intents: z.array(SemanticIntent).min(1),
  uniqueness_thresholds: UniquenessThresholds,
  promotion_gate: PromotionGate,
});
export type RoleContract = z.infer<typeof RoleContract>;
