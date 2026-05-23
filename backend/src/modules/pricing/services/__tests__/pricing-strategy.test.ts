import {
  applyStrategy,
  canonicalJsonHash,
  computeStrategyVenteHt,
  formatAppliedMargin,
  REASONING_JSON_SCHEMA_VERSION,
  ReasoningJsonV1Schema,
  resolveRule,
  resolveRuleWithTrace,
  ruleToBucketLabel,
  type PricingRule,
  type PricingStrategyContext,
} from '../pricing-strategy.service';

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: 1,
  minCostCents: 0,
  maxCostCents: null,
  marginRate: 50,
  minMarginAmountCents: 0,
  maxMarginRate: null,
  customerType: null,
  supplierPmId: null,
  categoryGammeId: null,
  priority: 0,
  active: true,
  ...over,
});

const ctx = (over: Partial<PricingStrategyContext> = {}): PricingStrategyContext => ({
  costCents: 1500,
  customerType: 'B2C',
  ...over,
});

describe('PricingStrategy — L4', () => {
  describe('resolveRule', () => {
    it('matches the cost bucket', () => {
      const rules = [
        rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 60 }),
        rule({ id: 2, minCostCents: 1000, maxCostCents: 3000, marginRate: 53 }),
      ];
      expect(resolveRule(rules, ctx({ costCents: 1500 }))?.id).toBe(2);
    });

    it('prefers a more specific rule (supplier+category) over a generic bucket', () => {
      const rules = [
        rule({ id: 1, marginRate: 50 }), // generic
        rule({ id: 2, marginRate: 40, supplierPmId: 'BOSCH', categoryGammeId: 7 }),
      ];
      expect(resolveRule(rules, ctx({ supplierPmId: 'BOSCH', categoryGammeId: 7 }))?.id).toBe(2);
    });

    it('respects customer_type', () => {
      const rules = [
        rule({ id: 1, customerType: 'B2C', marginRate: 50 }),
        rule({ id: 2, customerType: 'PRO', marginRate: 30 }),
      ];
      expect(resolveRule(rules, ctx({ customerType: 'PRO' }))?.id).toBe(2);
    });

    it('honours the effective window', () => {
      const rules = [
        rule({ id: 1, effectiveFrom: '2999-01-01' }), // future → inactive
      ];
      expect(resolveRule(rules, ctx({ at: new Date('2026-05-22') }))).toBeNull();
    });

    it('returns null when nothing matches (explicit, no fallback)', () => {
      expect(resolveRule([rule({ minCostCents: 10000 })], ctx({ costCents: 100 }))).toBeNull();
    });
  });

  describe('applyStrategy — floor & cap', () => {
    it('applies the rate when above the floor', () => {
      // cost 1500, +50% = 2250
      const r = applyStrategy(1500, rule({ marginRate: 50, minMarginAmountCents: 100 }));
      expect(r.venteHtCents).toBe(2250);
      expect(r.floorApplied).toBe(false);
    });

    it('applies the fixed floor on tiny cheap parts (the 0,15 € problem)', () => {
      // cost 300 (3€), +20% = 360 → only 0,60€ margin; floor 500c → vente 800
      const r = applyStrategy(300, rule({ marginRate: 20, minMarginAmountCents: 500 }));
      expect(r.venteHtCents).toBe(800);
      expect(r.floorApplied).toBe(true);
    });

    it('caps the applied rate at max_margin_rate', () => {
      const r = applyStrategy(1000, rule({ marginRate: 500, maxMarginRate: 100 }));
      expect(r.appliedMarginRate).toBe(100);
      expect(r.capApplied).toBe(true);
      expect(r.venteHtCents).toBe(2000); // +100%
    });
  });

  it('computeStrategyVenteHt resolves + applies, null when no match', () => {
    const rules = [rule({ minCostCents: 1000, maxCostCents: 3000, marginRate: 53, minMarginAmountCents: 0 })];
    expect(computeStrategyVenteHt(rules, ctx({ costCents: 1500 }))?.venteHtCents).toBe(
      Math.round((1500 * 153) / 100),
    );
    expect(computeStrategyVenteHt(rules, ctx({ costCents: 100 }))).toBeNull();
  });

  // ─── H3 — resolveRuleWithTrace ────────────────────────────────────────────
  describe('resolveRuleWithTrace (H3)', () => {
    it('converges with resolveRule on the winner', () => {
      const rules = [
        rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 60 }),
        rule({ id: 2, minCostCents: 1000, maxCostCents: 3000, marginRate: 53 }),
        rule({ id: 3, minCostCents: 1000, maxCostCents: 3000, marginRate: 40, supplierPmId: 'CAL' }),
      ];
      const c = ctx({ costCents: 1500, supplierPmId: 'CAL' });
      const fast = resolveRule(rules, c);
      const traced = resolveRuleWithTrace(rules, c);
      expect(traced.rule?.id).toBe(fast?.id);
      expect(traced.rule?.id).toBe(3); // supplier override beats generic bucket
      expect(traced.trace.selected_rule).toBe(3);
      expect(traced.trace.selection_reason).toBe('most_specific');
    });

    it('records candidates with why_matched + rejections with why_rejected', () => {
      const rules = [
        rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 60 }),
        rule({ id: 2, minCostCents: 1000, maxCostCents: 3000, marginRate: 53 }),
        rule({ id: 3, minCostCents: 1000, maxCostCents: 3000, marginRate: 40, supplierPmId: 'OTHER' }),
        rule({ id: 4, minCostCents: 0, maxCostCents: 100, marginRate: 90 }),
        rule({ id: 5, active: false }),
      ];
      const traced = resolveRuleWithTrace(rules, ctx({ costCents: 1500, supplierPmId: 'CAL' }));
      expect(traced.trace.selected_rule).toBe(2);
      // Only rule 2 is a candidate (no supplier match for 3, wrong bucket for 1/4, inactive for 5).
      expect(traced.trace.candidate_rules.map((c) => c.rule_id)).toEqual([2]);
      const rejectedById = new Map(traced.trace.rejected_rules.map((r) => [r.rule_id, r.why_rejected]));
      expect(rejectedById.get(1)).toBe('wrong_bucket_max');
      expect(rejectedById.get(3)).toBe('wrong_supplier');
      expect(rejectedById.get(4)).toBe('wrong_bucket_max');
      expect(rejectedById.get(5)).toBe('inactive');
    });

    it('returns no_match selection_reason when no rule applies', () => {
      const rules = [rule({ id: 1, minCostCents: 1000, maxCostCents: 3000 })];
      const traced = resolveRuleWithTrace(rules, ctx({ costCents: 100 }));
      expect(traced.rule).toBeNull();
      expect(traced.trace.selected_rule).toBeNull();
      expect(traced.trace.selection_reason).toBe('no_match');
    });

    it('measures resolution_duration_ms (>= 0, microsecond precision)', () => {
      const rules = Array.from({ length: 50 }, (_, i) =>
        rule({ id: i + 1, minCostCents: i * 100, maxCostCents: (i + 1) * 100 + 1, marginRate: 50 - i / 2 }),
      );
      const traced = resolveRuleWithTrace(rules, ctx({ costCents: 1500 }));
      expect(traced.trace.resolution_duration_ms).toBeGreaterThanOrEqual(0);
      expect(traced.trace.resolution_duration_ms).toBeLessThan(50); // generous upper bound
    });

    it('detects priority_tie_break vs most_specific', () => {
      const r1 = rule({ id: 1, minCostCents: 0, maxCostCents: 10000, marginRate: 50, priority: 10 });
      const r2 = rule({ id: 2, minCostCents: 0, maxCostCents: 10000, marginRate: 40, priority: 5 });
      const traced = resolveRuleWithTrace([r1, r2], ctx({ costCents: 1500 }));
      expect(traced.trace.selected_rule).toBe(1);
      expect(traced.trace.selection_reason).toBe('priority_tie_break');
    });
  });

  // ─── H1 — canonicalJsonHash + Zod reasoning_json schema ───────────────────
  describe('canonicalJsonHash (decision_hash spec)', () => {
    it('is deterministic across key insertion order', () => {
      const a = canonicalJsonHash({
        piece_id_i: 42,
        supplier_id: 'CAL',
        achat_ht_cents: 1215,
        applied_margin_pct: '54.60',
        rule_id: 7,
        strategy_version: 'rules-v1.0.0',
        reasoning_schema_version: '1.0.0',
      });
      const b = canonicalJsonHash({
        reasoning_schema_version: '1.0.0',
        strategy_version: 'rules-v1.0.0',
        rule_id: 7,
        applied_margin_pct: '54.60',
        achat_ht_cents: 1215,
        supplier_id: 'CAL',
        piece_id_i: 42,
      });
      expect(a).toBe(b);
    });

    it('changes when any field changes', () => {
      const base = {
        piece_id_i: 42, supplier_id: 'CAL', achat_ht_cents: 1215,
        applied_margin_pct: '54.60', rule_id: 7,
        strategy_version: 'rules-v1.0.0', reasoning_schema_version: '1.0.0',
      };
      const baseHash = canonicalJsonHash(base);
      expect(canonicalJsonHash({ ...base, achat_ht_cents: 1216 })).not.toBe(baseHash);
      expect(canonicalJsonHash({ ...base, applied_margin_pct: '54.61' })).not.toBe(baseHash);
      expect(canonicalJsonHash({ ...base, rule_id: 8 })).not.toBe(baseHash);
    });

    it('formatAppliedMargin emits 2-decimal string', () => {
      expect(formatAppliedMargin(54.6)).toBe('54.60');
      expect(formatAppliedMargin(53)).toBe('53.00');
      expect(formatAppliedMargin(53.125)).toBe('53.13'); // banker / half-up rounding from toFixed
    });
  });

  describe('ReasoningJsonV1Schema', () => {
    it('accepts a valid v1.0.0 payload', () => {
      const ok = ReasoningJsonV1Schema.parse({
        schema_version: REASONING_JSON_SCHEMA_VERSION,
        bucket: '30-80€',
        supplier: 'CAL',
        category: null,
        customer_type: 'B2C',
        rule_match_reason: 'most_specific',
        floor_applied: false,
        cap_applied: false,
        candidates_count: 1,
        rejected_count: 4,
        rule_resolution_duration_ms: 0.12,
        strategy_version: 'rules-v1.0.0',
      });
      expect(ok.schema_version).toBe('1.0.0');
    });

    it('rejects an unknown schema_version (no silent fallback)', () => {
      expect(() =>
        ReasoningJsonV1Schema.parse({
          schema_version: '0.9.0',
          bucket: 'x', supplier: null, category: null, customer_type: 'B2C',
          rule_match_reason: 'most_specific',
          floor_applied: false, cap_applied: false,
          candidates_count: 0, rejected_count: 0,
          rule_resolution_duration_ms: 0, strategy_version: 'v1',
        }),
      ).toThrow();
    });

    it('rejects an unknown key (strict mode)', () => {
      expect(() =>
        ReasoningJsonV1Schema.parse({
          schema_version: REASONING_JSON_SCHEMA_VERSION,
          bucket: 'x', supplier: null, category: null, customer_type: 'B2C',
          rule_match_reason: 'most_specific',
          floor_applied: false, cap_applied: false,
          candidates_count: 0, rejected_count: 0,
          rule_resolution_duration_ms: 0, strategy_version: 'v1',
          extra_field: 'nope',
        }),
      ).toThrow();
    });
  });

  describe('ruleToBucketLabel', () => {
    it('formats a rule cost band as "lo-hi€"', () => {
      expect(ruleToBucketLabel(rule({ minCostCents: 3000, maxCostCents: 8000 }))).toBe('30-80€');
      expect(ruleToBucketLabel(rule({ minCostCents: 30000, maxCostCents: null }))).toBe('300-∞€');
      expect(ruleToBucketLabel(null)).toBe('unmatched');
    });
  });
});
