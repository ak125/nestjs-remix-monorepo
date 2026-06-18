import { canonicalizeGscPageKey } from './gsc-page-key';

/**
 * Tests du landmine #1 (CHECK-0) : la clé attribuée par l'opérateur DOIT matcher
 * le format `page` stocké par GSC (URL absolue), sinon la mesure renvoie un faux 0.
 */
describe('canonicalizeGscPageKey', () => {
  const SITE = 'https://www.automecanik.com';

  it('préfixe un chemin avec slash initial', () => {
    expect(
      canonicalizeGscPageKey(
        '/blog-pieces-auto/conseils/colonne-de-direction',
        SITE,
      ),
    ).toBe(
      'https://www.automecanik.com/blog-pieces-auto/conseils/colonne-de-direction',
    );
  });

  it('préfixe un chemin SANS slash initial', () => {
    expect(
      canonicalizeGscPageKey('blog-pieces-auto/conseils/capteur-abs', SITE),
    ).toBe('https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs');
  });

  it('laisse une URL déjà absolue inchangée (opérateur a collé l’URL GSC)', () => {
    const url =
      'https://www.automecanik.com/blog-pieces-auto/conseils/emetteur-d-embrayage';
    expect(canonicalizeGscPageKey(url, SITE)).toBe(url);
  });

  it('matche le format produit GSC pour une page produit (.html)', () => {
    expect(
      canonicalizeGscPageKey(
        '/pieces/compresseur-de-climatisation-447/peugeot-128/207-128018/1-6-hdi-33260.html',
        SITE,
      ),
    ).toBe(
      'https://www.automecanik.com/pieces/compresseur-de-climatisation-447/peugeot-128/207-128018/1-6-hdi-33260.html',
    );
  });

  it('retire un slash final parasite (chemin)', () => {
    expect(
      canonicalizeGscPageKey('/blog-pieces-auto/conseils/capteur-abs/', SITE),
    ).toBe('https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs');
  });

  it('retire un slash final parasite (URL absolue)', () => {
    expect(
      canonicalizeGscPageKey(
        'https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs/',
        SITE,
      ),
    ).toBe('https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs');
  });

  it('tolère un gscSiteUrl avec slash final (propriété URL-prefix)', () => {
    expect(canonicalizeGscPageKey('/x', 'https://www.automecanik.com/')).toBe(
      'https://www.automecanik.com/x',
    );
  });

  it('trim les espaces', () => {
    expect(canonicalizeGscPageKey('  /x  ', SITE)).toBe(
      'https://www.automecanik.com/x',
    );
  });

  it('est idempotente', () => {
    const once = canonicalizeGscPageKey('/blog/x', SITE);
    expect(canonicalizeGscPageKey(once, SITE)).toBe(once);
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(canonicalizeGscPageKey('', SITE)).toBe('');
  });
});
