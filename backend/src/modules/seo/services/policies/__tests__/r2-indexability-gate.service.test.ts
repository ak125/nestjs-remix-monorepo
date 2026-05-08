import { type R2IndexabilityConditions } from '@repo/seo-role-contracts';
import { R2IndexabilityGate } from '../r2-indexability-gate.service';

describe('R2IndexabilityGate', () => {
  let gate: R2IndexabilityGate;

  const allOk: R2IndexabilityConditions = {
    has_price: true,
    has_stock: true,
    has_image: true,
    has_oem_ref: true,
    has_equivalent_ref: true,
    has_unique_product_ref: true,
    has_valid_canonical: true,
    is_duplicate_variant: false,
  };

  beforeEach(() => {
    gate = new R2IndexabilityGate();
  });

  it('verdict.indexable=true quand 7 conditions OK', () => {
    const verdict = gate.evaluate(allOk);
    expect(verdict.indexable).toBe(true);
    expect(verdict.blockingReasons).toHaveLength(0);
  });

  it('verdict.indexable=false si une condition manque (missing_price)', () => {
    const verdict = gate.evaluate({ ...allOk, has_price: false });
    expect(verdict.indexable).toBe(false);
    expect(verdict.blockingReasons).toContain('missing_price');
  });

  it('verdict.indexable=false si is_duplicate_variant=true', () => {
    const verdict = gate.evaluate({ ...allOk, is_duplicate_variant: true });
    expect(verdict.indexable).toBe(false);
    expect(verdict.blockingReasons).toContain('duplicate_variant');
  });

  it('isIndexable() shortcut renvoie true si tout OK', () => {
    expect(gate.isIndexable(allOk)).toBe(true);
    expect(gate.isIndexable({ ...allOk, has_image: false })).toBe(false);
  });
});
