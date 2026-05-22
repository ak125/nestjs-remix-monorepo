import { computeDryRun, type ExistingPriceRow, type ImportLine } from '../price-import.dry-run';

const existing = (over: Partial<ExistingPriceRow> = {}): ExistingPriceRow => ({
  priPieceIdI: 1,
  priType: '0',
  achatHtCents: 1215,
  margePct: 54.6,
  venteHtCents: 1878,
  venteTtcCents: 2400,
  fraisPortHtCents: 134,
  fraisSuppHtCents: 0,
  tvaRate: 0.2,
  pricingState: 'ACTIVE',
  qtySold12m: 10,
  dispo: '1',
  ...over,
});

const line = (over: Partial<ImportLine> = {}): ImportLine => ({
  key: 'BP1',
  matchedBy: 'REF',
  achatHtCents: 1215,
  confidence: 'HIGH_CONFIDENCE',
  derivation: 'REMISE_ON_BRUT',
  ...over,
});

describe('computeDryRun — L3 dry-run orchestration', () => {
  it('PRESERVE_EXISTING with unchanged achat → ~0 delta (calibrated no-op)', () => {
    const map = new Map([['BP1', existing()]]);
    const r = computeDryRun([line()], map);
    expect(r.matchedCount).toBe(1);
    expect(r.totalDeltaVenteHtCents).toBe(0); // 1215×1.546=1878 = existing
    expect(r.rows[0].marginSource).toBe('existing');
    expect(r.rows[0].newVenteHtCents).toBe(1878);
  });

  it('new achat → recomputes vente preserving marge, reports delta + explainability', () => {
    const map = new Map([['BP1', existing()]]);
    const r = computeDryRun([line({ achatHtCents: 1300 })], map); // +marge 54.6 → 2010
    const row = r.rows[0];
    expect(row.newVenteHtCents).toBe(Math.round((1300 * 154.6) / 100)); // 2010
    expect(row.deltaVenteHtCents).toBe(2010 - 1878);
    expect(row.derivationUsed).toBe('REMISE_ON_BRUT');
    expect(r.totalDeltaVenteHtCents).toBe(132);
  });

  it('weights CA impact by qty_sold_12m', () => {
    const map = new Map([['BP1', existing({ qtySold12m: 100 })]]);
    const r = computeDryRun([line({ achatHtCents: 1300 })], map);
    const dTtc = r.rows[0].newVenteTtcCents! - 2400;
    expect(r.estimatedRevenueDeltaCents).toBe(dTtc * 100);
  });

  it('reports unmatched refs (never silently dropped)', () => {
    const r = computeDryRun([line({ key: 'NOPE' })], new Map([['BP1', existing()]]));
    expect(r.unmatchedCount).toBe(1);
    expect(r.unmatchedKeys).toEqual(['NOPE']);
    expect(r.rows[0].matched).toBe(false);
  });

  it('never touches MANUAL_OVERRIDE / FROZEN rows', () => {
    const map = new Map([['BP1', existing({ pricingState: 'MANUAL_OVERRIDE' })]]);
    const r = computeDryRun([line({ achatHtCents: 9999 })], map);
    expect(r.skippedStateCount).toBe(1);
    expect(r.rows[0].skippedState).toBe('MANUAL_OVERRIDE');
    expect(r.rows[0].newVenteHtCents).toBeUndefined();
  });

  it('rejects a >30% jump via invariants (no override)', () => {
    // achat 1215 → preserve marge 54.6 → 1878, but force a big jump:
    const map = new Map([['BP1', existing({ venteHtCents: 900 })]]); // current much lower
    const r = computeDryRun([line()], map); // new 1878 vs 900 = +108%
    expect(r.rows[0].rejected).toBe(true);
    expect(r.rows[0].rejectReason).toContain('DELTA_EXCEEDS_MAX');
    expect(r.rejectedCount).toBe(1);
  });

  it('flags outliers but allows them with delta override', () => {
    const map = new Map([['BP1', existing({ venteHtCents: 900 })]]);
    const r = computeDryRun([line()], map, { invariants: { allowDeltaOverride: true } });
    expect(r.rows[0].outlier).toBe(true);
    expect(r.rows[0].rejected).toBeFalsy();
  });

  it('surfaces L0.5 parse errors as explicit rejects', () => {
    const r = computeDryRun([line({ parseError: 'missing column for grosHt' })], new Map());
    expect(r.rejectedCount).toBe(1);
    expect(r.rows[0].rejectReason).toContain('missing column');
  });

  it('activates priced-but-inactive pieces (pri_dispo≠1) — Step 1 rule', () => {
    const map = new Map([['BP1', existing({ dispo: '0' })]]);
    const r = computeDryRun([line()], map);
    expect(r.rows[0].willActivate).toBe(true);
    expect(r.activatedCount).toBe(1);
  });

  it('does not count activation for already-active rows', () => {
    const map = new Map([['BP1', existing({ dispo: '1' })]]);
    const r = computeDryRun([line()], map);
    expect(r.rows[0].willActivate).toBe(false);
    expect(r.activatedCount).toBe(0);
  });

  it('APPLY_GRID uses the resolved target marge (marginSource=grid)', () => {
    const map = new Map([['BP1', existing()]]);
    const r = computeDryRun([line({ margePct: 30 })], map, { marginMode: 'APPLY_GRID' });
    expect(r.rows[0].marginSource).toBe('grid');
    expect(r.rows[0].newVenteHtCents).toBe(Math.round((1215 * 130) / 100)); // 1580
  });
});
