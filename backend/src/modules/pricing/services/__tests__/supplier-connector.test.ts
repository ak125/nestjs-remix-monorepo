import { reconcile } from '../supplier-connector.contract';

const computed = {
  ref: 'BP1',
  achatHtCents: 1215,
  margePct: 54.57,
  active: true,
};

describe('Step 2 — supplier reconciliation (generic contract)', () => {
  it('OK when price + margin + availability all match within tolerance', () => {
    const r = reconcile(computed, {
      ref: 'BP1',
      achatHtCents: 1215,
      margePct: 54.6,
      available: true,
    });
    expect(r.ok).toBe(true);
    expect(r.priceMatches).toBe(true);
    expect(r.marginUnchanged).toBe(true); // 54.57 vs 54.6 within 0.5pp
    expect(r.availabilityMatches).toBe(true);
  });

  it('flags PRICE_MISMATCH when the supplier net differs', () => {
    const r = reconcile(computed, { ref: 'BP1', achatHtCents: 1300 });
    expect(r.ok).toBe(false);
    expect(r.priceMatches).toBe(false);
    expect(r.issues.join()).toContain('PRICE_MISMATCH');
  });

  it('flags MARGIN_CHANGED beyond tolerance', () => {
    const r = reconcile(computed, { ref: 'BP1', margePct: 40 });
    expect(r.ok).toBe(false);
    expect(r.marginUnchanged).toBe(false);
    expect(r.issues.join()).toContain('MARGIN_CHANGED');
  });

  it('skips a check the supplier did not expose (undefined, not failure)', () => {
    const r = reconcile(computed, { ref: 'BP1', achatHtCents: 1215 }); // no margin/availability
    expect(r.ok).toBe(true);
    expect(r.marginUnchanged).toBeUndefined();
    expect(r.availabilityMatches).toBeUndefined();
  });

  it('a missing quote is an explicit issue (no silent pass)', () => {
    const r = reconcile(computed, null);
    expect(r.ok).toBe(false);
    expect(r.issues).toContain('NO_SUPPLIER_QUOTE');
  });
});
