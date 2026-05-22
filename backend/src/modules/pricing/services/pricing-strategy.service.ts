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
import { Injectable } from '@nestjs/common';
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
  if (rule.effectiveFrom && t < new Date(rule.effectiveFrom).getTime()) return false;
  if (rule.effectiveTo && t >= new Date(rule.effectiveTo).getTime()) return false;
  return true;
}

function matchesContext(rule: PricingRule, ctx: PricingStrategyContext, at: Date): boolean {
  if (!rule.active) return false;
  if (!inEffectiveWindow(rule, at)) return false;
  if (ctx.costCents < rule.minCostCents) return false;
  if (rule.maxCostCents != null && ctx.costCents >= rule.maxCostCents) return false;
  if (rule.customerType != null && rule.customerType !== ctx.customerType) return false;
  if (rule.supplierPmId != null && rule.supplierPmId !== (ctx.supplierPmId ?? null)) return false;
  if (rule.categoryGammeId != null && rule.categoryGammeId !== (ctx.categoryGammeId ?? null)) return false;
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
export function applyStrategy(costCents: number, rule: PricingRule): StrategyResult {
  const capApplied = rule.maxMarginRate != null && rule.marginRate > rule.maxMarginRate;
  const appliedMarginRate = capApplied ? (rule.maxMarginRate as number) : rule.marginRate;
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

@Injectable()
export class PricingStrategyService {
  resolveRule = resolveRule;
  applyStrategy = applyStrategy;
  computeStrategyVenteHt = computeStrategyVenteHt;
}
