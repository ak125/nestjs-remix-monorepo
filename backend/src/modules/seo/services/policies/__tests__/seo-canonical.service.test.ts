import {
  SeoCanonicalService,
  SeoCanonicalError,
} from '../seo-canonical.service';

describe('SeoCanonicalService', () => {
  let service: SeoCanonicalService;
  const baseUrl = 'https://www.automecanik.com';

  beforeEach(() => {
    service = new SeoCanonicalService();
  });

  it('R0_HOME → /', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R0_HOME',
        ids: {},
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/');
  });

  it('R1_GAMME_ROUTER avec pgAlias → /pieces/{pgAlias}', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R1_GAMME_ROUTER',
        ids: { pgAlias: 'plaquettes-de-frein' },
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/pieces/plaquettes-de-frein');
  });

  it('R1_GAMME_VEHICLE_ROUTER 4 alias → /pieces/.../...html', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        ids: {
          gammeAlias: 'filtre-a-huile',
          marqueAlias: 'peugeot',
          modeleAlias: '308',
          typeAlias: '1-6-hdi',
        },
        baseUrl,
      }),
    ).toBe(
      'https://www.automecanik.com/pieces/filtre-a-huile/peugeot/308/1-6-hdi.html',
    );
  });

  it('R7_BRAND_HUB → /constructeurs/{brand}.html', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R7_BRAND_HUB',
        ids: { brandAlias: 'bosch' },
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/constructeurs/bosch.html');
  });

  it('R8_VEHICLE → /constructeurs/{brand}/{model}/{type}', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R8_VEHICLE',
        ids: {
          brandAlias: 'renault',
          modeleAlias: 'clio-iv',
          typeAlias: '1-5-dci-90',
        },
        baseUrl,
      }),
    ).toBe(
      'https://www.automecanik.com/constructeurs/renault/clio-iv/1-5-dci-90',
    );
  });

  it('STATIC_PAGE strip leading slash', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'STATIC_PAGE',
        ids: { staticPath: '/qui-sommes-nous' },
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/qui-sommes-nous');
    expect(
      service.computeCanonical({
        surfaceKey: 'STATIC_PAGE',
        ids: { staticPath: 'mentions-legales' },
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/mentions-legales');
  });

  it('R2_PRODUCT → /produit/{ref}', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'R2_PRODUCT',
        ids: { pieceRef: 'BOS-0986424706' },
        baseUrl,
      }),
    ).toBe('https://www.automecanik.com/produit/BOS-0986424706');
  });

  it('BLOG_ADVICE → /blog-pieces-auto/conseils/{slug}', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'BLOG_ADVICE',
        ids: { blogSlug: 'changer-plaquettes-frein' },
        baseUrl,
      }),
    ).toBe(
      'https://www.automecanik.com/blog-pieces-auto/conseils/changer-plaquettes-frein',
    );
  });

  it('BLOG_ARTICLE → /blog-pieces-auto/article/{slug}', () => {
    expect(
      service.computeCanonical({
        surfaceKey: 'BLOG_ARTICLE',
        ids: { blogSlug: 'top-10-pieces' },
        baseUrl,
      }),
    ).toBe(
      'https://www.automecanik.com/blog-pieces-auto/article/top-10-pieces',
    );
  });

  it('throw SeoCanonicalError si id requis manque', () => {
    expect(() =>
      service.computeCanonical({
        surfaceKey: 'R8_VEHICLE',
        ids: { brandAlias: 'renault' }, // modeleAlias + typeAlias manquent
        baseUrl,
      }),
    ).toThrow(SeoCanonicalError);
    expect(() =>
      service.computeCanonical({
        surfaceKey: 'R1_GAMME_ROUTER',
        ids: {}, // pgAlias manque
        baseUrl,
      }),
    ).toThrow(/pgAlias requis/);
  });

  it('throw SeoCanonicalError pour surface non supportée en PR-2b', () => {
    expect(() =>
      service.computeCanonical({
        surfaceKey: 'R3_ADVICE',
        ids: {},
        baseUrl,
      }),
    ).toThrow(SeoCanonicalError);
    expect(() =>
      service.computeCanonical({
        surfaceKey: 'R6_BUYING_GUIDE',
        ids: {},
        baseUrl,
      }),
    ).toThrow(/non défini pour surface R6_BUYING_GUIDE/);
    expect(() =>
      service.computeCanonical({
        surfaceKey: 'UNAVAILABLE_410',
        ids: {},
        baseUrl,
      }),
    ).toThrow(SeoCanonicalError);
  });
});
