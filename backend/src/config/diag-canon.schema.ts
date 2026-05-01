/**
 * diag-canon.schema.ts — Zod canonical TS, source of truth for the diagnostic
 * canon shape (`automecanik-wiki/exports/diag-canon.json`).
 *
 * Source of truth = this Zod schema. The JSON Schema artifact published in the
 * wiki repo (`exports/diag-canon.schema.json`) is **derived** from this Zod
 * schema by `scripts/wiki/diag-canon-jsonschema.ts` (the builder) — never
 * hand-written. Editing the wiki JSON Schema directly is a violation of the
 * single-SoT contract.
 *
 * Runtime-only: this file does NOT import zod-to-json-schema. The derivation
 * lib lives in the builder script (separation of concerns — runtime consumers
 * such as WikiProposalSyncService and agent skills must not load build-time
 * deps).
 *
 * Patterns reused from ADR-039 (`wiki-proposal-frontmatter.schema.ts`).
 *
 * Refs:
 *   - Plan : `humble-cuddling-scott.md` §P3 (Sprint 3 — Principe 1, 6)
 *   - ADR-033 §"Phase 3" — diag canon FK contract
 *   - DB convention (memory `diag-symptom-db-convention.md`) — slugs snake_case
 */
import { z } from 'zod';

/** Exact canon version. Bump = explicit breaking change + version literal update. */
export const DIAG_CANON_VERSION = '1.0.0' as const;

/** Slug pattern: lowercase ASCII + digits + underscore, must start with a letter. */
export const DIAG_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

export const DiagCanonSlug = z.string().regex(DIAG_SLUG_PATTERN);
export type DiagCanonSlug = z.infer<typeof DiagCanonSlug>;

/**
 * The canon shape published nightly by `diag-canon-slugs-export.yml`.
 *
 * Invariants enforced at parse time:
 *  - `.strict()` rejects any unknown top-level key (drift detection layer 1)
 *  - `version: z.literal(...)` rejects any version drift without explicit bump
 *  - `.superRefine()` enforces composite FK : `symptoms[*]` value must be in `systems[]`
 *
 * Note : the JSON Schema derived from this Zod schema does NOT capture the
 * superRefine invariant (that limitation is documented in the builder script).
 * The composite FK invariant is enforced exclusively at runtime, not via the
 * derived JSON Schema. All consumers MUST go through `DiagCanon.parse()` to
 * benefit from the full validation surface.
 */
export const DiagCanon = z
  .object({
    version: z.literal(DIAG_CANON_VERSION),
    generated_at: z.string().datetime({ offset: true }),
    systems: z.array(DiagCanonSlug).readonly(),
    symptoms: z.record(DiagCanonSlug, DiagCanonSlug).readonly(),
  })
  .strict()
  .superRefine((canon, ctx) => {
    const known = new Set(canon.systems);
    for (const [symptomSlug, systemSlug] of Object.entries(canon.symptoms)) {
      if (!known.has(systemSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['symptoms', symptomSlug],
          message: `system_slug_unknown:${systemSlug}`,
        });
      }
    }
  });
export type DiagCanon = z.infer<typeof DiagCanon>;

/**
 * Outcome of `checkDiagnosticRelation`. The `blockedReason` strings are
 * **byte-identical** to those emitted by the Python validator
 * `scripts/wiki/validate-gamme-diagnostic-relations.py` (function
 * `gate_diagnostic_relations_fk`). Any future change in the Python validator
 * MUST update the spec assertions in this file.
 */
export type RelationCheckResult =
  | { ok: true }
  | { ok: false; blockedReason: string };

/**
 * Validates a single `diagnostic_relations[]` entry of a wiki gamme proposal
 * against the loaded canon. Returns three possible blocked reasons in priority
 * order:
 *
 *   1. `symptom_slug_unknown:<slug>`         — symptom not in canon
 *   2. `system_slug_unknown:<slug>`          — system not in canon
 *   3. `symptom_system_mismatch:<sym>:<declared>:<canon>` — composite FK violation
 *
 * Priority order matters : if the symptom is unknown we cannot make any further
 * statement about its system mapping, so we short-circuit (matches Python).
 */
export function checkDiagnosticRelation(
  canon: DiagCanon,
  rel: { symptom_slug: string; system_slug: string },
): RelationCheckResult {
  const { symptom_slug, system_slug } = rel;
  if (!(symptom_slug in canon.symptoms)) {
    return { ok: false, blockedReason: `symptom_slug_unknown:${symptom_slug}` };
  }
  if (!canon.systems.includes(system_slug)) {
    return { ok: false, blockedReason: `system_slug_unknown:${system_slug}` };
  }
  if (canon.symptoms[symptom_slug] !== system_slug) {
    return {
      ok: false,
      blockedReason: `symptom_system_mismatch:${symptom_slug}:${system_slug}:${canon.symptoms[symptom_slug]}`,
    };
  }
  return { ok: true };
}
