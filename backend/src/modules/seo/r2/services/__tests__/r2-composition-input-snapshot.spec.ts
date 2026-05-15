/**
 * ADR-066 — R2 Composition Input Snapshot tests
 *
 * Coverage : deterministic input_hash via inline stableStringify.
 * Key-order independent, whitespace-free, sha256-correct.
 */

import { R2CompositionInputSnapshotService } from '../r2-composition-input-snapshot.service';
import type { R2CompositionInput } from '../../schemas/r2-composition.schema';

// Minimal valid input fixture.
const baseInput: R2CompositionInput = {
  pgId: 100,
  typeId: 12345,
  r1: {
    pgId: 100,
    pgAlias: 'filtre-a-huile',
    keywordPlan: {
      primaryKw: 'filtre à huile',
      intentSignals: ['mécanique', 'entretien'],
      selectionCriteria: ['conforme OE'],
      faqQuestions: ['Quel filtre choisir ?'],
    },
    ragContent: null,
    gammeConseil: null,
  },
  r8: {
    neighborFamilyKey: 'audi::a4::diesel::berline',
    neighborPages: [],
    sharedProductRatio: 0,
    sharedOemRatio: 0,
    sharedSupplierRatio: 0,
  },
  motor: {
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
    uniqueProductFamilies: ['filter-oil'],
    productCount: 50,
  },
  cluster: {
    gammeId: 100,
    clusterKey: 'audi::a4::diesel::berline::100',
    typeIds: [12345, 67890],
    clusterSize: 2,
    pilotTier: 'G1_GENERAL',
  },
  catalogSignature: {
    signature: 'a'.repeat(64),
    sortedOemRefs: ['REF1'],
    sortedSubgroups: ['SG1'],
    productFamilyCounts: { 'filter-oil': 5 },
  },
};

describe('R2CompositionInputSnapshotService.computeInputHash', () => {
  // Service requires SupabaseBaseService deps in constructor — we only test
  // the pure computeInputHash here, so we instantiate with a stub-like cast.
  const service = Object.create(
    R2CompositionInputSnapshotService.prototype,
  ) as R2CompositionInputSnapshotService;

  it('returns sha256 hex 64 chars', () => {
    const hash = service.computeInputHash(baseInput);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns same hash for identical inputs', () => {
    const hashA = service.computeInputHash(baseInput);
    const hashB = service.computeInputHash(baseInput);
    expect(hashA).toBe(hashB);
  });

  it('returns SAME hash regardless of object key order (canonical JSON)', () => {
    // Construct an "input2" with same logical content but JS key order differs.
    // Spread + override preserves source key order; then we rebuild with
    // different field ordering using JSON parse/stringify roundtrip + manual reorder.
    const reordered: R2CompositionInput = {
      typeId: baseInput.typeId,
      pgId: baseInput.pgId,
      catalogSignature: baseInput.catalogSignature,
      cluster: baseInput.cluster,
      motor: baseInput.motor,
      r8: baseInput.r8,
      r1: baseInput.r1,
    } as R2CompositionInput;
    expect(service.computeInputHash(baseInput)).toBe(
      service.computeInputHash(reordered),
    );
  });

  it('returns DIFFERENT hash when content actually differs', () => {
    const modified: R2CompositionInput = {
      ...baseInput,
      motor: { ...baseInput.motor, powerHp: 130 },
    };
    expect(service.computeInputHash(baseInput)).not.toBe(
      service.computeInputHash(modified),
    );
  });
});
