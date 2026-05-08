import { SeoInternalLinkingService } from '../seo-internal-linking.service';

describe('SeoInternalLinkingService (stub PR-2c)', () => {
  let service: SeoInternalLinkingService;

  beforeEach(() => {
    service = new SeoInternalLinkingService();
  });

  describe('extractGammeIds (pure)', () => {
    it('extrait les ids depuis #LinkGamme_X# et #LinkGammeCar_X# (dédup + tri)', () => {
      const markers = [
        '#LinkGamme_42#',
        '#LinkGammeCar_5#',
        '#LinkGamme_42#',
        '#LinkGammeCar_99#',
      ];
      expect(service.extractGammeIds(markers)).toEqual([5, 42, 99]);
    });

    it('ignore les marqueurs non-link', () => {
      expect(
        service.extractGammeIds(['#CompSwitch_3#', '#FamilyContext#']),
      ).toEqual([]);
    });

    it('matche insensible à la casse', () => {
      expect(service.extractGammeIds(['#linkgamme_7#'])).toEqual([7]);
    });
  });

  describe('buildAnchor (pure)', () => {
    it('utilise pg_url_slug si présent', () => {
      expect(
        service.buildAnchor({
          pg_id: 42,
          pg_name: 'Plaquettes',
          pg_alias: 'plaquettes',
          pg_url_slug: 'plaquettes-de-frein',
        }),
      ).toBe(
        '<a href="/gammes/plaquettes-de-frein" class="link-gamme-internal">Plaquettes</a>',
      );
    });

    it('fallback sur pg_alias si url_slug absent', () => {
      expect(
        service.buildAnchor({
          pg_id: 42,
          pg_name: 'Filtres',
          pg_alias: 'filtres',
          pg_url_slug: null,
        }),
      ).toBe(
        '<a href="/gammes/filtres" class="link-gamme-internal">Filtres</a>',
      );
    });

    it('fallback sur pg_id si ni slug ni alias', () => {
      expect(
        service.buildAnchor({
          pg_id: 42,
          pg_name: 'Inconnu',
          pg_alias: null,
        }),
      ).toBe('<a href="/gammes/42" class="link-gamme-internal">Inconnu</a>');
    });
  });

  describe('resolveMarkers', () => {
    it('résout vers <a> si pg_display !== false, sinon fallback texte', async () => {
      const fakeClient: any = {
        from: () => ({
          select: () => ({
            in: async () => ({
              data: [
                {
                  pg_id: 1,
                  pg_name: 'Plaquettes',
                  pg_alias: 'plaquettes',
                  pg_url_slug: null,
                  pg_display: true,
                },
                {
                  pg_id: 2,
                  pg_name: 'Filtres',
                  pg_alias: 'filtres',
                  pg_url_slug: null,
                  pg_display: false,
                },
              ],
              error: null,
            }),
          }),
        }),
      };
      Object.defineProperty(service, 'supabase', {
        value: fakeClient,
        configurable: true,
      });

      const result = await service.resolveMarkers({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        markers: ['#LinkGamme_1#', '#LinkGamme_2#', '#LinkGamme_99#'],
      });

      expect(result.get('#LinkGamme_1#')!.isLink).toBe(true);
      expect(result.get('#LinkGamme_1#')!.html).toContain('plaquettes');
      // pg_display=false → fallback texte
      expect(result.get('#LinkGamme_2#')!.isLink).toBe(false);
      expect(result.get('#LinkGamme_2#')!.html).toBe('nos pièces auto');
      // id absent → fallback
      expect(result.get('#LinkGamme_99#')!.isLink).toBe(false);
    });

    it('renvoie une Map vide si pas de marqueurs', async () => {
      const result = await service.resolveMarkers({
        sourceSurfaceKey: 'R0_HOME',
        markers: [],
      });
      expect(result.size).toBe(0);
    });

    it('renvoie fallback pour tous si aucun id valide', async () => {
      const result = await service.resolveMarkers({
        sourceSurfaceKey: 'R0_HOME',
        markers: ['#CompSwitch_3#', '#GarbageMarker#'],
      });
      expect(result.get('#CompSwitch_3#')!.isLink).toBe(false);
      expect(result.get('#CompSwitch_3#')!.html).toBe('nos pièces auto');
    });
  });
});
