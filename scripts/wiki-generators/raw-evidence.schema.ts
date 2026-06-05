/**
 * raw-evidence.schema.ts — Zod SOURCE OF TRUTH for the RAW evidence inventory artefact.
 *
 * The Zod schema is the single source of truth. The JSON Schema
 * (`raw-evidence.schema.json`) is a GENERATED PROJECTION — never edit it by hand
 * (principe L3 « generated artifacts are projections » de CLAUDE.md ; précédent
 * Zod→JSON : backend/src/config/diag-canon.schema.ts → diag-canon-jsonschema.ts).
 *
 * Read-only diagnostic artefact : « le RAW a-t-il le droit de devenir un wiki ? ».
 * Measures coverage + provenance only — no fact extraction, no generation, no DB/wiki write.
 */
import { z } from 'zod';

/** Per-block coverage status. */
export const BLOCK_STATUS = [
  'PRESENT', // block present, all BLOCK-severity thresholds met (WARN gaps → warnings[])
  'PARTIAL', // block present but a BLOCK-severity threshold fails
  'MISSING', // block key absent
  'NOT_APPLICABLE',
  'NOT_MAPPED', // present in RAW (schema_version 5.0 superset) but not mapped to a canonical role
  'BLOCKED_CATALOG_REQUIRED', // data lives in the catalogue/DB, never in RAW (never a RAW blocker)
] as const;

/** R4/R6→R3 fold status of a block's target section. */
export const FOLD_STATUS = ['PENDING_ADR', 'LIVE', 'NATIVE', 'NOT_FOLDED'] as const;

/** Per-role fold readiness — separates "RAW coverage OK" from "fold authorised in prod". */
export const FOLD_READINESS = ['BLOCKED_PENDING_ADR', 'READY_ADR_027'] as const;

export const INVENTORY_STATUS = ['DIAGNOSTIC_READY', 'NO_RAW', 'RAW_PARSE_ERROR'] as const;

export const RAW_VERDICT = ['READY', 'PARTIAL_READY', 'BLOCKED', 'NO_RAW', 'RAW_PARSE_ERROR'] as const;

const SourceSchema = z
  .object({
    path: z.string().min(1), // relative to the automecanik-raw repo root
    kind: z.enum(['gamme', 'guide', 'evidence']),
    content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict();

const CoverageEntrySchema = z
  .object({
    block: z.string().min(1), // 'A.domain' … 'E.installation', '5.0:variants', 'compatibility'
    status: z.enum(BLOCK_STATUS),
    canon_role: z.string(), // 'R4' | 'R6' | 'R5' | 'R3' | 'R1/R2' | '—'
    r3_section: z.string().nullable(),
    fold_status: z.enum(FOLD_STATUS),
    warnings: z.array(z.string()), // WARN-severity sub-gaps (no silent drop), [] if none
  })
  .strict();

export const RawEvidenceSchema = z
  .object({
    schema_version: z.literal('raw-evidence.v1'),
    subject: z.string().min(1),
    pg_id: z.number().int().nullable(),
    inventory_status: z.enum(INVENTORY_STATUS),
    intent_targets: z.array(z.string()),
    provenance: z
      .object({
        source_type: z.string().nullable(),
        truth_level: z.string().nullable(),
        verification_status: z.string().nullable(),
        completeness_profile: z.string().nullable(),
        sources: z.array(SourceSchema), // deterministically discovered set (sorted by path)
        unlinked_source_types: z.array(z.string()), // e.g. ['guide'] when no deterministic link exists
      })
      .strict(),
    coverage: z.array(CoverageEntrySchema),
    fold_readiness: z
      .object({
        R4_to_R3: z.enum(FOLD_READINESS),
        R5_to_R3: z.enum(FOLD_READINESS),
        R6_to_R3: z.enum(FOLD_READINESS),
      })
      .strict(),
    raw_verdict: z.enum(RAW_VERDICT),
    next_action: z.string().min(1),
    fold_note: z.string(),
  })
  .strict();

export type RawEvidence = z.infer<typeof RawEvidenceSchema>;
