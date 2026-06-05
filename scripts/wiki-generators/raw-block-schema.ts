/**
 * RAW evidence block taxonomy.
 * Blocks A–E are the CANONICAL v4 schema
 * (.spec/00-canon/gamme-md-schema.md, "v4 — Architecture 5 blocs", truth_level L1|L2).
 * Live RAW carries schema_version 5.0 — a SUPERSET of v4 (truth_level L3 + extra
 * blocks: depose_steps, variants, location_on_vehicle, key_visual_features,
 * purchase_guardrails, conseil_v5). This file reconciles v4 canon + 5.0 superset.
 *
 * A–E thresholds REUSE / reference validate-gamme-schema.ts (the same v4 blocks):
 * do NOT re-duplicate them here. Converging that validator onto this module is
 * intentionally deferred (P-later). This is an extension v4→5.0, not legacy-vs-target.
 *
 * BLOCK-severity vs WARN-severity below mirror scripts/validate-gamme-schema.ts:64-118.
 */

export type BlockStatus =
  | 'PRESENT'
  | 'PARTIAL'
  | 'MISSING'
  | 'NOT_APPLICABLE'
  | 'NOT_MAPPED'
  | 'BLOCKED_CATALOG_REQUIRED';

export interface BlockDef {
  id: string; // 'A.domain'
  key: string; // frontmatter key
  canon_role: string;
  r3_section: string | null;
  fold_status: 'PENDING_ADR' | 'LIVE' | 'NATIVE' | 'NOT_FOLDED';
}

/** v4 canon blocks A–E, with their canonical role + (annotated) R3 target section. */
export const BLOCK_DEFS: readonly BlockDef[] = [
  { id: 'A.domain', key: 'domain', canon_role: 'R4', r3_section: 'reference', fold_status: 'PENDING_ADR' },
  { id: 'B.selection', key: 'selection', canon_role: 'R6', r3_section: 'guide-achat', fold_status: 'PENDING_ADR' },
  { id: 'C.diagnostic', key: 'diagnostic', canon_role: 'R5', r3_section: 'diagnostic-rapide', fold_status: 'LIVE' },
  { id: 'D.maintenance', key: 'maintenance', canon_role: 'R3', r3_section: 'maintenance', fold_status: 'NATIVE' },
  { id: 'E.installation', key: 'installation', canon_role: 'R3', r3_section: 'installation', fold_status: 'NATIVE' },
] as const;

/** schema_version 5.0 superset blocks (top-level keys), recensés so populated data is never silently dropped. */
export const SUPERSET_BLOCKS_5_0: readonly string[] = [
  'variants',
  'location_on_vehicle',
  'key_visual_features',
  'purchase_guardrails',
  'conseil_v5',
] as const;

/**
 * Explicit guide mapping (subject slug → guide slug under recycled/rag-knowledge/guides/).
 * Guides carry NO pg_id / gamme frontmatter field, so they CANNOT be auto-linked by
 * slug-equality (e.g. `choisir-filtre-air` ≠ `filtre-a-air`). Auto-discovery would be
 * non-deterministic; the mapping is therefore explicit (seeded per pilot). Subjects
 * absent from this map record `unlinked_source_types: ['guide']` (honest, not silent).
 */
export const GUIDE_MAP: Readonly<Record<string, string>> = {
  'filtre-a-air': 'choisir-filtre-air',
};

const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

export interface BlockAssessment {
  status: BlockStatus;
  warnings: string[];
}

/**
 * Assess a v4 block's coverage from the parsed RAW frontmatter.
 * Returns PRESENT/PARTIAL/MISSING + WARN-severity gaps in `warnings`.
 * Thresholds mirror validate-gamme-schema.ts (v4) — see header.
 */
export function assessBlock(blockKey: string, fm: any): BlockAssessment {
  const node = fm?.[blockKey];
  if (node === undefined || node === null) return { status: 'MISSING', warnings: [] };
  const warnings: string[] = [];

  switch (blockKey) {
    case 'domain': {
      const role = typeof node.role === 'string' ? node.role : '';
      // BLOCK-severity (validate-gamme-schema.ts:64-67): role >= 80 chars, non-generic.
      if (role.length < 80) return { status: 'PARTIAL', warnings: [`domain.role too short (${role.length} < 80)`] };
      // WARN-severity.
      if (len(node.confusion_with) < 2) warnings.push(`domain.confusion_with < 2 (${len(node.confusion_with)})`);
      if (len(node.must_be_true) < 2) warnings.push(`domain.must_be_true < 2 (${len(node.must_be_true)})`);
      return { status: 'PRESENT', warnings };
    }
    case 'selection': {
      // BLOCK-severity: cost_range present + not suspect (max <= 10*min).
      const cr = node.cost_range;
      if (!cr) return { status: 'PARTIAL', warnings: ['selection.cost_range missing'] };
      if (cr.min > 0 && cr.max > 10 * cr.min) {
        return { status: 'PARTIAL', warnings: [`selection.cost_range suspect (${cr.min}-${cr.max})`] };
      }
      // WARN-severity.
      if (len(node.criteria) < 3) warnings.push(`selection.criteria < 3 (${len(node.criteria)})`);
      if (len(node.checklist) < 3) warnings.push(`selection.checklist < 3 (${len(node.checklist)})`);
      if (len(node.anti_mistakes) < 3) warnings.push(`selection.anti_mistakes < 3 (${len(node.anti_mistakes)})`);
      return { status: 'PRESENT', warnings };
    }
    case 'diagnostic': {
      // No BLOCK-severity in C — all WARN.
      if (len(node.symptoms) < 3) warnings.push(`diagnostic.symptoms < 3 (${len(node.symptoms)})`);
      if (len(node.causes) < 2) warnings.push(`diagnostic.causes < 2 (${len(node.causes)})`);
      if (len(node.quick_checks) < 2) warnings.push(`diagnostic.quick_checks < 2 (${len(node.quick_checks)})`);
      return { status: 'PRESENT', warnings };
    }
    case 'maintenance': {
      // WARN-severity: interval + note ; usage_factors required only when unit != km.
      if (!node.interval || !node.interval.note) warnings.push('maintenance.interval or note missing');
      if (node.interval && node.interval.unit !== 'km' && len(node.usage_factors) === 0) {
        warnings.push('maintenance.usage_factors required when unit != km');
      }
      return { status: 'PRESENT', warnings };
    }
    case 'installation': {
      // INFO-only in the v4 validator ; steps >= 3 is informational.
      if (len(node.steps) < 3) warnings.push(`installation.steps < 3 (${len(node.steps)})`);
      return { status: 'PRESENT', warnings };
    }
    default:
      return { status: 'MISSING', warnings: [] };
  }
}

/**
 * Deterministic next_action when one or more A–E blocks are MISSING/PARTIAL.
 * Priority: (1) blocks required by intent_targets first, then (2) fixed order C>A>B>D>E.
 * `compatibility` (catalog) is informational and never the RAW next_action.
 */
const INTENT_BLOCKS: Readonly<Record<string, string[]>> = {
  diagnostic: ['C.diagnostic'],
  achat: ['B.selection'],
  compatibilite: ['A.domain'],
};
const FIXED_PRIORITY = ['C.diagnostic', 'A.domain', 'B.selection', 'D.maintenance', 'E.installation'];

export function pickNextAction(
  coverage: { block: string; status: BlockStatus }[],
  intentTargets: string[],
): string {
  const incomplete = new Set(
    coverage.filter((c) => c.status === 'MISSING' || c.status === 'PARTIAL').map((c) => c.block),
  );
  if (incomplete.size === 0) return 'PROMOTE_RAW_TO_WIKI';

  const intentFirst = intentTargets.flatMap((t) => INTENT_BLOCKS[t] ?? []);
  const ordered = [...intentFirst, ...FIXED_PRIORITY];
  for (const block of ordered) {
    if (incomplete.has(block)) {
      const letter = block.split('.')[0].toUpperCase();
      return `ENRICH_RAW_${letter}`;
    }
  }
  return 'ENRICH_RAW';
}
