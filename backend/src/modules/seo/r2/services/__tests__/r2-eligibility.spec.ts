/**
 * ADR-066 — R2 Eligibility Service tests (decision tree)
 *
 * Table-driven coverage of:
 *   - productCount < 2 → reject (legacy noindex rule)
 *   - score >= THRESHOLD_V1 → eligible
 *   - score < THRESHOLD_V1 + canonical sibling → suppressed
 *   - score < THRESHOLD_V1 + no canonical → reject
 */

import { R2CommercialDistinctivenessService } from '../r2-commercial-distinctiveness.service';
import { R2EligibilityService } from '../r2-eligibility.service';
import type { MotorDelta } from '../../schemas/r2-composition.schema';
import { THRESHOLD_V1 } from '../../constants/r2-eligibility.constants';

const baseMotor: MotorDelta = {
  typeId: 12345,
  fuelType: 'diesel',
  powerHp: 110,
  engineCode: 'BKD',
  literage: '1.9',
  bodyType: 'berline',
  productionYearFrom: 2010,
  productionYearTo: 2015,
  hasPowerDelta: true,
  hasEngineDelta: true,
  hasPeriodDelta: false,
  hasFuelDelta: false,
  hasBodyDelta: false,
  uniqueProductFamilies: ['filter-oil', 'filter-air'],
  productCount: 50,
};

const baseCommercialInputs = {
  targetFamilies: ['filter-oil', 'filter-air', 'brakes'],
  targetOemRefs: ['REF1', 'REF2'],
  targetSuppliers: ['Bosch', 'Mahle'],
  targetMedianPriceCents: 5000,
  targetCompatScope: ['type-12345'],
  clusterFamilies: ['filter-oil', 'brakes'],
  clusterOemRefs: ['REF1'],
  clusterSuppliers: ['Bosch'],
  clusterMedianPriceCents: 4500,
  clusterCompatScope: ['type-12346'],
};

describe('R2EligibilityService', () => {
  let service: R2EligibilityService;

  beforeEach(() => {
    service = new R2EligibilityService(
      new R2CommercialDistinctivenessService(),
    );
  });

  it('hard-rejects productCount < 2 regardless of other scores', () => {
    const verdict = service.evaluate({
      pgId: 100,
      typeId: 12345,
      motorDelta: { ...baseMotor, productCount: 1 },
      commercialInputs: baseCommercialInputs,
      productCount: 1,
      searchVolumeFactor: 50,
    });
    expect(verdict.verdict).toBe('reject');
    expect(verdict.eligibilityScore).toBe(0);
    expect(verdict.reason).toContain('productCount=1');
  });

  it('returns eligible when score >= THRESHOLD_V1 with rich deltas', () => {
    const verdict = service.evaluate({
      pgId: 100,
      typeId: 12345,
      motorDelta: baseMotor,
      commercialInputs: baseCommercialInputs,
      productCount: 50,
      searchVolumeFactor: 70,
    });
    expect(verdict.eligibilityScore).toBeGreaterThanOrEqual(THRESHOLD_V1);
    expect(verdict.verdict).toBe('eligible');
    expect(verdict.eligible).toBe(true);
  });

  // ADR-067 (2026-05-15) — SUPPRESSED automatique INTERDIT.
  // Pipeline below threshold + productCount >= 2 → REVIEW (jamais SUPPRESSED).
  // Le path SUPPRESSED reste manual-only (admin UI override).
  it('returns review when below threshold AND productCount >= 2 (ADR-067 no auto suppressed)', () => {
    const weakMotor: MotorDelta = {
      ...baseMotor,
      hasPowerDelta: false,
      hasEngineDelta: false,
      hasPeriodDelta: false,
      hasFuelDelta: false,
      hasBodyDelta: false,
      uniqueProductFamilies: [],
      productCount: 3,
    };
    const weakCommercialInputs = {
      ...baseCommercialInputs,
      targetFamilies: baseCommercialInputs.clusterFamilies,
      targetOemRefs: baseCommercialInputs.clusterOemRefs,
      targetSuppliers: baseCommercialInputs.clusterSuppliers,
      targetMedianPriceCents: baseCommercialInputs.clusterMedianPriceCents,
      targetCompatScope: baseCommercialInputs.clusterCompatScope,
    };
    const verdict = service.evaluate({
      pgId: 100,
      typeId: 12345,
      motorDelta: weakMotor,
      commercialInputs: weakCommercialInputs,
      productCount: 3,
      searchVolumeFactor: 10,
    });
    expect(verdict.eligibilityScore).toBeLessThan(THRESHOLD_V1);
    expect(verdict.verdict).toBe('review_required');
    // ADR-068 : pas de rejectReason pour verdict review_required
    expect(verdict.rejectReason).toBeUndefined();
    expect(verdict.reason).toContain('REVIEW_REQUIRED');
  });

  it('verdict enum never includes "suppressed" / "review" from pipeline (ADR-067 + ADR-068)', () => {
    // Exhaustive sweep : with varying motor strength + productCount >= 2,
    // verdict must always be in {eligible, review_required} (never suppressed,
    // never the legacy short "review" — ADR-068 renamed to review_required).
    const scenarios = [
      { hp: false, eng: false, prod: 5, sv: 0 },
      { hp: true, eng: false, prod: 10, sv: 30 },
      { hp: true, eng: true, prod: 200, sv: 90 },
      { hp: false, eng: true, prod: 3, sv: 100 },
    ];
    for (const sc of scenarios) {
      const motor: MotorDelta = {
        ...baseMotor,
        hasPowerDelta: sc.hp,
        hasEngineDelta: sc.eng,
        hasPeriodDelta: false,
        hasFuelDelta: false,
        hasBodyDelta: false,
        productCount: sc.prod,
      };
      const verdict = service.evaluate({
        pgId: 100,
        typeId: 12345,
        motorDelta: motor,
        commercialInputs: baseCommercialInputs,
        productCount: sc.prod,
        searchVolumeFactor: sc.sv,
      });
      expect(['eligible', 'review_required']).toContain(verdict.verdict);
      expect(verdict.verdict as string).not.toBe('suppressed');
      expect(verdict.verdict as string).not.toBe('review'); // ADR-068 renamed
    }
  });

  it('ADR-068 : reject verdict carries strict rejectReason (productCount_under_2)', () => {
    const verdict = service.evaluate({
      pgId: 100,
      typeId: 12345,
      motorDelta: { ...baseMotor, productCount: 0 },
      commercialInputs: baseCommercialInputs,
      productCount: 0,
      searchVolumeFactor: 0,
    });
    expect(verdict.verdict).toBe('reject');
    expect(verdict.rejectReason).toBe('productCount_under_2');
    expect(verdict.reason).toContain('ADR-068');
  });

  it('exposes all 4 subscores in verdict', () => {
    const verdict = service.evaluate({
      pgId: 100,
      typeId: 12345,
      motorDelta: baseMotor,
      commercialInputs: baseCommercialInputs,
      productCount: 50,
      searchVolumeFactor: 60,
    });
    expect(verdict.subscores.motor).toBeGreaterThanOrEqual(0);
    expect(verdict.subscores.motor).toBeLessThanOrEqual(100);
    expect(verdict.subscores.compat).toBeGreaterThanOrEqual(0);
    expect(verdict.subscores.commercial).toBeGreaterThanOrEqual(0);
    expect(verdict.subscores.crawl).toBeGreaterThanOrEqual(0);
  });
});
