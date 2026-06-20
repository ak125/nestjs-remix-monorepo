/**
 * Command Center — improvement-candidate rules (read-only, 0-mutation).
 *
 * Surfaces the next best PERF-improvement target ("candidate auto-selection"),
 * ranked by how close a chunk is to its size-limit budget ceiling. This is the
 * advisory feeder for the measured-improvement loop
 * (§8 .claude/knowledge/agent-method-patterns.md):
 *   - it PROPOSES which chunk to optimise next (smallest headroom = top of queue),
 *   - it NEVER executes, mutates, merges or publishes anything.
 *
 * Pure function (no I/O) so it is unit-testable; the I/O (reading
 * frontend/.size-limit.json + gzip-measuring the built assets) lives in
 * CommandCenterActionsService, which calls this with the measured numbers.
 *
 * source = 'runtime' (the perf/runtime DOMAIN, per CcActionV2 registry enum).
 * action_type = 'business' (a real opportunity on directly-measured data) — kept
 * honest by finalizeAction's confidence floor; we set data_confidence high because
 * the gzip size is measured from the build, not inferred.
 */

import type { RawAction } from './score-action';

/** A measured size-limit budget (gzip bytes) ready for ranking. */
export interface SizeBudgetMeasure {
  /** Budget name, e.g. "Route R2 produit-véhicule … chunk, gzip". */
  name: string;
  /** Measured gzip bytes of the matched chunk(s). */
  measuredBytes: number;
  /** Budget ceiling gzip bytes (from .size-limit.json `limit`). */
  limitBytes: number;
}

/**
 * Only surface budgets that are APPROACHING their ceiling (headroom below this
 * fraction). Above it, the chunk is healthy → no candidate (no clutter, no
 * overstating a "healthy" budget as an opportunity). Named constant, not magic:
 * 20 % headroom ≈ the calibration band (.size-limit.README uses ~10 % ceilings).
 */
export const CANDIDATE_HEADROOM_THRESHOLD = 0.2;

const kb = (bytes: number): string => (bytes / 1000).toFixed(1);
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

/** Clamp an integer into [lo, hi]. */
const clampInt = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Build read-only improvement candidates from measured budgets. Returns one
 * RawAction per budget whose headroom is below CANDIDATE_HEADROOM_THRESHOLD,
 * scored so the tightest chunk ranks first (urgency rises as headroom shrinks).
 * Empty array = every budget is healthy (honest "nothing tight right now").
 */
export function buildImprovementCandidateActions(
  measures: SizeBudgetMeasure[],
): RawAction[] {
  const actions: RawAction[] = [];
  for (const m of measures) {
    if (m.limitBytes <= 0) continue;
    const headroom = (m.limitBytes - m.measuredBytes) / m.limitBytes;
    if (headroom >= CANDIDATE_HEADROOM_THRESHOLD) continue; // healthy → no candidate
    const headroomPct = Math.round(headroom * 1000) / 10;
    // urgency rises as headroom shrinks: 0 % headroom → 9 ; ~20 % → ~1.
    const urgency = clampInt((1 - headroom) * 10 - 1, 1, 9);
    actions.push({
      id: `perf:size:${slug(m.name)}`,
      title: `Perf — ${m.name} : ${kb(m.measuredBytes)}/${kb(m.limitBytes)} KB (${headroomPct}% de marge)`,
      department: 'runtime',
      source: 'runtime',
      action_type: 'business',
      impact: 6, // bundle weight affects TTI on a real user-facing route
      urgency,
      data_confidence: 90, // gzip measured directly from the build, not inferred
      effort: 4,
      risk: 1,
      reason:
        `Chunk gzip mesuré ${kb(m.measuredBytes)}/${kb(m.limitBytes)} KB — ` +
        `${headroomPct}% de marge avant le plafond size-limit. ` +
        `Plus la marge est faible, plus c'est la cible prioritaire de la boucle d'amélioration mesurée.`,
      evidence: [
        `size-limit « ${m.name} » : ${m.measuredBytes} B / ${m.limitBytes} B gzip (marge ${headroomPct}%)`,
      ],
      next_step:
        `Lancer la boucle d'amélioration mesurée (§8 agent-method-patterns) sur ce chunk : ` +
        `worktree → optimiser → garder seulement si poids↓ ET holdout large vert → PR owner-gated.`,
    });
  }
  return actions;
}
