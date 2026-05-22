import {
  applyStrategy,
  computeStrategyVenteHt,
  resolveRule,
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
});
