/**
 * Wiki Proposal Frontmatter Schema — Zod canonique TS, miroir du JSON Schema
 * Draft 2020-12 défini dans `automecanik-wiki/_meta/schema/frontmatter.schema.json`
 * (343 lignes). Source de vérité = ce JSON Schema, ce fichier en est la
 * dérivation TS pour usage runtime côté monorepo (Partie 3 ADR-033 différée).
 *
 * Versions supportées :
 *   - `schema_version: "0.legacy"`   — fiches recyclées de `automecanik-rag/knowledge/`
 *   - `schema_version: "1.0.0"`      — schema initial ADR-031
 *   - `schema_version: "2.0.0"`      — ajout `diagnostic_relations[]` top-level (ADR-033)
 *                                      + `entity_data.maintenance{}` (ADR-032)
 *
 * Pendant la migration Phase 4 ADR-033 (500+ fiches gamme), v1.0.0 et v2.0.0
 * cohabitent. Cette Zod accepte les 3 versions dans une même validation.
 *
 * Pattern : extension d'ADR-037 (`agent-frontmatter.schema.ts`) +
 * ADR-038 (`marketing-agent-frontmatter.schema.ts`) au scope wiki.
 *
 * Référence canon : `governance-vault/ledger/decisions/adr/ADR-031-four-layer-content-architecture.md`
 *                   `governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md`
 *                   `governance-vault/ledger/decisions/adr/ADR-033-wiki-gamme-diagnostic-relations-contract.md`
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────────────
//  Sub-enums et patterns canon
// ────────────────────────────────────────────────────────────

export const WikiEntityType = z.enum([
  'gamme',
  'vehicle',
  'constructeur',
  'support',
  'diagnostic',
]);
export type WikiEntityType = z.infer<typeof WikiEntityType>;

export const WikiTruthLevel = z.enum(['L1', 'L2', 'L3', 'L4']);
export type WikiTruthLevel = z.infer<typeof WikiTruthLevel>;

export const WikiReviewStatus = z.enum([
  'draft',
  'proposed',
  'in_review',
  'approved',
  'deprecated',
]);
export type WikiReviewStatus = z.infer<typeof WikiReviewStatus>;

export const WikiTargetClass = z.enum([
  'KB_Knowledge',
  'KB_Catalog',
  'KB_Diagnostic',
  'KB_Media',
  'KB_RouterMemory',
]);
export type WikiTargetClass = z.infer<typeof WikiTargetClass>;

/** Slug kebab-case ASCII, max 80 chars, pas de double-hyphen, pas commencer/finir par hyphen. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;

/** UUIDv7 (timestamp-prefixed, sortable). */
const UUIDV7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Content hash format `sha256:<64 hex>`. */
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** schema_version : 0.legacy ou semver. */
const SCHEMA_VERSION_PATTERN = /^(0\.legacy|[0-9]+\.[0-9]+\.[0-9]+)$/;

/** id URN : `<entity_type>:<slug>`. */
const ID_PATTERN =
  /^(gamme|vehicle|constructeur|support|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** ISO 8601 date `YYYY-MM-DD`. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Slug source-catalog : kebab/snake mixte + suffixe optionnel `_p<N>` pour pagination. */
const SOURCE_SLUG_PATTERN = /^[a-z][a-z0-9_-]*[a-z0-9](?:_p\d+)?$/;

/** Slug `__diag_symptom.slug` ou `__diag_system.slug` : kebab/snake. */
const DIAG_SLUG_PATTERN = /^[a-z][a-z0-9_-]*[a-z0-9]$/;

/** fingerprint : SHA-256 [:16] hex. */
const FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;

// ────────────────────────────────────────────────────────────
//  source_refs[] — discriminated union sur `kind`
// ────────────────────────────────────────────────────────────

const SourceRefRawSchema = z.object({
  kind: z.literal('raw'),
  path: z.string().min(1),
  cid: z.string().regex(SHA256_PATTERN).optional(),
  captured_at: z.string().regex(ISO_DATE_PATTERN).optional(),
});

const SourceRefExternalUrlSchema = z.object({
  kind: z.literal('external_url'),
  url: z.string().url(),
  captured_at: z.string().regex(ISO_DATE_PATTERN),
  archive_path: z.string().optional(),
});

const SourceRefManualSchema = z.object({
  kind: z.literal('manual'),
  note: z.string().min(1),
  author: z.string().min(1),
});

const SourceRefRecycledSchema = z.object({
  kind: z.literal('recycled'),
  origin_repo: z.string().min(1),
  origin_path: z.string().min(1),
  captured_at: z.string().regex(ISO_DATE_PATTERN).optional(),
});

export const WikiSourceRefSchema = z.discriminatedUnion('kind', [
  SourceRefRawSchema,
  SourceRefExternalUrlSchema,
  SourceRefManualSchema,
  SourceRefRecycledSchema,
]);
export type WikiSourceRef = z.infer<typeof WikiSourceRefSchema>;

// ────────────────────────────────────────────────────────────
//  diagnostic_relations[] — canon ADR-033 §D1 (v2.0.0)
// ────────────────────────────────────────────────────────────

export const DiagnosticEvidenceConfidence = z.enum(['low', 'medium', 'high']);
export const DiagnosticEvidenceSourcePolicy = z.enum([
  '1_high',
  '2_medium_concordant',
  'manual_review',
]);
export const DiagnosticRelationToPart = z.enum([
  'possible_cause',
  'symptom_amplifier',
  'secondary_effect',
]);

export const DiagnosticEvidenceSchema = z
  .object({
    confidence: DiagnosticEvidenceConfidence,
    source_policy: DiagnosticEvidenceSourcePolicy,
    reviewed: z.boolean().default(false),
    diagnostic_safe: z.boolean().default(false),
    confidence_score_computed: z.number().min(0).max(1).optional(),
  })
  .strict();

export const DiagnosticRelationSchema = z
  .object({
    symptom_slug: z.string().regex(DIAG_SLUG_PATTERN).max(80),
    system_slug: z.string().regex(DIAG_SLUG_PATTERN).max(60),
    relation_to_part: DiagnosticRelationToPart,
    part_role: z.string().min(10).max(280),
    evidence: DiagnosticEvidenceSchema,
    sources: z.array(z.string().regex(SOURCE_SLUG_PATTERN)).min(1),
    fingerprint: z.string().regex(FINGERPRINT_PATTERN).optional(),
  })
  .strict();
export type DiagnosticRelation = z.infer<typeof DiagnosticRelationSchema>;

// ────────────────────────────────────────────────────────────
//  exportable, provenance, target_classes
// ────────────────────────────────────────────────────────────

export const WikiExportableSchema = z
  .object({
    rag: z.boolean().default(false),
    seo: z.boolean().default(false),
    support: z.boolean().default(false),
    content: z.boolean().default(false).optional(),
  })
  .strict();
export type WikiExportable = z.infer<typeof WikiExportableSchema>;

export const WikiProvenanceSchema = z
  .object({
    ingested_by: z.string().min(1).optional(),
    promoted_from: z.string().nullable().optional(),
    promoted_at: z.string().datetime().optional(),
  })
  .strict();
export type WikiProvenance = z.infer<typeof WikiProvenanceSchema>;

// ────────────────────────────────────────────────────────────
//  entity_data — typage délégué aux sous-schemas par entity_type
//  (validation light côté Zod top-level, validation stricte côté
//  `_meta/schema/entity-data/<type>.schema.json` côté wiki repo)
// ────────────────────────────────────────────────────────────

export const WikiEntityDataSchema = z
  .object({
    // Champs gamme courants — non-strict pour cohabitation v1/v2 et hétérogénéité
    pg_id: z.number().int().positive().optional(),
    family: z.string().optional(),
    intents: z.array(z.string()).optional(),
    vlevel: z.string().optional(),
    related_parts: z.array(z.unknown()).optional(),
    // Bloc maintenance ADR-032 (v2.0.0) — cohabite avec diagnostic_relations[]
    maintenance: z
      .object({
        educational_advice: z.string().optional(),
        related_pages: z.array(z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type WikiEntityData = z.infer<typeof WikiEntityDataSchema>;

// ────────────────────────────────────────────────────────────
//  Top-level frontmatter
// ────────────────────────────────────────────────────────────

const WikiProposalFrontmatterBase = z
  .object({
    schema_version: z.string().regex(SCHEMA_VERSION_PATTERN),
    id: z.string().regex(ID_PATTERN),
    entity_type: WikiEntityType,
    slug: z.string().regex(SLUG_PATTERN).max(80),
    title: z.string().min(1).max(200),
    aliases: z.array(z.string().min(1)).default([]),
    lang: z.enum(['fr', 'en']).default('fr'),
    created_at: z.string().regex(ISO_DATE_PATTERN),
    updated_at: z.string().regex(ISO_DATE_PATTERN),
    truth_level: WikiTruthLevel,
    source_refs: z.array(WikiSourceRefSchema).default([]),
    provenance: WikiProvenanceSchema.optional(),
    lineage_id: z.string().regex(UUIDV7_PATTERN).optional(),
    content_hash: z.string().regex(SHA256_PATTERN).optional(),
    parents: z.array(z.string().regex(UUIDV7_PATTERN)).default([]),
    review_status: WikiReviewStatus,
    reviewed_by: z.string().nullable().optional(),
    reviewed_at: z.string().datetime().nullable().optional(),
    review_notes: z.string().default(''),
    no_disputed_claims: z.boolean().default(true),
    quality_score: z.number().min(0).max(1).nullable().optional(),
    confidence_score: z.number().min(0).max(1).nullable().optional(),
    exportable: WikiExportableSchema,
    target_classes: z.array(WikiTargetClass).default([]),
    entity_data: WikiEntityDataSchema.optional(),
    diagnostic_relations: z.array(DiagnosticRelationSchema).default([]),
  })
  .strict();

/**
 * Wiki Proposal Frontmatter Schema — strict, applies the JSON Schema's
 * `allOf` conditional rules via `.superRefine()`.
 *
 * Conditional validations (mirror JSON Schema):
 *  1. truth_level ∈ {L1, L2, L3} → source_refs.length >= 1
 *  2. exportable.{rag|seo|support} = true → review_status = "approved"
 *     ET no_disputed_claims = true ET reviewed_by/reviewed_at NOT NULL
 */
export const WikiProposalFrontmatterSchema =
  WikiProposalFrontmatterBase.superRefine((data, ctx) => {
    // Rule 1 : truth_level L1/L2/L3 require source_refs >= 1
    if (
      ['L1', 'L2', 'L3'].includes(data.truth_level) &&
      data.source_refs.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_refs'],
        message: `truth_level=${data.truth_level} requires at least 1 source_refs entry (canon ADR-031, anti-pattern AP-LLM-only-seed)`,
      });
    }

    // Rule 2 : exportable.{rag|seo|support}=true requires approved + no_disputed + reviewed_by/at
    const isExported =
      data.exportable.rag === true ||
      data.exportable.seo === true ||
      data.exportable.support === true;
    if (isExported) {
      if (data.review_status !== 'approved') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_status'],
          message: `exportable=true requires review_status="approved" (got "${data.review_status}")`,
        });
      }
      if (data.no_disputed_claims !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['no_disputed_claims'],
          message: `exportable=true requires no_disputed_claims=true`,
        });
      }
      if (!data.reviewed_by) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewed_by'],
          message: `exportable=true requires reviewed_by (non-null)`,
        });
      }
      if (!data.reviewed_at) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewed_at'],
          message: `exportable=true requires reviewed_at (non-null)`,
        });
      }
    }

    // Rule 3 : id must match `<entity_type>:<slug>` format
    const expectedId = `${data.entity_type}:${data.slug}`;
    if (data.id !== expectedId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: `id "${data.id}" must equal "${expectedId}" (entity_type + ":" + slug)`,
      });
    }
  });

export type WikiProposalFrontmatter = z.infer<
  typeof WikiProposalFrontmatterSchema
>;

/**
 * Parse + validate frontmatter. Throws ZodError au premier souci.
 * Utilisé en strict (CLI validator, runtime backend ingestion future).
 */
export function parseWikiProposalFrontmatter(
  raw: unknown,
): WikiProposalFrontmatter {
  return WikiProposalFrontmatterSchema.parse(raw);
}

/**
 * Variante safe — retourne { success, data | error } sans throw.
 * Utilisée par `scripts/wiki/validate-proposal.ts` pour agréger les erreurs
 * sur N proposals avant de fail-fast la CI.
 */
export function safeParseWikiProposalFrontmatter(raw: unknown) {
  return WikiProposalFrontmatterSchema.safeParse(raw);
}
