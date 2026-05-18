/**
 * ADR-066 — R2 Catalog Signature Service tests
 *
 * Table-driven coverage of deterministic hash + jaccardOverlap.
 */

import { R2CatalogSignatureService } from '../r2-catalog-signature.service';

describe('R2CatalogSignatureService', () => {
  let service: R2CatalogSignatureService;

  beforeEach(() => {
    service = new R2CatalogSignatureService();
  });

  describe('compute (deterministic hash)', () => {
    it('returns sha256 hex 64 chars', () => {
      const result = service.compute({
        topOemRefs: ['REF1', 'REF2'],
        subgroupKeys: ['SG1'],
        productFamilyCounts: { brakes: 5 },
      });
      expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces SAME signature for same logical input regardless of input order', () => {
      const a = service.compute({
        topOemRefs: ['REF2', 'REF1'],
        subgroupKeys: ['SG_B', 'SG_A'],
        productFamilyCounts: { brakes: 5, filters: 3 },
      });
      const b = service.compute({
        topOemRefs: ['REF1', 'REF2'],
        subgroupKeys: ['SG_A', 'SG_B'],
        productFamilyCounts: { filters: 3, brakes: 5 },
      });
      expect(a.signature).toBe(b.signature);
    });

    it('produces DIFFERENT signature for different content', () => {
      const a = service.compute({
        topOemRefs: ['REF1'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const b = service.compute({
        topOemRefs: ['REF2'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      expect(a.signature).not.toBe(b.signature);
    });

    it('trims and filters empty/whitespace OEM refs', () => {
      const result = service.compute({
        topOemRefs: ['  REF1  ', '', '   ', 'REF2'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      expect(result.sortedOemRefs).toEqual(['REF1', 'REF2']);
    });
  });

  describe('jaccardOverlap', () => {
    it('returns 1 for identical OEM ref sets', () => {
      const a = service.compute({
        topOemRefs: ['REF1', 'REF2'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const b = service.compute({
        topOemRefs: ['REF1', 'REF2'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      expect(service.jaccardOverlap(a, b)).toBe(1);
    });

    it('returns 0 for disjoint sets', () => {
      const a = service.compute({
        topOemRefs: ['REF1'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const b = service.compute({
        topOemRefs: ['REF2'],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      expect(service.jaccardOverlap(a, b)).toBe(0);
    });

    it('returns 0 for two empty sets (no false positive)', () => {
      const a = service.compute({
        topOemRefs: [],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const b = service.compute({
        topOemRefs: [],
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      expect(service.jaccardOverlap(a, b)).toBe(0);
    });

    it('crosses CATALOG_OVERLAP_THRESHOLD=0.92 only when sets overlap heavily', () => {
      // 9 shared + 1 unique → 9/10 = 0.9 (under 0.92)
      const refsA = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'A'];
      const refsB = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'B'];
      const a = service.compute({
        topOemRefs: refsA,
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const b = service.compute({
        topOemRefs: refsB,
        subgroupKeys: [],
        productFamilyCounts: {},
      });
      const overlap = service.jaccardOverlap(a, b);
      expect(overlap).toBeCloseTo(0.818, 3); // 9 intersection / 11 union
      expect(overlap).toBeLessThan(0.92);
    });
  });
});
