/**
 * L4 — Strategy Engine (degressive margin).
 *
 * Resolves a target taux-de-marge from a governed, versioned `pricing_rules`
 * table and applies a fixed minimum-margin floor + an optional max-rate cap:
 *
 *   vente_HT = max( round(coût × (1 + taux/100)), coût + min_margin_amount )
 *
 * Matching dimensions are STRICTLY limited (anti opaque-policy-engine):
 * cost buckets, customer_type, supplier, category. Nothing else.
 *
 * Used by the simulation and by deliberate "apply grid" commits. The DEFAULT
 * import path preserves each row's existing marge (handled in L3) — this engine
 * is only invoked when applying a grid.
 *
 * Pure functions, zero I/O. Rule data is fetched by L3/simulation and passed in.
 */
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { computeVenteHtCents } from './pricing-formula.service';

export type CustomerType = 'B2C' | 'PRO';

export interface PricingRule {
  id: number;
  /** Inclusive lower bound on achat_HT, in cents. */
  minCostCents: number;
  /** Exclusive upper bound on achat_HT, in cents; null = +∞. */
  maxCostCents: number | null;
  /** Taux de marge (markup on cost), percent. */
  marginRate: number;
  /** Fixed floor on marge_brute, in cents. */
  minMarginAmountCents: number;
  /** Cap on the applied taux de marge, percent; null = no cap. */
  maxMarginRate: number | null;
  customerType: CustomerType | null; // null = any
  supplierPmId: string | null; // null = any
  categoryGammeId: number | null; // null = any
  priority: number;
  active: boolean;
  /** ISO dates; null = open-ended. */
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface PricingStrategyContext {
  /** achat_HT in cents. */
  costCents: number;
  customerType: CustomerType;
  supplierPmId?: string | null;
  categoryGammeId?: number | null;
  /** Evaluation instant for the effective window (defaults to now). */
  at?: Date;
}

export interface StrategyResult {
  rule: PricingRule;
  appliedMarginRate: number;
  venteHtCents: number;
  floorApplied: boolean;
  capApplied: boolean;
}

function inEffectiveWindow(rule: PricingRule, at: Date): boolean {
  const t = at.getTime();
  if (rule.effectiveFrom && t < new Date(rule.effectiveFrom).getTime())
    return false;
  if (rule.effectiveTo && t >= new Date(rule.effectiveTo).getTime())
    return false;
  return true;
}

function matchesContext(
  rule: PricingRule,
  ctx: PricingStrategyContext,
  at: Date,
): boolean {
  if (!rule.active) return false;
  if (!inEffectiveWindow(rule, at)) return false;
  if (ctx.costCents < rule.minCostCents) return false;
  if (rule.maxCostCents != null && ctx.costCents >= rule.maxCostCents)
    return false;
  if (rule.customerType != null && rule.customerType !== ctx.customerType)
    return false;
  if (
    rule.supplierPmId != null &&
    rule.supplierPmId !== (ctx.supplierPmId ?? null)
  )
    return false;
  if (
    rule.categoryGammeId != null &&
    rule.categoryGammeId !== (ctx.categoryGammeId ?? null)
  )
    return false;
  return true;
}

/** Specificity: more non-null dimensions matched = more specific. */
function specificity(rule: PricingRule): number {
  return (
    (rule.supplierPmId != null ? 1 : 0) +
    (rule.categoryGammeId != null ? 1 : 0) +
    (rule.customerType != null ? 1 : 0)
  );
}

/** Resolve the single best-matching rule, or null if none applies. */
export function resolveRule(
  rules: readonly PricingRule[],
  ctx: PricingStrategyContext,
): PricingRule | null {
  const at = ctx.at ?? new Date();
  const candidates = rules.filter((r) => matchesContext(r, ctx, at));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const s = specificity(b) - specificity(a);
    if (s !== 0) return s;
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Narrower cost band wins as final tiebreak.
    const aw = (a.maxCostCents ?? Number.MAX_SAFE_INTEGER) - a.minCostCents;
    const bw = (b.maxCostCents ?? Number.MAX_SAFE_INTEGER) - b.minCostCents;
    return aw - bw;
  });
  return candidates[0];
}

/** Apply a resolved rule: rate (capped) then floor. */
export function applyStrategy(
  costCents: number,
  rule: PricingRule,
): StrategyResult {
  const capApplied =
    rule.maxMarginRate != null && rule.marginRate > rule.maxMarginRate;
  const appliedMarginRate = capApplied
    ? (rule.maxMarginRate as number)
    : rule.marginRate;
  const venteByRate = computeVenteHtCents(costCents, appliedMarginRate);
  const venteFloor = costCents + rule.minMarginAmountCents;
  const floorApplied = venteFloor > venteByRate;
  return {
    rule,
    appliedMarginRate,
    venteHtCents: Math.max(venteByRate, venteFloor),
    floorApplied,
    capApplied,
  };
}

/** Resolve + apply in one step. Returns null if no rule matches (explicit). */
export function computeStrategyVenteHt(
  rules: readonly PricingRule[],
  ctx: PricingStrategyContext,
): StrategyResult | null {
  const rule = resolveRule(rules, ctx);
  if (!rule) return null;
  return applyStrategy(ctx.costCents, rule);
}

// ─────────────────────────────────────────────────────────────────────────────
// H3 — Rule resolution with full trace (audit / explainability / dry-run).
//
// `resolveRuleWithTrace` is the audited variant of `resolveRule`. The fast path
// (`resolveRule`) stays unchanged so the commit hot-path is not penalized.
// `resolveRuleWithTrace` is invoked from dry-run + commit-with-audit paths and
// produces the data persisted in `pricing_decision_snapshot.reasoning_json`.
// ─────────────────────────────────────────────────────────────────────────────

/** Why a candidate rejection happened — closed enum, no implicit reasons. */
export type RuleRejectionReason =
  | 'inactive'
  | 'out_of_window'
  | 'wrong_customer_type'
  | 'wrong_bucket_min'
  | 'wrong_bucket_max'
  | 'wrong_supplier'
  | 'wrong_category';

/** Why the winning candidate won — same closed enum as Zod schema below. */
export type RuleSelectionReason =
  | 'most_specific'
  | 'priority_tie_break'
  | 'narrower_band_tie_break'
  | 'no_match';

export interface RuleResolutionTrace {
  candidate_rules: Array<{ rule_id: number; why_matched: string[] }>;
  rejected_rules: Array<{ rule_id: number; why_rejected: RuleRejectionReason }>;
  selected_rule: number | null;
  selection_reason: RuleSelectionReason;
  /** Wall-clock duration of the resolution, milliseconds (float, microsecond precision). */
  resolution_duration_ms: number;
}

export interface RuleResolutionResult {
  rule: PricingRule | null;
  trace: RuleResolutionTrace;
}

function deriveWhyMatched(
  r: PricingRule,
  _ctx: PricingStrategyContext,
): string[] {
  const why: string[] = [];
  const upper = r.maxCostCents == null ? '∞' : String(r.maxCostCents);
  why.push(`cost ∈ [${r.minCostCents}, ${upper}[`);
  if (r.customerType != null) why.push(`customer=${r.customerType}`);
  if (r.supplierPmId != null) why.push(`supplier=${r.supplierPmId}`);
  if (r.categoryGammeId != null) why.push(`category=${r.categoryGammeId}`);
  return why;
}

/**
 * Resolve the single best rule WITH a full audit trace.
 * Matches the same selection logic as `resolveRule` (specificity → priority →
 * narrower-band) so the two are guaranteed to converge.
 */
export function resolveRuleWithTrace(
  rules: readonly PricingRule[],
  ctx: PricingStrategyContext,
): RuleResolutionResult {
  const t0 = performance.now();
  const at = ctx.at ?? new Date();
  const candidates: PricingRule[] = [];
  const rejected: Array<{
    rule_id: number;
    why_rejected: RuleRejectionReason;
  }> = [];

  for (const r of rules) {
    if (!r.active) {
      rejected.push({ rule_id: r.id, why_rejected: 'inactive' });
      continue;
    }
    if (!inEffectiveWindow(r, at)) {
      rejected.push({ rule_id: r.id, why_rejected: 'out_of_window' });
      continue;
    }
    if (ctx.costCents < r.minCostCents) {
      rejected.push({ rule_id: r.id, why_rejected: 'wrong_bucket_min' });
      continue;
    }
    if (r.maxCostCents != null && ctx.costCents >= r.maxCostCents) {
      rejected.push({ rule_id: r.id, why_rejected: 'wrong_bucket_max' });
      continue;
    }
    if (r.customerType != null && r.customerType !== ctx.customerType) {
      rejected.push({ rule_id: r.id, why_rejected: 'wrong_customer_type' });
      continue;
    }
    if (
      r.supplierPmId != null &&
      r.supplierPmId !== (ctx.supplierPmId ?? null)
    ) {
      rejected.push({ rule_id: r.id, why_rejected: 'wrong_supplier' });
      continue;
    }
    if (
      r.categoryGammeId != null &&
      r.categoryGammeId !== (ctx.categoryGammeId ?? null)
    ) {
      rejected.push({ rule_id: r.id, why_rejected: 'wrong_category' });
      continue;
    }
    candidates.push(r);
  }

  if (candidates.length === 0) {
    return {
      rule: null,
      trace: {
        candidate_rules: [],
        rejected_rules: rejected,
        selected_rule: null,
        selection_reason: 'no_match',
        resolution_duration_ms: performance.now() - t0,
      },
    };
  }

  // Same ordering as resolveRule.
  candidates.sort((a, b) => {
    const s = specificity(b) - specificity(a);
    if (s !== 0) return s;
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aw = (a.maxCostCents ?? Number.MAX_SAFE_INTEGER) - a.minCostCents;
    const bw = (b.maxCostCents ?? Number.MAX_SAFE_INTEGER) - b.minCostCents;
    return aw - bw;
  });

  const winner = candidates[0];
  let selection_reason: RuleSelectionReason;
  if (candidates.length === 1) {
    selection_reason = 'most_specific';
  } else {
    const second = candidates[1];
    if (specificity(winner) > specificity(second))
      selection_reason = 'most_specific';
    else if (winner.priority !== second.priority)
      selection_reason = 'priority_tie_break';
    else selection_reason = 'narrower_band_tie_break';
  }

  return {
    rule: winner,
    trace: {
      candidate_rules: candidates.map((c) => ({
        rule_id: c.id,
        why_matched: deriveWhyMatched(c, ctx),
      })),
      rejected_rules: rejected,
      selected_rule: winner.id,
      selection_reason,
      resolution_duration_ms: performance.now() - t0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision hash — canonical SHA256 of a fixed-shape decision input.
// Two commits/replays with identical decision-input MUST produce identical hash
// (replay determinism). The canonicalization sorts keys lexicographically and
// emits compact JSON with no whitespace.
// ─────────────────────────────────────────────────────────────────────────────

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('canonicalize: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value))
    return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return (
      '{' +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalize((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

export interface DecisionHashInput {
  piece_id_i: number;
  supplier_id: string;
  achat_ht_cents: number;
  /** Applied margin percent serialized as 2-decimal string for deterministic hashing. */
  applied_margin_pct: string;
  rule_id: number | null;
  strategy_version: string;
  reasoning_schema_version: string;
}

export function canonicalJsonHash(input: DecisionHashInput): string {
  return createHash('sha256').update(canonicalize(input), 'utf8').digest('hex');
}

/** Format an applied-margin percent for use in DecisionHashInput.applied_margin_pct. */
export function formatAppliedMargin(pct: number): string {
  return pct.toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning JSON schema — strict, versioned. Persisted into
// `pricing_decision_snapshot.reasoning_json`. Bump SemVer on any structural
// change; readers support known versions, writers always produce the latest.
// ─────────────────────────────────────────────────────────────────────────────

export const REASONING_JSON_SCHEMA_VERSION = '1.0.0' as const;

export const ReasoningJsonV1Schema = z
  .object({
    schema_version: z.literal(REASONING_JSON_SCHEMA_VERSION),
    bucket: z.string(),
    supplier: z.string().nullable(),
    category: z.string().nullable(),
    customer_type: z.enum(['B2C', 'PRO']),
    rule_match_reason: z.enum([
      'most_specific',
      'priority_tie_break',
      'narrower_band_tie_break',
      'no_match',
    ]),
    floor_applied: z.boolean(),
    cap_applied: z.boolean(),
    candidates_count: z.number().int().nonnegative(),
    rejected_count: z.number().int().nonnegative(),
    rule_resolution_duration_ms: z.number().nonnegative(),
    strategy_version: z.string().min(1),
  })
  .strict(); // forbids unknown keys → no silent acceptance of derived formats

export type ReasoningJsonV1 = z.infer<typeof ReasoningJsonV1Schema>;

/** Build a bucket label from a rule's cost band. */
export function ruleToBucketLabel(rule: PricingRule | null): string {
  if (!rule) return 'unmatched';
  const lo = (rule.minCostCents / 100).toFixed(0);
  const hi =
    rule.maxCostCents == null ? '∞' : (rule.maxCostCents / 100).toFixed(0);
  return `${lo}-${hi}€`;
}

@Injectable()
export class PricingStrategyService {
  resolveRule = resolveRule;
  resolveRuleWithTrace = resolveRuleWithTrace;
  applyStrategy = applyStrategy;
  computeStrategyVenteHt = computeStrategyVenteHt;
  canonicalJsonHash = canonicalJsonHash;
}
