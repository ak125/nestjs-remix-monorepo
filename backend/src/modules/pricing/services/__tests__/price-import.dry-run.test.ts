import {
  computeDryRun,
  type CatalogPiece,
  type ExistingPriceRow,
  type ImportLine,
} from '../price-import.dry-run';

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

const EMPTY_CATALOG = new Map<string, CatalogPiece>();

describe('computeDryRun — UPDATE path', () => {
  it('PRESERVE_EXISTING with unchanged achat → ~0 delta (calibrated no-op)', () => {
    const r = computeDryRun([line()], new Map([['BP1', existing()]]), EMPTY_CATALOG);
    expect(r.updatedCount).toBe(1);
    expect(r.totalDeltaVenteHtCents).toBe(0);
    expect(r.rows[0].operation).toBe('UPDATE');
    expect(r.rows[0].marginSource).toBe('existing');
  });

  it('new achat recomputes vente preserving marge + explainability', () => {
    const r = computeDryRun([line({ achatHtCents: 1300 })], new Map([['BP1', existing()]]), EMPTY_CATALOG);
    expect(r.rows[0].newVenteHtCents).toBe(Math.round((1300 * 154.6) / 100));
    expect(r.rows[0].derivationUsed).toBe('REMISE_ON_BRUT');
  });

  it('weights CA impact by qty_sold_12m', () => {
    const r = computeDryRun([line({ achatHtCents: 1300 })], new Map([['BP1', existing({ qtySold12m: 100 })]]), EMPTY_CATALOG);
    expect(r.estimatedRevenueDeltaCents).toBe((r.rows[0].newVenteTtcCents! - 2400) * 100);
  });

  it('reports unmatched (not in price rows nor catalog)', () => {
    const r = computeDryRun([line({ key: 'NOPE' })], new Map([['BP1', existing()]]), EMPTY_CATALOG);
    expect(r.unmatchedCount).toBe(1);
    expect(r.rows[0].matched).toBe(false);
  });

  it('never touches MANUAL_OVERRIDE / FROZEN', () => {
    const r = computeDryRun([line({ achatHtCents: 9999 })], new Map([['BP1', existing({ pricingState: 'FROZEN' })]]), EMPTY_CATALOG);
    expect(r.skippedStateCount).toBe(1);
    expect(r.rows[0].newVenteHtCents).toBeUndefined();
  });

  it('rejects a >30% jump via invariants', () => {
    const r = computeDryRun([line()], new Map([['BP1', existing({ venteHtCents: 900 })]]), EMPTY_CATALOG);
    expect(r.rows[0].rejected).toBe(true);
    expect(r.rows[0].rejectReason).toContain('DELTA_EXCEEDS_MAX');
  });

  it('activates priced-but-inactive rows (pri_dispo≠1)', () => {
    const r = computeDryRun([line()], new Map([['BP1', existing({ dispo: '0' })]]), EMPTY_CATALOG);
    expect(r.rows[0].willActivate).toBe(true);
    expect(r.activatedCount).toBe(1);
  });
});

describe('computeDryRun — INSERT / recovery path', () => {
  const catalog = new Map<string, CatalogPiece>([['VAL1', { priPieceIdI: 42 }]]);
  const recoveryLine = line({ key: 'VAL1', achatHtCents: 2000 });

  it('INSERTs a catalog piece with no price row, using marge from the file', () => {
    const r = computeDryRun([{ ...recoveryLine, margePct: 50 }], new Map(), catalog);
    expect(r.insertedCount).toBe(1);
    expect(r.rows[0].operation).toBe('INSERT');
    expect(r.rows[0].priPieceIdI).toBe(42);
    expect(r.rows[0].newVenteHtCents).toBe(Math.round((2000 * 150) / 100)); // 3000
    expect(r.rows[0].willActivate).toBe(true); // new piece → activated
    expect(r.rows[0].outlier).toBe(false); // no prior price → no delta/outlier
  });

  it('falls back to the L4 grid (floored vente) when the file has no marge', () => {
    const r = computeDryRun([recoveryLine], new Map(), catalog, {
      resolveGridVenteHt: () => 2900, // L4 applyStrategy result (floor/cap already applied)
    });
    expect(r.rows[0].marginSource).toBe('grid');
    expect(r.rows[0].newVenteHtCents).toBe(2900);
    expect(r.rows[0].appliedMargePct).toBeCloseTo(45, 1); // (2900-2000)/2000
  });

  it('rejects an INSERT with neither file marge nor a matching grid rule (no silent default)', () => {
    const r = computeDryRun([recoveryLine], new Map(), catalog); // no resolveGridVenteHt
    expect(r.rows[0].rejected).toBe(true);
    expect(r.rows[0].rejectReason).toBe('NO_MARGIN_FOR_INSERT');
    expect(r.insertedCount).toBe(0);
  });

  it('prefers UPDATE when a price row exists (no double-handling)', () => {
    const r = computeDryRun([line()], new Map([['BP1', existing()]]), new Map([['BP1', { priPieceIdI: 1 }]]));
    expect(r.rows[0].operation).toBe('UPDATE');
    expect(r.insertedCount).toBe(0);
  });
});
