/**
 * ADR-029 P1 — Zod schema mirroring `.spec/00-canon/enrichment-report.schema.json`.
 *
 * Le RagEnrichmentReportEmitterService valide chaque payload contre ce schema
 * AVANT persistance DB / filesystem. Tout drift entre ce schema et le canon
 * JSON Schema est un bug qui DOIT être corrigé immédiatement (cf. ADR-029
 * §"Décision: aucune divergence tolérée").
 */

import { z } from 'zod';
import {
  RAG_LIFECYCLE_STAGES,
  RAG_EXECUTION_MODES,
  RAG_DECISIONS,
  RAG_VALIDATORS,
} from './rag-lifecycle.types';

// ── Atomic schemas ───────────────────────────────────────────────────────────

const lifecycleStage = z.enum(RAG_LIFECYCLE_STAGES);
const executionMode = z.enum(RAG_EXECUTION_MODES);
const truthLevel = z.enum(['L1', 'L2']);
const decision = z.enum(RAG_DECISIONS);
const validatorName = z.enum(RAG_VALIDATORS);
const validatorVerdict = z.enum(['PASS', 'PARTIAL', 'FAIL', 'SKIPPED']);
const blockAction = z.enum(['unchanged', 'modified', 'added', 'removed']);
const conflictType = z.enum([
  'minor_variation',
  'technical_conflict',
  'safety_conflict',
]);

const blockResult = z.object({
  action: blockAction,
  qa_score: z.number().int().min(0).max(100).nullable(),
  evidence_score: z.number().int().min(0).max(100).nullable(),
  structural_complete: z.boolean().nullable(),
});

const conflictSummary = z.object({
  block: z.string(),
  field: z.string(),
  conflict_type: conflictType,
});

const seoRegressionCheckDetail = z.object({
  check_id: z.number().int().min(1).max(8),
  status: z.enum(['pass', 'fail']),
  detail: z.string().optional(),
});

const seoRegressionChecks = z.object({
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  details: z.array(seoRegressionCheckDetail),
});

// ── Top-level enrichment report schema ───────────────────────────────────────

export const RagEnrichmentReportSchema = z
  .object({
    run_id: z.string().uuid(),
    alias: z.string().min(1),
    run_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'run_date must be ISO date YYYY-MM-DD'),
    execution_mode: executionMode,
    state_before: lifecycleStage,
    state_after: lifecycleStage,
    truth_level_before: truthLevel,
    truth_level_after: truthLevel,
    blocks: z.object({
      domain: blockResult.optional(),
      selection: blockResult.optional(),
      maintenance: blockResult.optional(),
      diagnostic: blockResult.optional(),
      installation: blockResult.optional(),
    }),
    conflicts: z.array(conflictSummary),
    pending_manual_sources: z.array(z.string()),
    seo_regression_checks: seoRegressionChecks,
    validators_invoked: z.array(validatorName),
    validator_verdicts: z.record(validatorName, validatorVerdict),
    decision: decision,
    reason: z.string().min(1),
  })
  .strict();

export type RagEnrichmentReportInput = z.input<typeof RagEnrichmentReportSchema>;
export type RagEnrichmentReportParsed = z.output<typeof RagEnrichmentReportSchema>;
