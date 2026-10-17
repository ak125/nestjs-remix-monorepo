/**
 * Evidence Pack — Sortie metier pivot
 *
 * Separe rigoureusement :
 * - Faits confirmes vs manquants
 * - Hypotheses candidates avec score + evidence for/against
 * - Liens entretien
 * - Drapeaux risque
 * - Garde-fou catalogue (CatalogGuard)
 * - Claims autorises vs interdits au runtime
 * - Inputs UI par bloc
 *
 * Hierarchie : DiagnosticContract → EvidencePack → DiagnosticResult (UI)
 *
 * Produit par les moteurs metier et leurs donnees DB.
 * ADR-031 : les extraits RAG ne constituent pas des preuves diagnostic.
 */
import { z } from 'zod';

// ── Urgency (reference data + existing immediate-action timeline) ──

export const UrgencyLevelEnum = z.enum([
  'critique',
  'haute',
  'moyenne',
  'basse',
]);
export type UrgencyLevel = z.infer<typeof UrgencyLevelEnum>;

// ── Candidate Hypothesis ────────────────────────────────

export const CauseTypeEnum = z.enum([
  'maintenance_related',
  'wear_related',
  'component_fault',
  'contextual_factor',
  // Additional reference categories introduced by the 20260321 migration.
  // Preserve their identity; there is no documented mapping to MVP categories.
  'wear',
  'mechanical',
  'hydraulic',
  'electrical',
  'corrosion',
  'blockage',
  'leak',
]);
export type CauseType = z.infer<typeof CauseTypeEnum>;

// ── WIKI provenance ─────────────────────────────────────
// What the WIKI documents behind each symptom → cause link of an hypothesis
// (__diag_link_provenance, projected from validated WIKI fiches). Information
// only: it never carries a score, and `part_role` stays out of the pack.

export const ProvenanceStateEnum = z.enum(['sourced', 'partial', 'unsourced']);
export type ProvenanceState = z.infer<typeof ProvenanceStateEnum>;

export const WikiRefSchema = z.object({
  wiki_path: z.string().min(1),
  gamme_slug: z.string().min(1),
  relation_to_part: z.string().min(1),
  diagnostic_safe: z.boolean(),
});

export const ProvenanceLinkSchema = z
  .object({
    link_id: z.number().int().positive(),
    symptom_slug: z.string().min(1),
    documented: z.boolean(),
    wiki_refs: z.array(WikiRefSchema),
  })
  .refine((link) => link.documented === link.wiki_refs.length > 0, {
    message: 'documented must say whether the link has a WIKI reference',
  });

/** sourced = every link documented, partial = some, unsourced = none. */
export function provenanceStateOf(
  links: ReadonlyArray<{ documented: boolean }>,
): ProvenanceState {
  const documented = links.filter((link) => link.documented).length;
  if (documented === links.length) return 'sourced';
  return documented > 0 ? 'partial' : 'unsourced';
}

export const HypothesisProvenanceSchema = z
  .object({
    state: ProvenanceStateEnum,
    links: z.array(ProvenanceLinkSchema).min(1),
  })
  .refine(
    (provenance) => provenance.state === provenanceStateOf(provenance.links),
    {
      message: 'state must follow from the documented links',
    },
  );
export type HypothesisProvenance = z.infer<typeof HypothesisProvenanceSchema>;

const ProvenanceCount = z.number().int().min(0);

// `unavailable` = the provenance could not be read: it says nothing about the
// links, so it carries no count and no hypothesis carries a state.
export const ProvenanceSummarySchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('available'),
      counts: z
        .object({
          sourced: ProvenanceCount,
          partial: ProvenanceCount,
          unsourced: ProvenanceCount,
        })
        .strict(),
    })
    .strict(),
  z.object({ status: z.literal('unavailable') }).strict(),
]);
export type ProvenanceSummary = z.infer<typeof ProvenanceSummarySchema>;

export const CandidateHypothesisSchema = z.object({
  hypothesis_id: z.string().min(1),
  label: z.string().min(1),
  cause_type: CauseTypeEnum,
  // Score relatif 0-100 calcule par les moteurs metier
  relative_score: z.number().min(0).max(100),
  // Urgence securite
  urgency: UrgencyLevelEnum,
  evidence_for: z.array(z.string()).min(1),
  evidence_against: z.array(z.string()),
  // Verification recommandee issue des donnees metier
  verification_method: z.string().optional(),
  requires_verification: z.boolean(),
  // Mapping vers les gammes du catalogue
  related_gamme_slugs: z.array(z.string()).optional(),
  // Absent from packs stored before the WIKI provenance, and when it is not
  // exposed or could not be read (see provenance_summary).
  provenance: HypothesisProvenanceSchema.optional(),
});
export type CandidateHypothesis = z.infer<typeof CandidateHypothesisSchema>;

// ── Catalog Guard ───────────────────────────────────────

export const ConfidenceLevelEnum = z.enum(['low', 'medium', 'high']);

export const CatalogOutputModeEnum = z.enum([
  'none',
  'catalog_family_only',
  'catalog_family_with_caution',
]);

// Mapping vers les vraies gammes du catalogue (pg_id from gammes/*.md)
export const SuggestedGammeSchema = z.object({
  gamme_slug: z.string().min(1), // ex: 'plaquette-de-frein'
  gamme_label: z.string().min(1), // ex: 'Plaquette de frein'
  pg_id: z.number().optional(), // ex: 402 (from gammes/*.md frontmatter)
  confidence: ConfidenceLevelEnum,
});
export type SuggestedGamme = z.infer<typeof SuggestedGammeSchema>;

export const CatalogGuardSchema = z.object({
  ready_for_catalog: z.boolean(),
  confidence_before_purchase: ConfidenceLevelEnum,
  allowed_output_mode: CatalogOutputModeEnum,
  reason: z.string().min(1),
  suggested_gammes: z.array(SuggestedGammeSchema).optional(),
});
export type CatalogGuard = z.infer<typeof CatalogGuardSchema>;

// ── Evidence Pack ───────────────────────────────────────

/**
 * The summary and the per-hypothesis states tell one story: a state is shown
 * only when the provenance was read (`available`), then every hypothesis has
 * one and the counts are their tally.
 */
function checkProvenanceConsistency(
  pack: {
    candidate_hypotheses: Array<{ provenance?: HypothesisProvenance }>;
    provenance_summary?: ProvenanceSummary;
  },
  ctx: z.RefinementCtx,
): void {
  const summary = pack.provenance_summary;
  const states = pack.candidate_hypotheses.map((h) => h.provenance?.state);
  if (summary?.status !== 'available') {
    if (states.some((state) => state !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['candidate_hypotheses'],
        message: 'a provenance state requires an available provenance_summary',
      });
    }
    return;
  }
  if (states.some((state) => state === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['candidate_hypotheses'],
      message:
        'an available provenance_summary requires a state on every hypothesis',
    });
    return;
  }
  for (const state of ProvenanceStateEnum.options) {
    if (summary.counts[state] !== states.filter((s) => s === state).length) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance_summary', 'counts', state],
        message: 'counts must tally the hypothesis states',
      });
    }
  }
}

export const EvidencePackSchema = z.object({
  evidence_pack: z
    .object({
      analysis_kind: z.enum(['diagnostic', 'maintenance']).optional(),
      diagnostic_confidence: z.number().min(0).max(100).optional(),
      factual_inputs_confirmed: z.array(z.string()),
      factual_inputs_missing: z.array(z.string()),
      system_suspects: z.array(z.string()),
      candidate_hypotheses: z.array(CandidateHypothesisSchema),
      maintenance_links: z.array(z.string()),
      risk_flags: z.array(z.string()),
      safety_alert: z.string().optional(),
      risk_level: z.enum(['critical', 'high', 'moderate', 'low']).optional(),
      signal_quality: z.enum(['high', 'medium', 'low']).optional(),
      catalog_guard: CatalogGuardSchema,
      maintenance_recommendations: z.array(z.unknown()).optional(),
      preventive_schedule: z
        .array(
          z.object({
            operation: z.string(),
            next_at_km: z.string(),
            status: z.enum(['overdue', 'approaching', 'ok', 'unknown']),
          }),
        )
        .optional(),
      allowed_claims: z.array(z.string()),
      // v1: permissif. v2: union typee par bloc (VehicleContextCardInput, etc.)
      ui_block_inputs: z.record(z.string(), z.unknown()),
      // Absent = provenance not exposed (flag OFF) or pack stored before it.
      provenance_summary: ProvenanceSummarySchema.optional(),
    })
    .superRefine(checkProvenanceConsistency),
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;

// ── Pipeline Output (full) ──────────────────────────────

export const DiagnosticPipelineOutputSchema = z.object({
  contract_version: z.string().min(1),
  audit: z.object({
    primary_intent: z.string(),
    secondary_intents: z.array(z.string()),
    system_scope: z.string(),
    part_scope: z.string(),
    technical_level: z.string(),
    high_caution_required: z.boolean(),
    must_cover_axes: z.array(z.string()),
    must_not_do: z.array(z.string()),
    notes: z.string(),
  }),
  sections: z.array(
    z.object({
      section_id: z.string(),
      section_label: z.string(),
      section_role: z.string(),
      required: z.boolean(),
      goal: z.string(),
      must_cover_axes: z.array(z.string()),
      caution_level: z.string(),
      ui_blocks: z.array(z.string()),
    }),
  ),
  evidence: EvidencePackSchema,
});
export type DiagnosticPipelineOutput = z.infer<
  typeof DiagnosticPipelineOutputSchema
>;
