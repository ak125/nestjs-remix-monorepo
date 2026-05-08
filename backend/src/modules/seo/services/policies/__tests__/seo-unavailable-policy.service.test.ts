import { SeoUnavailablePolicy } from '../seo-unavailable-policy.service';

describe('SeoUnavailablePolicy', () => {
  let policy: SeoUnavailablePolicy;

  beforeEach(() => {
    policy = new SeoUnavailablePolicy();
  });

  it('410 par défaut + robots noindex,nofollow', () => {
    const r = policy.resolve({ url: '/pieces/dead' });
    expect(r.kind).toBe('410_GONE');
    expect(r.httpStatus).toBe(410);
    expect(r.robots).toBe('noindex,nofollow');
  });

  it('fallbackLinks contient toujours Accueil + Conseils', () => {
    const r = policy.resolve({ url: '/pieces/dead' });
    const labels = r.fallbackLinks.map((l) => l.label);
    expect(labels).toContain('Accueil');
    expect(labels).toContain('Conseils');
  });

  it('fallbackLinks contient marque si parentBrandAlias fourni', () => {
    const r = policy.resolve({
      url: '/constructeurs/bosch/dead/dead',
      parentBrandAlias: 'bosch',
    });
    const link = r.fallbackLinks.find((l) => l.label.startsWith('Catalogue '));
    expect(link).toBeDefined();
    expect(link!.href).toBe('/constructeurs/bosch.html');
  });

  it('contextualContent mappé selon legacyContextKey', () => {
    expect(
      policy.resolve({ url: '/x', legacyContextKey: 'mq' }).contextualContent,
    ).toMatch(/marque/i);
    expect(
      policy.resolve({ url: '/x', legacyContextKey: 'ty' }).contextualContent,
    ).toMatch(/motorisation/i);
    expect(
      policy.resolve({ url: '/x', legacyContextKey: 'p0' }).contextualContent,
    ).toMatch(/fiche produit/i);
    // Sans legacyContextKey → undefined
    expect(policy.resolve({ url: '/x' }).contextualContent).toBeUndefined();
  });
});
