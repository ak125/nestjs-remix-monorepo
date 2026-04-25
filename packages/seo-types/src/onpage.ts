/**
 * On-page audit findings — Zod schemas for the unified `__seo_audit_findings` table.
 *
 * Single Postgres table replaces 5 specialized tables (schema_violations,
 * meta_experiments, image_audit, canonical_audit, internal_link_suggestions).
 *
 * Discrimination by `audit_type` ENUM + typed `payload` per variant.
 */
import { z } from "zod";

// ─── Discriminator ────────────────────────────────────────────────────────

export const AuditTypeSchema = z.enum([
  "schema_violation",
  "image_seo",
  "canonical_conflict",
  "meta_experiment",
  "internal_link_suggestion",
]);
export type AuditType = z.infer<typeof AuditTypeSchema>;

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ─── Payload variants (one per audit_type) ────────────────────────────────

export const SchemaViolationPayloadSchema = z.object({
  schema_type: z.enum(["Product", "FAQ", "Breadcrumb", "Article", "HowTo", "LocalBusiness", "Person"]),
  error_type: z.enum([
    "missing_required_field",
    "invalid_value",
    "deprecated_property",
    "type_mismatch",
    "url_unreachable",
  ]),
  field: z.string().optional(),
  expected: z.string().optional(),
  observed: z.string().optional(),
  rich_results_eligible: z.boolean().optional(),
});
export type SchemaViolationPayload = z.infer<typeof SchemaViolationPayloadSchema>;

export const ImageSeoPayloadSchema = z.object({
  image_url: z.string().url(),
  alt_present: z.boolean(),
  alt_text: z.string().nullable(),
  format: z.enum(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "other"]),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  file_size_kb: z.number().nullable(),
  lazy_loading: z.boolean().nullable(),
  in_viewport_initially: z.boolean().optional(),
});
export type ImageSeoPayload = z.infer<typeof ImageSeoPayloadSchema>;

export const CanonicalConflictPayloadSchema = z.object({
  declared_canonical: z.string().url().nullable(),
  computed_canonical: z.string().url(),
  conflict_type: z.enum([
    "self_referencing_missing",
    "points_to_404",
    "points_to_redirect",
    "duplicate_cross_role",
    "wrong_domain",
  ]),
  duplicate_pages: z.array(z.string().url()).optional(),
});
export type CanonicalConflictPayload = z.infer<typeof CanonicalConflictPayloadSchema>;

export const MetaExperimentPayloadSchema = z.object({
  experiment_id: z.string(),
  variant_label: z.enum(["A", "B"]),
  meta_field: z.enum(["title", "description"]),
  variant_value: z.string(),
  control_value: z.string(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  ctr_baseline: z.number().nullable(),
  ctr_observed: z.number().nullable(),
  ctr_delta_pct: z.number().nullable(),
  sample_size: z.number().int().nullable(),
  winner: z.enum(["A", "B", "inconclusive"]).nullable(),
});
export type MetaExperimentPayload = z.infer<typeof MetaExperimentPayloadSchema>;

export const InternalLinkSuggestionPayloadSchema = z.object({
  source_page: z.string().url(),
  target_page: z.string().url(),
  anchor_suggestion: z.string().min(1).max(120),
  similarity_score: z.number().min(0).max(1),
  rationale: z.string().optional(),
  applied_at: z.string().datetime().nullable(),
});
export type InternalLinkSuggestionPayload = z.infer<typeof InternalLinkSuggestionPayloadSchema>;

// ─── Discriminated union ─────────────────────────────────────────────────

/**
 * One audit finding row. Use `audit_type` to discriminate the payload.
 * Mirrors __seo_audit_findings table.
 */
export const AuditFindingSchema = z.discriminatedUnion("audit_type", [
  z.object({
    id: z.string().uuid().optional(),
    audit_type: z.literal("schema_violation"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: SchemaViolationPayloadSchema,
    detected_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    fixed_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    audit_type: z.literal("image_seo"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: ImageSeoPayloadSchema,
    detected_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    fixed_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    audit_type: z.literal("canonical_conflict"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: CanonicalConflictPayloadSchema,
    detected_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    fixed_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    audit_type: z.literal("meta_experiment"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: MetaExperimentPayloadSchema,
    detected_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    fixed_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    audit_type: z.literal("internal_link_suggestion"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: InternalLinkSuggestionPayloadSchema,
    detected_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    fixed_at: z.string().datetime().nullable(),
  }),
]);
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

// ─── Aggregate snapshot stored in __seo_entity_health.onpage_audit_summary ────

export const OnpageAuditSummarySchema = z.object({
  total_findings_open: z.number().int().nonnegative(),
  by_audit_type: z.record(AuditTypeSchema, z.number().int().nonnegative()),
  by_severity: z.record(SeveritySchema, z.number().int().nonnegative()),
  last_audit_at: z.string().datetime(),
});
export type OnpageAuditSummary = z.infer<typeof OnpageAuditSummarySchema>;
