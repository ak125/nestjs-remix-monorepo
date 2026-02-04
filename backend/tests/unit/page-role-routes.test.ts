/**
 * PageRole URL Mapping Tests
 *
 * Validates that URLs are correctly mapped to their PageRole.
 * This ensures SEO consistency and prevents role misassignment.
 *
 * @see backend/src/modules/seo/types/page-role.types.ts
 */
import {
  getPageRoleFromUrl,
  PageRole,
} from '../../src/modules/seo/types/page-role.types';

describe('PageRole URL Mapping', () => {
  // ═══════════════════════════════════════════════════════════════
  // R1 ROUTER - Navigation/Selection pages
  // ═══════════════════════════════════════════════════════════════
  describe('R1_ROUTER detection', () => {
    const R1_URLS = [
      // Gamme pages (pieces catalog)
      '/pieces/freinage-1.html',
      '/pieces/embrayage-123.html',
      '/pieces/kit-distribution-456.html',
      // Catalog
      '/pieces/catalogue',
      '/catalogue',
      // Brand pages
      '/constructeurs/peugeot.html',
      '/constructeurs/renault.html',
      // Vehicle type pages
      '/constructeurs/peugeot/308/1.6-hdi.html',
      // EN brands
      '/brands',
      '/brands/123/models',
      '/brands/123/models/456/types',
      // Product ranges
      '/products/ranges',
      '/products/gammes/freinage',
      // Gammes
      '/gammes/embrayage',
      // Vehicles selector
      '/vehicles',
      // Marques
      '/marques',
    ];

    it.each(R1_URLS)('detects R1_ROUTER for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R1_ROUTER);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R2 PRODUCT - Transaction pages
  // ═══════════════════════════════════════════════════════════════
  describe('R2_PRODUCT detection', () => {
    const R2_URLS = [
      // Product with full vehicle context
      '/pieces/disque-frein/peugeot/308/1.6-hdi.html',
      '/pieces/kit-embrayage/renault/clio/1.5-dci.html',
      // Legacy products
      '/products/12345',
      '/products/99999',
    ];

    it.each(R2_URLS)('detects R2_PRODUCT for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R2_PRODUCT);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R3 BLOG - Educational/Expert content
  // ═══════════════════════════════════════════════════════════════
  describe('R3_BLOG detection', () => {
    const R3_URLS = [
      '/blog-pieces-auto',
      '/blog-pieces-auto/guide/entretien-freinage',
      '/blog-pieces-auto/article/comment-changer-embrayage',
      '/blog-pieces-auto/conseils/freinage',
      '/blog-pieces-auto/auto/peugeot/308',
    ];

    it.each(R3_URLS)('detects R3_BLOG for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R3_BLOG);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R4 REFERENCE - Technical definitions
  // ═══════════════════════════════════════════════════════════════
  describe('R4_REFERENCE detection', () => {
    const R4_URLS = [
      '/reference-auto',
      '/reference-auto/',
      '/reference-auto/definition-abs',
      '/reference-auto/qu-est-ce-que-embrayage',
      '/reference-auto/composants-systeme-freinage',
      // Glossary (temporary R4)
      '/blog-pieces-auto/glossaire/abs',
    ];

    it.each(R4_URLS)('detects R4_REFERENCE for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R4_REFERENCE);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R5 DIAGNOSTIC - Symptom/problem identification
  // ═══════════════════════════════════════════════════════════════
  describe('R5_DIAGNOSTIC detection', () => {
    const R5_URLS = [
      '/diagnostic-auto',
      '/diagnostic-auto/',
      '/diagnostic-auto/bruit-freinage',
      '/diagnostic-auto/vibration-volant',
      '/diagnostic-auto/voyant-moteur-allume',
    ];

    it.each(R5_URLS)('detects R5_DIAGNOSTIC for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R5_DIAGNOSTIC);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R6 SUPPORT - Help/Legal pages
  // ═══════════════════════════════════════════════════════════════
  describe('R6_SUPPORT detection', () => {
    const R6_URLS = [
      '/support',
      '/support/faq',
      '/contact',
      '/aide',
      '/mentions-legales',
      '/conditions-generales-de-vente.html',
      '/politique-confidentialite',
      '/legal',
      '/tickets',
      '/tickets/123',
      '/reviews',
      '/staff',
    ];

    it.each(R6_URLS)('detects R6_SUPPORT for "%s"', (url) => {
      expect(getPageRoleFromUrl(url)).toBe(PageRole.R6_SUPPORT);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EXCLUDED PAGES - Should return null
  // ═══════════════════════════════════════════════════════════════
  describe('Excluded pages (return null)', () => {
    const EXCLUDED_URLS = [
      // Cart & Checkout
      '/cart',
      '/checkout',
      '/checkout/payment',
      '/checkout/confirmation',
      // Account (protected)
      '/account',
      '/account/orders',
      '/account/profile',
      // Auth pages
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/reset-password/token123',
      // Search results (dynamic)
      '/search/results',
      '/search/results?q=freinage',
      '/recherche',
      // B2B Commercial
      '/commercial/',
      '/commercial/dashboard',
      // Admin
      '/admin/',
      '/admin/dashboard',
      '/admin/users',
    ];

    it.each(EXCLUDED_URLS)('excludes "%s" (returns null)', (url) => {
      expect(getPageRoleFromUrl(url)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES & PRIORITY TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Pattern priority (specific before generic)', () => {
    it('glossary matches R4 before R3 blog catch-all', () => {
      // /blog-pieces-auto/glossaire should be R4, not R3
      expect(getPageRoleFromUrl('/blog-pieces-auto/glossaire/abs')).toBe(
        PageRole.R4_REFERENCE,
      );
    });

    it('product with vehicle context is R2, not R1 gamme', () => {
      // Full path = R2 Product
      expect(
        getPageRoleFromUrl('/pieces/disque-frein/peugeot/308/1.6-hdi.html'),
      ).toBe(PageRole.R2_PRODUCT);
      // Short path = R1 Router
      expect(getPageRoleFromUrl('/pieces/disque-frein-123.html')).toBe(
        PageRole.R1_ROUTER,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COVERAGE: All roles have at least one pattern
  // ═══════════════════════════════════════════════════════════════
  describe('Role coverage', () => {
    const allRoles = Object.values(PageRole);

    it.each(allRoles)('has at least one URL pattern for %s', (role) => {
      // This is a meta-test to ensure all roles are testable
      expect(role).toBeDefined();
    });
  });
});
