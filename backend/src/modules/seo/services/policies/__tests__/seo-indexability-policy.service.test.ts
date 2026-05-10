import { type R2IndexabilityConditions } from '@repo/seo-role-contracts';
import { SeoSurfaceRegistry } from '../../../registries/seo-surface.registry';
import { R2IndexabilityGate } from '../r2-indexability-gate.service';
import { SeoIndexabilityPolicyService } from '../seo-indexability-policy.service';

describe('SeoIndexabilityPolicyService', () => {
  let service: SeoIndexabilityPolicyService;

  const r2AllOk: R2IndexabilityConditions = {
    has_price: true,
    has_stock: true,
    has_image: true,
    has_oem_ref: true,
    has_equivalent_ref: true,
    has_unique_product_ref: true,
    has_valid_canonical: true,
    is_duplicate_variant: false,
  };

  beforeEach(() => {
    service = new SeoIndexabilityPolicyService(
      new SeoSurfaceRegistry(),
      new R2IndexabilityGate(),
    );
  });

  it('index,follow par défaut quand tout OK (R0_HOME)', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R0_HOME',
      requestedUrl: 'https://x.tld/',
      canonicalUrl: 'https://x.tld/',
    });
    expect(verdict.robots).toBe('index,follow');
    expect(verdict.blockingReasons).toHaveLength(0);
  });

  it('noindex,nofollow si URL ≠ canonical (R1_GAMME_VEHICLE_ROUTER)', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      requestedUrl: 'https://x.tld/pieces/a/b/c/d.html?utm=foo',
      canonicalUrl: 'https://x.tld/pieces/a/b/c/d.html',
      availableFamilies: 10,
      availableGammes: 10,
    });
    expect(verdict.robots).toBe('noindex,nofollow');
    expect(verdict.blockingReasons[0]).toMatch(/url_mismatch_canonical/);
  });

  it('noindex,nofollow si R2_PRODUCT et r2Conditions manquent', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R2_PRODUCT',
      requestedUrl: 'https://x.tld/produit/ABC',
      canonicalUrl: 'https://x.tld/produit/ABC',
    });
    expect(verdict.robots).toBe('noindex,nofollow');
    expect(verdict.blockingReasons).toContain('r2_conditions_missing');
  });

  it('noindex,nofollow si R2_PRODUCT et gate fail', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R2_PRODUCT',
      requestedUrl: 'https://x.tld/produit/ABC',
      canonicalUrl: 'https://x.tld/produit/ABC',
      r2Conditions: { ...r2AllOk, has_price: false, has_image: false },
    });
    expect(verdict.robots).toBe('noindex,nofollow');
    expect(verdict.blockingReasons).toContain('missing_price');
    expect(verdict.blockingReasons).toContain('missing_image');
  });

  it('noindex,follow si availableFamilies < 3 (R1_GAMME_ROUTER)', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R1_GAMME_ROUTER',
      requestedUrl: 'https://x.tld/pieces/foo',
      canonicalUrl: 'https://x.tld/pieces/foo',
      availableFamilies: 2,
    });
    expect(verdict.robots).toBe('noindex,follow');
    expect(verdict.blockingReasons[0]).toMatch(
      /families_below_threshold\(2<3\)/,
    );
  });

  it('noindex,follow si availableGammes < 5 (R8_VEHICLE)', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R8_VEHICLE',
      requestedUrl: 'https://x.tld/constructeurs/r/c/t',
      canonicalUrl: 'https://x.tld/constructeurs/r/c/t',
      availableGammes: 4,
    });
    expect(verdict.robots).toBe('noindex,follow');
    expect(verdict.blockingReasons[0]).toMatch(/gammes_below_threshold\(4<5\)/);
  });

  it('noindex,follow si fingerprintMatch=true', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R0_HOME',
      requestedUrl: 'https://x.tld/',
      canonicalUrl: 'https://x.tld/',
      fingerprintMatch: true,
    });
    expect(verdict.robots).toBe('noindex,follow');
    expect(verdict.blockingReasons).toContain('fingerprint_duplicate_match');
  });

  it('R2_PRODUCT indexable quand 7 conditions + canonical OK + pas de seuils applicables', () => {
    const verdict = service.computeIndexability({
      surfaceKey: 'R2_PRODUCT',
      requestedUrl: 'https://x.tld/produit/ABC',
      canonicalUrl: 'https://x.tld/produit/ABC',
      r2Conditions: r2AllOk,
    });
    expect(verdict.robots).toBe('index,follow');
    expect(verdict.blockingReasons).toHaveLength(0);
  });
});
