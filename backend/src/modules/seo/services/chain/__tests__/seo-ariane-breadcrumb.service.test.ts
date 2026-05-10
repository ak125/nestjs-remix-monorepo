import {
  SeoArianeBreadcrumbService,
  SeoBreadcrumbError,
} from '../seo-ariane-breadcrumb.service';

describe('SeoArianeBreadcrumbService', () => {
  let service: SeoArianeBreadcrumbService;

  beforeEach(() => {
    service = new SeoArianeBreadcrumbService();
  });

  const validInput = {
    surfaceKey: 'R8_VEHICLE' as const,
    items: [
      { name: 'Accueil', url: 'https://www.automecanik.com/' },
      {
        name: 'Constructeurs',
        url: 'https://www.automecanik.com/constructeurs',
      },
      {
        name: 'Renault',
        url: 'https://www.automecanik.com/constructeurs/renault.html',
      },
      {
        name: 'Clio IV',
        url: 'https://www.automecanik.com/constructeurs/renault/clio-iv',
      },
    ],
  };

  describe('buildJsonLd', () => {
    it('produit un BreadcrumbList Schema.org valide', () => {
      const jsonLd = service.buildJsonLd(validInput);

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('BreadcrumbList');
      expect(jsonLd.itemListElement).toHaveLength(4);

      // Position 1-indexed
      expect(jsonLd.itemListElement[0]).toEqual({
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: 'https://www.automecanik.com/',
      });
      expect(jsonLd.itemListElement[3].position).toBe(4);
      expect(jsonLd.itemListElement[3].name).toBe('Clio IV');
    });

    it('preserve l’ordre des items (du général au spécifique)', () => {
      const jsonLd = service.buildJsonLd(validInput);
      expect(jsonLd.itemListElement.map((i) => i.name)).toEqual([
        'Accueil',
        'Constructeurs',
        'Renault',
        'Clio IV',
      ]);
    });

    it('throw SeoBreadcrumbError si items vide', () => {
      expect(() =>
        service.buildJsonLd({ surfaceKey: 'R0_HOME', items: [] }),
      ).toThrow(SeoBreadcrumbError);
    });

    it('throw si une URL n’est pas absolue HTTPS', () => {
      expect(() =>
        service.buildJsonLd({
          surfaceKey: 'R0_HOME',
          items: [{ name: 'Accueil', url: 'http://example.com/' }],
        }),
      ).toThrow(/HTTPS/);
      expect(() =>
        service.buildJsonLd({
          surfaceKey: 'R0_HOME',
          items: [{ name: 'Accueil', url: '/relative' }],
        }),
      ).toThrow(/HTTPS/);
    });

    it('throw si un name est vide', () => {
      expect(() =>
        service.buildJsonLd({
          surfaceKey: 'R0_HOME',
          items: [{ name: '   ', url: 'https://www.automecanik.com/' }],
        }),
      ).toThrow(/name vide/);
    });
  });

  describe('buildTextTrail', () => {
    it('joint les noms avec " > " (compat legacy mta_ariane)', () => {
      expect(service.buildTextTrail(validInput)).toBe(
        'Accueil > Constructeurs > Renault > Clio IV',
      );
    });

    it('item unique : pas de séparateur', () => {
      expect(
        service.buildTextTrail({
          surfaceKey: 'R0_HOME',
          items: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
        }),
      ).toBe('Accueil');
    });
  });
});
