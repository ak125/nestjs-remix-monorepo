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

/** NOT_CONFIGURED = no usable completeness profile for the entity type (additive, plan « RAW Encyclopédie » PR-B). */
export const RAW_VERDICT = ['READY', 'PARTIAL_READY', 'BLOCKED', 'NO_RAW', 'RAW_PARSE_ERROR', 'NOT_CONFIGURED'] as const;

/** Tiered entity types of the RAW encyclopedia (recycled/rag-knowledge/{gammes,vehicles,diagnostic}/). */
export const ENTITY_TYPE = ['gamme', 'vehicle', 'diagnostic'] as const;

/** Completeness tier reached (profiles `_schemas/completeness/*.yaml`, cumulative BRONZE → ARGENT → OR). */
export const TIER = ['NONE', 'BRONZE', 'ARGENT', 'OR', 'NOT_CONFIGURED'] as const;

/** Status of a completeness profile load (absent profile is explicit, never a silent skip). */
export const PROFILE_STATUS = ['OK', 'NOT_CONFIGURED', 'PROFILE_PARSE_ERROR'] as const;

const SourceSchema = z
  .object({
    path: z.string().min(1), // relative to the automecanik-raw repo root
    kind: z.enum(['gamme', 'guide', 'evidence', 'vehicle', 'diagnostic']),
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
    // Gamme-only fold annotations — optional since the 3-types extension (omitted on
    // vehicle/diagnostic artefacts ; still always emitted for gammes — additive change).
    fold_readiness: z
      .object({
        R4_to_R3: z.enum(FOLD_READINESS),
        R5_to_R3: z.enum(FOLD_READINESS),
        R6_to_R3: z.enum(FOLD_READINESS),
      })
      .strict()
      .optional(),
    raw_verdict: z.enum(RAW_VERDICT),
    next_action: z.string().min(1),
    fold_note: z.string().optional(),
    // ——— 3-types extension (plan « RAW Encyclopédie » PR-B) — ADDITIVE, optional ———
    // Absent on legacy gamme artefacts (byte-identical output preserved) ; populated on
    // vehicle/diagnostic artefacts. Tier evaluation = completeness profiles (PR-A).
    entity_type: z.enum(ENTITY_TYPE).optional(),
    tier: z.enum(TIER).optional(),
    missing_for_next_tier: z.array(z.string()).optional(),
  })
  .strict();

export type RawEvidence = z.infer<typeof RawEvidenceSchema>;

// ————————————————————————————————————————————————————————————————————————————
// Aggregate encyclopedia coverage report (audit/content/raw-evidence/encyclopedia-coverage.json).
// Deterministic projection over the 3 tiered entity types — counts per type × tier,
// per famille (gammes only), plus the per-fiche tier rows. No timestamp, no absolute path.
// ————————————————————————————————————————————————————————————————————————————

const TierCountsSchema = z
  .object({
    NONE: z.number().int().nonnegative(),
    BRONZE: z.number().int().nonnegative(),
    ARGENT: z.number().int().nonnegative(),
    OR: z.number().int().nonnegative(),
    NOT_CONFIGURED: z.number().int().nonnegative(),
  })
  .strict();

const ProfileStateSchema = z
  .object({
    path: z.string().min(1), // relative to the automecanik-raw repo root
    status: z.enum(PROFILE_STATUS),
    content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable(),
    reason: z.string().nullable(), // why NOT_CONFIGURED / PROFILE_PARSE_ERROR (never silent)
    warnings: z.array(z.string()), // load-time degradations (unknown check, covers_db_set sans DB…)
  })
  .strict();

const TypeCoverageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    parse_errors: z.number().int().nonnegative(), // fiches whose frontmatter failed to parse (still tier-evaluated body-only)
    tiers: TierCountsSchema,
  })
  .strict();

export const EncyclopediaCoverageSchema = z
  .object({
    schema_version: z.literal('encyclopedia-coverage.v1'),
    profiles: z
      .object({ gamme: ProfileStateSchema, vehicle: ProfileStateSchema, diagnostic: ProfileStateSchema })
      .strict(),
    by_type: z
      .object({ gamme: TypeCoverageSchema, vehicle: TypeCoverageSchema, diagnostic: TypeCoverageSchema })
      .strict(),
    by_family: z.record(z.string(), z.object({ total: z.number().int().nonnegative(), tiers: TierCountsSchema }).strict()),
    fiches: z.array(
      z
        .object({
          entity_type: z.enum(ENTITY_TYPE),
          subject: z.string().min(1),
          family: z.string().nullable(), // gamme frontmatter `category` ; null for vehicle/diagnostic
          tier: z.enum(TIER),
          missing_for_next_tier: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

export type EncyclopediaCoverage = z.infer<typeof EncyclopediaCoverageSchema>;
