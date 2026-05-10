import { SeoInternalLinkingService } from '../seo-internal-linking.service';
import type { ResolveLinksBatchInput } from '../seo-internal-linking.service';

describe('SeoInternalLinkingService (PR-2c rev 2 — batch + reason codes)', () => {
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

  describe('buildAnchor + buildTargetUrl (pure)', () => {
    it('utilise pg_url_slug si présent', () => {
      const row = {
        pg_id: 42,
        pg_name: 'Plaquettes',
        pg_alias: 'plaquettes',
        pg_url_slug: 'plaquettes-de-frein',
      };
      expect(service.buildAnchor(row)).toBe(
        '<a href="/gammes/plaquettes-de-frein" class="link-gamme-internal">Plaquettes</a>',
      );
      expect(service.buildTargetUrl(row)).toBe('/gammes/plaquettes-de-frein');
    });

    it('fallback sur pg_alias si url_slug absent', () => {
      const row = {
        pg_id: 42,
        pg_name: 'Filtres',
        pg_alias: 'filtres',
        pg_url_slug: null,
      };
      expect(service.buildAnchor(row)).toBe(
        '<a href="/gammes/filtres" class="link-gamme-internal">Filtres</a>',
      );
      expect(service.buildTargetUrl(row)).toBe('/gammes/filtres');
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

  describe('buildCacheKey (canon Redis PR-7/PR-8)', () => {
    it("produit une clé stable indépendante de l'ordre des markers", () => {
      const k1 = service.buildCacheKey({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        sourceEntityId: 124,
        markers: ['#LinkGamme_42#', '#LinkGamme_5#'],
      });
      const k2 = service.buildCacheKey({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        sourceEntityId: 124,
        markers: ['#LinkGamme_5#', '#LinkGamme_42#'],
      });
      expect(k1).toBe(k2);
      expect(k1).toMatch(
        /^seo:v9:linking:R1_GAMME_VEHICLE_ROUTER:124:[a-f0-9]{16}$/,
      );
    });

    it('produit des clés distinctes pour des markers distincts', () => {
      const k1 = service.buildCacheKey({
        sourceSurfaceKey: 'R1_GAMME_ROUTER',
        sourceEntityId: 1,
        markers: ['#LinkGamme_42#'],
      });
      const k2 = service.buildCacheKey({
        sourceSurfaceKey: 'R1_GAMME_ROUTER',
        sourceEntityId: 1,
        markers: ['#LinkGamme_99#'],
      });
      expect(k1).not.toBe(k2);
    });

    it('namespace seo:v9:* respecté', () => {
      const k = service.buildCacheKey({
        sourceSurfaceKey: 'R0_HOME',
        markers: [],
      });
      expect(k.startsWith('seo:v9:linking:')).toBe(true);
    });
  });

  describe('resolveLinksBatch — reason codes + ordering', () => {
    function mockSupabase(rows: Array<Record<string, unknown>>) {
      return {
        from: () => ({
          select: () => ({
            in: async () => ({ data: rows, error: null }),
          }),
        }),
      };
    }

    function injectClient(s: SeoInternalLinkingService, client: unknown) {
      Object.defineProperty(s, 'supabase', {
        value: client,
        configurable: true,
      });
    }

    it('retourne tableau vide si markers vide', async () => {
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R0_HOME',
        markers: [],
      });
      expect(result).toEqual([]);
    });

    it("reason ORPHAN si marker n'est pas un #LinkGamme*#", async () => {
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R0_HOME',
        markers: ['#CompSwitch_3#', '#GarbageMarker#'],
      });
      expect(result).toHaveLength(2);
      for (const r of result) {
        expect(r.isLink).toBe(false);
        expect(r.reason).toBe('ORPHAN');
        expect(r.html).toBe('nos pièces auto');
        expect(r.targetRole).toBeNull();
        expect(r.indexable).toBe(false);
      }
    });

    it('reason NO_TARGET si pg_id absent en DB', async () => {
      injectClient(service, mockSupabase([]));
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        markers: ['#LinkGamme_999#'],
      });
      expect(result[0]!.reason).toBe('NO_TARGET');
      expect(result[0]!.isLink).toBe(false);
      expect(result[0]!.indexable).toBe(false);
      expect(result[0]!.targetUrl).toBeNull();
      expect(result[0]!.targetRole).toBe('R1_ROUTER');
    });

    it('reason NOINDEX si pg_display=false', async () => {
      injectClient(
        service,
        mockSupabase([
          {
            pg_id: 2,
            pg_name: 'Filtres',
            pg_alias: 'filtres',
            pg_url_slug: null,
            pg_display: false,
          },
        ]),
      );
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        markers: ['#LinkGamme_2#'],
      });
      expect(result[0]!.reason).toBe('NOINDEX');
      expect(result[0]!.isLink).toBe(false);
      expect(result[0]!.indexable).toBe(false);
      expect(result[0]!.targetUrl).toBe('/gammes/filtres');
    });

    it('reason SELF_LINK si sourceEntityId === pg_id cible', async () => {
      injectClient(
        service,
        mockSupabase([
          {
            pg_id: 42,
            pg_name: 'Plaquettes',
            pg_alias: 'plaquettes',
            pg_url_slug: null,
            pg_display: true,
          },
        ]),
      );
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R1_GAMME_ROUTER',
        sourceEntityId: 42,
        markers: ['#LinkGamme_42#'],
      });
      expect(result[0]!.reason).toBe('SELF_LINK');
      expect(result[0]!.isLink).toBe(false);
      // L'indexabilité de la cible reste true (la cible est valide,
      // c'est juste qu'on ne se link pas soi-même).
      expect(result[0]!.indexable).toBe(true);
      expect(result[0]!.targetUrl).toBe('/gammes/plaquettes');
    });

    it('lien indexable si pg_display=true et pas de self-link', async () => {
      injectClient(
        service,
        mockSupabase([
          {
            pg_id: 5,
            pg_name: 'Disques',
            pg_alias: 'disques',
            pg_url_slug: null,
            pg_display: true,
          },
        ]),
      );
      const result = await service.resolveLinksBatch({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        sourceEntityId: 124,
        markers: ['#LinkGamme_5#'],
      });
      expect(result[0]!.isLink).toBe(true);
      expect(result[0]!.reason).toBeUndefined();
      expect(result[0]!.html).toContain('<a href="/gammes/disques"');
      expect(result[0]!.targetUrl).toBe('/gammes/disques');
      expect(result[0]!.targetRole).toBe('R1_ROUTER');
      expect(result[0]!.indexable).toBe(true);
    });

    it("préserve l'ordre d'entrée (result[i].marker === markers[i])", async () => {
      injectClient(
        service,
        mockSupabase([
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
        ]),
      );
      const markers = [
        '#LinkGamme_99#', // NO_TARGET
        '#LinkGamme_2#', // NOINDEX
        '#LinkGamme_1#', // OK
        '#GarbageMarker#', // ORPHAN
      ];
      const input: ResolveLinksBatchInput = {
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        markers,
      };
      const result = await service.resolveLinksBatch(input);
      expect(result.map((r) => r.marker)).toEqual(markers);
      expect(result.map((r) => r.reason ?? null)).toEqual([
        'NO_TARGET',
        'NOINDEX',
        null,
        'ORPHAN',
      ]);
    });
  });

  describe('resolveMarkers (deprecated alias backward-compat)', () => {
    it('renvoie une Map de LinkResolutionResult, équivalente à resolveLinksBatch', async () => {
      Object.defineProperty(service, 'supabase', {
        value: {
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
                ],
                error: null,
              }),
            }),
          }),
        },
        configurable: true,
      });

      const map = await service.resolveMarkers({
        sourceSurfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        markers: ['#LinkGamme_1#'],
      });
      expect(map.get('#LinkGamme_1#')!.isLink).toBe(true);
      expect(map.get('#LinkGamme_1#')!.html).toContain('plaquettes');
    });
  });
});
