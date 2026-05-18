/**
 * ADR-066 — R2 Motor Delta Service tests
 *
 * Coverage : nearest sibling selection, 5 binary deltas, period disjoint, unique families.
 */

import {
  R2MotorDeltaService,
  type MotorInputRow,
} from '../r2-motor-delta.service';

const baseTarget: MotorInputRow = {
  typeId: 12345,
  fuelType: 'diesel',
  powerHp: 110,
  engineCode: 'BKD',
  literage: '1.9',
  bodyType: 'berline',
  productionYearFrom: 2010,
  productionYearTo: 2015,
  productCount: 50,
  productFamilies: ['filter-oil', 'filter-air', 'brakes'],
};

describe('R2MotorDeltaService', () => {
  let service: R2MotorDeltaService;
  beforeEach(() => {
    service = new R2MotorDeltaService();
  });

  it('returns all deltas=true for isolated motorisation (no siblings)', () => {
    const delta = service.compute(baseTarget, []);
    expect(delta.hasPowerDelta).toBe(true);
    expect(delta.hasEngineDelta).toBe(true);
    expect(delta.hasPeriodDelta).toBe(true);
    expect(delta.hasFuelDelta).toBe(true);
    expect(delta.hasBodyDelta).toBe(true);
    expect(delta.uniqueProductFamilies).toEqual([
      'brakes',
      'filter-air',
      'filter-oil',
    ]);
  });

  it('hasPowerDelta=true only when |Δhp| > 15', () => {
    const sibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      powerHp: 100,
      engineCode: 'BKD2',
    };
    const delta = service.compute(baseTarget, [sibling]);
    expect(delta.hasPowerDelta).toBe(false); // |110-100|=10 < 15

    const farSibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      powerHp: 140,
      engineCode: 'BKD2',
    };
    const delta2 = service.compute(baseTarget, [farSibling]);
    expect(delta2.hasPowerDelta).toBe(true); // |110-140|=30 > 15
  });

  it('hasEngineDelta=true when engineCode differs', () => {
    const sibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      engineCode: 'OTHER',
    };
    const delta = service.compute(baseTarget, [sibling]);
    expect(delta.hasEngineDelta).toBe(true);
  });

  it('hasPeriodDelta=true only when year ranges disjoint', () => {
    // Overlapping ranges
    const overlapSibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      productionYearFrom: 2012,
      productionYearTo: 2018,
    };
    expect(service.compute(baseTarget, [overlapSibling]).hasPeriodDelta).toBe(
      false,
    );

    // Disjoint ranges (sibling later)
    const laterSibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      productionYearFrom: 2016,
      productionYearTo: 2020,
    };
    expect(service.compute(baseTarget, [laterSibling]).hasPeriodDelta).toBe(
      true,
    );
  });

  it('hasFuelDelta=true when fuelType differs', () => {
    const sibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      fuelType: 'essence',
    };
    const delta = service.compute(baseTarget, [sibling]);
    expect(delta.hasFuelDelta).toBe(true);
  });

  it('uniqueProductFamilies = target families not in sibling', () => {
    const sibling: MotorInputRow = {
      ...baseTarget,
      typeId: 67890,
      productFamilies: ['filter-oil', 'brakes', 'suspension'],
    };
    const delta = service.compute(baseTarget, [sibling]);
    expect(delta.uniqueProductFamilies).toEqual(['filter-air']);
  });

  it('selects nearest sibling by minimum |Δpower| within same fuel', () => {
    // Two siblings: same fuel (diesel) with different powers
    const closeSibling: MotorInputRow = {
      ...baseTarget,
      typeId: 1,
      powerHp: 105,
    }; // |Δ|=5
    const farSibling: MotorInputRow = {
      ...baseTarget,
      typeId: 2,
      powerHp: 200,
    }; // |Δ|=90
    const delta = service.compute(baseTarget, [closeSibling, farSibling]);
    // Closest is 105, |110-105|=5 < 15 → hasPowerDelta=false
    expect(delta.hasPowerDelta).toBe(false);
  });
});
