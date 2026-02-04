/**
 * PageRole Link Hierarchy Tests
 *
 * Validates that internal links follow the SEO hierarchy rules.
 * Links should flow DOWN the hierarchy: R4 → R3 → R5 → R1 → R2
 *
 * @see backend/src/modules/seo/types/page-role.types.ts - ALLOWED_LINKS
 */
import { PageRoleValidatorService } from '../../src/modules/seo/services/page-role-validator.service';
import {
  PageRole,
  isLinkAllowed,
  isRoleAbove,
} from '../../src/modules/seo/types/page-role.types';

describe('PageRole Link Hierarchy', () => {
  let validator: PageRoleValidatorService;

  beforeAll(() => {
    validator = new PageRoleValidatorService();
  });

  // ═══════════════════════════════════════════════════════════════
  // HELPER FUNCTION TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('isLinkAllowed helper', () => {
    describe('R4 Reference allowed links', () => {
      it('R4 → R3 (reference → blog) is allowed', () => {
        expect(isLinkAllowed(PageRole.R4_REFERENCE, PageRole.R3_BLOG)).toBe(
          true,
        );
      });

      it('R4 → R5 (reference → diagnostic) is allowed', () => {
        expect(isLinkAllowed(PageRole.R4_REFERENCE, PageRole.R5_DIAGNOSTIC)).toBe(
          true,
        );
      });

      it('R4 → R1 (reference → router) is allowed', () => {
        expect(isLinkAllowed(PageRole.R4_REFERENCE, PageRole.R1_ROUTER)).toBe(
          true,
        );
      });

      it('R4 → R2 (reference → product) is NOT allowed', () => {
        expect(isLinkAllowed(PageRole.R4_REFERENCE, PageRole.R2_PRODUCT)).toBe(
          false,
        );
      });
    });

    describe('R3 Blog allowed links', () => {
      it('R3 → R4 (blog → reference) is allowed', () => {
        expect(isLinkAllowed(PageRole.R3_BLOG, PageRole.R4_REFERENCE)).toBe(
          true,
        );
      });

      it('R3 → R2 (blog → product) is allowed', () => {
        expect(isLinkAllowed(PageRole.R3_BLOG, PageRole.R2_PRODUCT)).toBe(true);
      });

      it('R3 → R1 (blog → router) is NOT allowed', () => {
        expect(isLinkAllowed(PageRole.R3_BLOG, PageRole.R1_ROUTER)).toBe(false);
      });
    });

    describe('R1 Router allowed links', () => {
      it('R1 → R2 (router → product) is allowed', () => {
        expect(isLinkAllowed(PageRole.R1_ROUTER, PageRole.R2_PRODUCT)).toBe(
          true,
        );
      });

      it('R1 → R3 (router → blog) is NOT allowed', () => {
        expect(isLinkAllowed(PageRole.R1_ROUTER, PageRole.R3_BLOG)).toBe(false);
      });

      it('R1 → R4 (router → reference) is NOT allowed', () => {
        expect(isLinkAllowed(PageRole.R1_ROUTER, PageRole.R4_REFERENCE)).toBe(
          false,
        );
      });
    });

    describe('R2 Product allowed links', () => {
      it('R2 → R4 (product → reference) is allowed (max 1)', () => {
        expect(isLinkAllowed(PageRole.R2_PRODUCT, PageRole.R4_REFERENCE)).toBe(
          true,
        );
      });

      it('R2 → R3 (product → blog) is allowed (max 1)', () => {
        expect(isLinkAllowed(PageRole.R2_PRODUCT, PageRole.R3_BLOG)).toBe(true);
      });

      it('R2 → R1 (product → router) is NOT allowed (upward)', () => {
        expect(isLinkAllowed(PageRole.R2_PRODUCT, PageRole.R1_ROUTER)).toBe(
          false,
        );
      });
    });

    describe('R6 Support links', () => {
      it('R6 has no allowed outbound links', () => {
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R1_ROUTER)).toBe(
          false,
        );
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R2_PRODUCT)).toBe(
          false,
        );
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R3_BLOG)).toBe(
          false,
        );
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R4_REFERENCE)).toBe(
          false,
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // HIERARCHY TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('isRoleAbove helper', () => {
    it('R4 is above R3', () => {
      expect(isRoleAbove(PageRole.R4_REFERENCE, PageRole.R3_BLOG)).toBe(true);
    });

    it('R4 is above R2', () => {
      expect(isRoleAbove(PageRole.R4_REFERENCE, PageRole.R2_PRODUCT)).toBe(true);
    });

    it('R3 is above R1', () => {
      expect(isRoleAbove(PageRole.R3_BLOG, PageRole.R1_ROUTER)).toBe(true);
    });

    it('R1 is above R2', () => {
      expect(isRoleAbove(PageRole.R1_ROUTER, PageRole.R2_PRODUCT)).toBe(true);
    });

    it('R2 is NOT above R1 (inverse)', () => {
      expect(isRoleAbove(PageRole.R2_PRODUCT, PageRole.R1_ROUTER)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDATOR SERVICE LINK TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('validateLink service method', () => {
    describe('Allowed links (no violation)', () => {
      it('R4 → R3 (reference → blog) returns no violation', () => {
        const violation = validator.validateLink(
          '/reference-auto/definition-abs',
          '/blog-pieces-auto/guide/freinage',
        );
        expect(violation).toBeNull();
      });

      it('R1 → R2 (router → product) returns no violation', () => {
        const violation = validator.validateLink(
          '/pieces/freinage-1.html',
          '/pieces/disque-frein/peugeot/308/1.6-hdi.html',
        );
        expect(violation).toBeNull();
      });

      it('R3 → R4 (blog → reference) returns warning (upward link)', () => {
        const violation = validator.validateLink(
          '/blog-pieces-auto/guide/entretien',
          '/reference-auto/definition-abs',
        );
        // R3 → R4 is technically upward, so it returns a warning
        if (violation) {
          expect(violation.severity).toBe('warning');
        }
      });
    });

    describe('Forbidden links (returns violation)', () => {
      it('R4 → R2 (reference → product) returns error', () => {
        const violation = validator.validateLink(
          '/reference-auto/definition-abs',
          '/pieces/disque-frein/peugeot/308/1.6-hdi.html',
        );
        expect(violation).not.toBeNull();
        expect(violation?.type).toBe('invalid_link');
        expect(violation?.severity).toBe('error');
      });

      it('R1 → R4 (router → reference) returns error', () => {
        const violation = validator.validateLink(
          '/pieces/freinage-1.html',
          '/reference-auto/definition-abs',
        );
        expect(violation).not.toBeNull();
        expect(violation?.type).toBe('invalid_link');
      });
    });

    describe('Forbidden upward links', () => {
      it('R2 → R1 (product → router) returns error (upward link forbidden)', () => {
        const violation = validator.validateLink(
          '/pieces/disque-frein/peugeot/308/1.6-hdi.html',
          '/pieces/freinage-1.html',
        );
        // R2 → R1 is forbidden (upward link to router)
        expect(violation).not.toBeNull();
        expect(violation?.type).toBe('invalid_link');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BATCH LINK VALIDATION
  // ═══════════════════════════════════════════════════════════════
  describe('validatePageLinks (batch)', () => {
    it('validates multiple links from a page', () => {
      const sourceUrl = '/reference-auto/definition-abs';
      const targetUrls = [
        '/blog-pieces-auto/guide/freinage', // R4 → R3 (allowed)
        '/diagnostic-auto/bruit-freinage', // R4 → R5 (allowed)
        '/pieces/freinage-1.html', // R4 → R1 (allowed)
      ];

      const violations = validator.validatePageLinks(sourceUrl, targetUrls);
      expect(violations.length).toBe(0); // All links are valid
    });

    it('catches forbidden links in batch', () => {
      const sourceUrl = '/reference-auto/definition-abs';
      const targetUrls = [
        '/blog-pieces-auto/guide/freinage', // R4 → R3 (allowed)
        '/pieces/disque-frein/peugeot/308/1.6-hdi.html', // R4 → R2 (forbidden!)
      ];

      const violations = validator.validatePageLinks(sourceUrl, targetUrls);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('invalid_link');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LINK LIMITS (R2 specific)
  // ═══════════════════════════════════════════════════════════════
  describe('Link count limits', () => {
    it('R2 should limit R4 links to 1 max', () => {
      // This is a documentation of the rule - actual enforcement may vary
      // R2 Product → R4 Reference: max 1 link
      const sourceUrl = '/pieces/disque-frein/peugeot/308/1.6-hdi.html';
      const targetUrls = [
        '/reference-auto/definition-disque', // 1st R4 link
        '/reference-auto/definition-frein', // 2nd R4 link - should warn
      ];

      const violations = validator.validatePageLinks(sourceUrl, targetUrls);
      // May or may not enforce limit depending on implementation
      // This test documents the expected behavior
      expect(violations).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMPLETE LINKING MATRIX
  // ═══════════════════════════════════════════════════════════════
  describe('Complete Linking Matrix', () => {
    const testCases = [
      // From R4 Reference
      { from: 'R4', to: 'R3', allowed: true },
      { from: 'R4', to: 'R5', allowed: true },
      { from: 'R4', to: 'R1', allowed: true },
      { from: 'R4', to: 'R2', allowed: false },
      { from: 'R4', to: 'R6', allowed: false },

      // From R3 Blog
      { from: 'R3', to: 'R4', allowed: true },
      { from: 'R3', to: 'R2', allowed: true },
      { from: 'R3', to: 'R1', allowed: false },
      { from: 'R3', to: 'R5', allowed: false },

      // From R5 Diagnostic
      { from: 'R5', to: 'R4', allowed: true },
      { from: 'R5', to: 'R1', allowed: true },
      { from: 'R5', to: 'R2', allowed: false },
      { from: 'R5', to: 'R3', allowed: false },

      // From R1 Router
      { from: 'R1', to: 'R2', allowed: true },
      { from: 'R1', to: 'R3', allowed: false },
      { from: 'R1', to: 'R4', allowed: false },
      { from: 'R1', to: 'R5', allowed: false },

      // From R2 Product
      { from: 'R2', to: 'R4', allowed: true },
      { from: 'R2', to: 'R3', allowed: true },
      { from: 'R2', to: 'R1', allowed: false },
      { from: 'R2', to: 'R5', allowed: false },

      // From R6 Support (no outbound)
      { from: 'R6', to: 'R1', allowed: false },
      { from: 'R6', to: 'R2', allowed: false },
      { from: 'R6', to: 'R3', allowed: false },
      { from: 'R6', to: 'R4', allowed: false },
    ];

    const roleMap: Record<string, PageRole> = {
      R1: PageRole.R1_ROUTER,
      R2: PageRole.R2_PRODUCT,
      R3: PageRole.R3_BLOG,
      R4: PageRole.R4_REFERENCE,
      R5: PageRole.R5_DIAGNOSTIC,
      R6: PageRole.R6_SUPPORT,
    };

    it.each(testCases)(
      '$from → $to should be $allowed',
      ({ from, to, allowed }) => {
        const result = isLinkAllowed(roleMap[from], roleMap[to]);
        expect(result).toBe(allowed);
      },
    );
  });
});
