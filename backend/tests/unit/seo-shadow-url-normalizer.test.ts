/**
 * SeoShadowUrlNormalizer — normalisation canonical (RFC 3986 + lowercase host).
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-url-normalizer.service.ts
 */
import { SeoShadowUrlNormalizer } from '../../src/modules/seo-shadow-observatory/seo-shadow-url-normalizer.service';

describe('SeoShadowUrlNormalizer', () => {
  let n: SeoShadowUrlNormalizer;
  beforeEach(() => {
    n = new SeoShadowUrlNormalizer();
  });

  describe('normalize()', () => {
    it('null/undefined/empty → null', () => {
      expect(n.normalize(null)).toBeNull();
      expect(n.normalize(undefined)).toBeNull();
      expect(n.normalize('')).toBeNull();
    });

    it('drop trailing slash sauf root', () => {
      expect(n.normalize('https://www.automecanik.com/foo/')).toBe(
        'https://www.automecanik.com/foo',
      );
      expect(n.normalize('https://www.automecanik.com/')).toBe(
        'https://www.automecanik.com/',
      );
    });

    it('lowercase pathname', () => {
      expect(n.normalize('https://www.automecanik.com/Constructeurs/BMW.html'))
        .toBe('https://www.automecanik.com/constructeurs/bmw.html');
    });

    it('décode URI', () => {
      expect(n.normalize('https://www.automecanik.com/foo%20bar')).toBe(
        'https://www.automecanik.com/foo bar',
      );
    });

    it('drop fragment et query', () => {
      expect(n.normalize('https://www.automecanik.com/x?a=1&b=2#frag')).toBe(
        'https://www.automecanik.com/x',
      );
    });

    it('force hostname canonique', () => {
      expect(n.normalize('https://staging.automecanik.com/x')).toBe(
        'https://www.automecanik.com/x',
      );
    });

    it('force protocol https', () => {
      expect(n.normalize('http://www.automecanik.com/x')).toBe(
        'https://www.automecanik.com/x',
      );
    });

    it('idempotence sur sortie déjà normalisée', () => {
      const url = 'https://www.automecanik.com/constructeurs/bmw.html';
      expect(n.normalize(n.normalize(url))).toBe(url);
    });

    it('path-only relative → ancré sur base canonique', () => {
      expect(n.normalize('/foo/bar')).toBe('https://www.automecanik.com/foo/bar');
    });
  });

  describe('reconstructLegacy()', () => {
    it('utilise rpcCanonical si présent', () => {
      expect(
        n.reconstructLegacy(
          'https://www.automecanik.com/x/',
          '/should-be-ignored',
        ),
      ).toBe('https://www.automecanik.com/x');
    });

    it('fallback sur requestUrl si rpcCanonical null', () => {
      expect(
        n.reconstructLegacy(null, 'https://www.automecanik.com/Constructeurs/Bmw.html'),
      ).toBe('https://www.automecanik.com/constructeurs/bmw.html');
    });

    it('fallback sur requestUrl si rpcCanonical vide', () => {
      expect(n.reconstructLegacy('', '/constructeurs/bmw.html')).toBe(
        'https://www.automecanik.com/constructeurs/bmw.html',
      );
    });
  });
});
