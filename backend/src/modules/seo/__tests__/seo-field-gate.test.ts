import { SeoTitleEngineService } from '../services/seo-title-engine.service';
import {
  SeoFieldGate,
  SEO_BRAND_NAME,
  SEO_RESOLVER_VERSION,
  R1_FORBIDDEN_TERMS,
} from '../utils/seo-field-gate';

/**
 * SeoFieldGate + resolver gated (Phase 11, SHADOW).
 * Prouve : G3 (clip marque-aveugle) et G5 (asymétrie title/desc) FERMÉS dans resolveGated(),
 * ET resolve() byte-identique (le live garde le clip + la fuite — observe-only).
 * Cf. audit/seo-producer-chain-unified-verify-2026-06-26.md.
 */

describe('SeoFieldGate.brandAwareFit', () => {
  it('laisse une valeur ≤ max intacte', () => {
    expect(SeoFieldGate.brandAwareFit('Filtre à huile | AutoMecanik', 60)).toBe(
      'Filtre à huile | AutoMecanik',
    );
  });

  it('préserve la marque quand le suffixe « | AutoMecanik » dépasse (ferme G3)', () => {
    const core = 'Filtre à huile | Trouvez la référence compatible';
    const value = `${core} | ${SEO_BRAND_NAME}`;
    expect(value.length).toBeGreaterThan(60); // cas réel pg7 (>60)

    const fitted = SeoFieldGate.brandAwareFit(value, 60);
    expect(fitted.length).toBeLessThanOrEqual(60);
    expect(fitted).toContain(SEO_BRAND_NAME); // marque INTACTE
    expect(fitted.endsWith(`| ${SEO_BRAND_NAME}`)).toBe(true);
    expect(fitted).not.toMatch(/AutoMeca…$/); // surtout PAS 'AutoMeca…'
  });

  it('réconcilie le plafond validité (80c) et rendu (60c) : un draft 80c → ≤60 brand-safe', () => {
    const value = `${'A'.repeat(80 - ` | ${SEO_BRAND_NAME}`.length)} | ${SEO_BRAND_NAME}`;
    expect(value.length).toBe(80);
    const fitted = SeoFieldGate.brandAwareFit(value, 60);
    expect(fitted.length).toBeLessThanOrEqual(60);
    expect(fitted).toContain(SEO_BRAND_NAME);
  });

  it('sans suffixe marque → clip ellipse simple', () => {
    const value = 'x'.repeat(200);
    const fitted = SeoFieldGate.brandAwareFit(value, 155);
    expect(fitted.length).toBe(155);
    expect(fitted.endsWith('…')).toBe(true);
  });
});

describe('SeoFieldGate.hasForbidden', () => {
  it('détecte les termes transactionnels R1', () => {
    expect(SeoFieldGate.hasForbidden('Filtre pas cher dès 5€')).toBe(true);
    expect(
      SeoFieldGate.hasForbidden('Acheter en stock, livraison rapide'),
    ).toBe(true);
  });
  it('laisse passer un texte R1-propre', () => {
    expect(
      SeoFieldGate.hasForbidden(
        'Filtre à huile compatible avec votre véhicule',
      ),
    ).toBe(false);
  });
  it('expose la liste comme source unique non vide', () => {
    expect(R1_FORBIDDEN_TERMS.length).toBeGreaterThan(0);
    expect(R1_FORBIDDEN_TERMS).toContain('€');
  });
});

describe('SeoTitleEngineService.resolveGated (Phase 11 shadow)', () => {
  const engine = new SeoTitleEngineService();

  const longTitleDraft = `Filtre à huile | Trouvez la référence compatible | ${SEO_BRAND_NAME}`;
  const baseCtx = {
    pgNameSite: 'Filtre à huile',
    pgNameMeta: 'Filtre à huile',
    gammeStats: { products_total: 3520, vehicles_total: 1500 },
    brandNames: ['MANN', 'MAHLE', 'BOSCH'],
  };

  it('G3 fermé : title gated préserve la marque (≤60, AutoMecanik intact)', () => {
    const out = engine.resolveGated({
      ...baseCtx,
      seoData: { sg_title_draft: longTitleDraft },
    });
    expect(longTitleDraft.length).toBeGreaterThan(60);
    expect(out.title.value.length).toBeLessThanOrEqual(60);
    expect(out.title.value).toContain(SEO_BRAND_NAME);
    expect(out.title.sourceStage).toBe('runtime_db');
    expect(out.title.sourceId).toBe('sg_title_draft');
    expect(out.title.degraded).toBe(false);
    expect(out.title.resolverVersion).toBe(SEO_RESOLVER_VERSION);
  });

  it('G5 fermé : desc draft avec termes interdits → écartée (symétrique au title)', () => {
    const out = engine.resolveGated({
      ...baseCtx,
      seoData: {
        sg_descrip_draft:
          'Filtre à huile pas cher dès 5€, en stock, livraison 24-48h. Comparez les références compatibles.',
      },
    });
    // le draft transactionnel est rejeté → fallback dynamique propre
    expect(out.description.value).not.toContain('€');
    expect(out.description.value).not.toContain('pas cher');
    expect(out.description.degraded).toBe(true);
    expect(out.description.degradeReason).toBe(
      'draft_rejected_forbidden_terms',
    );
    expect(out.description.sourceStage).toBe('legacy_switch_validated');
  });

  it('desc draft propre → admise verbatim (runtime_db, non dégradée)', () => {
    const clean =
      'Filtre à huile compatible avec votre véhicule : comparez les références et filtrez par marque, modèle et motorisation.';
    const out = engine.resolveGated({
      ...baseCtx,
      seoData: { sg_descrip_draft: clean },
    });
    expect(out.description.value).toBe(clean);
    expect(out.description.sourceStage).toBe('runtime_db');
    expect(out.description.degraded).toBe(false);
  });

  it('expose surface R1 + provenance complète', () => {
    const out = engine.resolveGated({
      ...baseCtx,
      seoData: { sg_title_draft: longTitleDraft },
    });
    expect(out.surface).toBe('R1');
    expect(out.entityKey).toContain('Filtre à huile');
    expect(Array.isArray(out.title.evidenceIds)).toBe(true);
  });
});

describe('SeoTitleEngineService.resolve (LIVE inchangé — preuve byte-identité)', () => {
  const engine = new SeoTitleEngineService();
  const longTitleDraft = `Filtre à huile | Trouvez la référence compatible | ${SEO_BRAND_NAME}`;

  it('garde le clip marque-aveugle (G3 non corrigé côté live)', () => {
    const { title } = engine.resolve({
      pgNameSite: 'Filtre à huile',
      pgNameMeta: 'Filtre à huile',
      seoData: { sg_title_draft: longTitleDraft },
      gammeStats: { products_total: 3520, vehicles_total: 1500 },
      brandNames: ['MANN', 'MAHLE', 'BOSCH'],
    });
    expect(title.length).toBe(60);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toContain(SEO_BRAND_NAME); // marque coupée (comportement legacy intact)
  });

  it('garde la fuite de termes transactionnels en description (G5 non corrigé côté live)', () => {
    const { description } = engine.resolve({
      pgNameSite: 'Filtre à huile',
      pgNameMeta: 'Filtre à huile',
      seoData: {
        sg_descrip_draft:
          'Filtre à huile pas cher dès 5€, en stock, livraison 24-48h. Comparez les références compatibles.',
      },
      gammeStats: { products_total: 3520, vehicles_total: 1500 },
      brandNames: ['MANN', 'MAHLE', 'BOSCH'],
    });
    expect(description).toContain('€'); // le live laisse encore fuiter (legacy intact)
  });
});
