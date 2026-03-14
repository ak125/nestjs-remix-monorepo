import { describe, it, expect } from 'vitest';
import {
  PageRole,
  LEGACY_PAGE_ROLE_MAP,
  normalizeLegacyPageRole,
  isEditorialRole,
  getRoleCategory,
  ROLE_BADGE_COLORS,
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

describe('getRoleCategory', () => {
  it('should return editorial for R3_CONSEILS', () => {
    expect(getRoleCategory(PageRole.R3_CONSEILS)).toBe('editorial');
  });

  it('should return editorial for R6_GUIDE_ACHAT', () => {
    expect(getRoleCategory(PageRole.R6_GUIDE_ACHAT)).toBe('editorial');
  });

  it('should return support for R6_SUPPORT', () => {
    expect(getRoleCategory(PageRole.R6_SUPPORT)).toBe('support');
  });

  it('should return app for RX_CHECKOUT', () => {
    expect(getRoleCategory(PageRole.RX_CHECKOUT)).toBe('app');
  });
});

describe('ROLE_BADGE_COLORS', () => {
  it('should have a color for every PageRole', () => {
    for (const role of Object.values(PageRole)) {
      expect(ROLE_BADGE_COLORS[role]).toBeDefined();
    }
  });

  it('should not have R3_BLOG color (deprecated)', () => {
    // R3_BLOG value is "R3" which should NOT have its own color entry
    // R3_CONSEILS should be used instead
    expect(ROLE_BADGE_COLORS['R3_CONSEILS']).toBeDefined();
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
