import { describe, it, expect } from 'vitest';
import {
  PageRole,
  LEGACY_PAGE_ROLE_MAP,
  normalizeLegacyPageRole,
  isEditorialRole,
} from '~/utils/page-role.types';

describe('normalizeLegacyPageRole', () => {
  describe('canonical passthrough', () => {
    it('should return R3_CONSEILS for canonical input', () => {
      expect(normalizeLegacyPageRole('R3_CONSEILS')).toBe(
        PageRole.R3_CONSEILS,
      );
    });

    it('should return R6_GUIDE_ACHAT for canonical input', () => {
      expect(normalizeLegacyPageRole('R6_GUIDE')).toBe(
        PageRole.R6_GUIDE_ACHAT,
      );
    });

    it('should return R1_ROUTER for canonical input', () => {
      expect(normalizeLegacyPageRole('R1')).toBe(PageRole.R1_ROUTER);
    });
  });

  describe('legacy alias mapping', () => {
    it('should map R3_BLOG → R3_CONSEILS', () => {
      expect(normalizeLegacyPageRole('R3_BLOG')).toBe(PageRole.R3_CONSEILS);
    });

    it('should map R3_guide → R6_GUIDE_ACHAT', () => {
      expect(normalizeLegacyPageRole('R3_guide')).toBe(
        PageRole.R6_GUIDE_ACHAT,
      );
    });

    it('should map R3_guide_achat → R6_GUIDE_ACHAT', () => {
      expect(normalizeLegacyPageRole('R3_guide_achat')).toBe(
        PageRole.R6_GUIDE_ACHAT,
      );
    });

    it('should map bare R3 → R3_CONSEILS (default)', () => {
      expect(normalizeLegacyPageRole('R3')).toBe(PageRole.R3_CONSEILS);
    });
  });

  describe('rejection of unknown', () => {
    it('should return null for unknown string', () => {
      expect(normalizeLegacyPageRole('NONSENSE')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(normalizeLegacyPageRole('')).toBeNull();
    });
  });
});

describe('isEditorialRole', () => {
  it('should return true for R3_CONSEILS', () => {
    expect(isEditorialRole(PageRole.R3_CONSEILS)).toBe(true);
  });

  it('should return true for R6_GUIDE_ACHAT', () => {
    expect(isEditorialRole(PageRole.R6_GUIDE_ACHAT)).toBe(true);
  });

  it('should return true for R4_REFERENCE', () => {
    expect(isEditorialRole(PageRole.R4_REFERENCE)).toBe(true);
  });

  it('should return false for RX_CHECKOUT', () => {
    expect(isEditorialRole(PageRole.RX_CHECKOUT)).toBe(false);
  });
});

describe('LEGACY_PAGE_ROLE_MAP', () => {
  it('should have all values be valid PageRole members', () => {
    const validRoles = new Set(Object.values(PageRole));
    for (const target of Object.values(LEGACY_PAGE_ROLE_MAP)) {
      expect(validRoles.has(target)).toBe(true);
    }
  });
});
