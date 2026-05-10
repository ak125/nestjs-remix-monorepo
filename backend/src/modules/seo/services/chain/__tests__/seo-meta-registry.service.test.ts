import { SeoMetaRegistryService } from '../seo-meta-registry.service';

describe('SeoMetaRegistryService', () => {
  let service: SeoMetaRegistryService;

  beforeEach(() => {
    service = new SeoMetaRegistryService();
  });

  describe('mapRow', () => {
    it('mappe les colonnes mta_* legacy vers SeoMetaEntry', () => {
      const row = {
        mta_alias: 'cgv',
        mta_title: 'Conditions générales',
        mta_descrip: 'Description CGV',
        mta_keywords: 'cgv, conditions',
        mta_h1: 'CGV',
        mta_ariane: 'Accueil > CGV',
        mta_content: '<p>Contenu CGV</p>',
        mta_relfollow: '1',
      };
      const mapped = service.mapRow(row);
      expect(mapped).toEqual({
        alias: 'cgv',
        title: 'Conditions générales',
        description: 'Description CGV',
        keywords: 'cgv, conditions',
        h1: 'CGV',
        ariane: 'Accueil > CGV',
        content: '<p>Contenu CGV</p>',
        relfollow: '1',
      });
    });

    it('relfollow="0" préservé, default "1" si manquant', () => {
      expect(service.mapRow({ mta_relfollow: '0' }).relfollow).toBe('0');
      expect(service.mapRow({ mta_relfollow: 0 }).relfollow).toBe('0');
      expect(service.mapRow({}).relfollow).toBe('1');
      expect(service.mapRow({ mta_relfollow: null }).relfollow).toBe('1');
    });

    it('coerce null/undefined en string vide pour les champs textuels', () => {
      const mapped = service.mapRow({ mta_alias: 'x' });
      expect(mapped.title).toBe('');
      expect(mapped.description).toBe('');
      expect(mapped.keywords).toBe('');
    });
  });

  describe('cache', () => {
    it('getMeta utilise le cache mémoire au 2e appel sur la même clé', async () => {
      let dbCalls = 0;
      // Stub minimal du client supabase exposé par SupabaseBaseService.
      const fakeClient: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                dbCalls++;
                return {
                  data: {
                    mta_alias: 'home',
                    mta_title: 'Accueil',
                    mta_relfollow: '1',
                  },
                  error: null,
                };
              },
            }),
          }),
        }),
      };
      Object.defineProperty(service, 'supabase', {
        value: fakeClient,
        configurable: true,
      });

      const a = await service.getMeta('static', 'home');
      const b = await service.getMeta('static', 'home');
      expect(a?.title).toBe('Accueil');
      expect(b?.title).toBe('Accueil');
      expect(dbCalls).toBe(1);
    });

    it('invalidateCache force un re-fetch', async () => {
      let dbCalls = 0;
      const fakeClient: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                dbCalls++;
                return { data: { mta_alias: 'x' }, error: null };
              },
            }),
          }),
        }),
      };
      Object.defineProperty(service, 'supabase', {
        value: fakeClient,
        configurable: true,
      });

      await service.getMeta('static', 'x');
      service.invalidateCache();
      await service.getMeta('static', 'x');
      expect(dbCalls).toBe(2);
    });

    it('renvoie null si row absent', async () => {
      const fakeClient: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
      Object.defineProperty(service, 'supabase', {
        value: fakeClient,
        configurable: true,
      });

      expect(await service.getMeta('static', 'inconnu')).toBeNull();
    });

    it('renvoie null + log si erreur Supabase', async () => {
      const fakeClient: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: 'boom' },
              }),
            }),
          }),
        }),
      };
      Object.defineProperty(service, 'supabase', {
        value: fakeClient,
        configurable: true,
      });

      expect(await service.getMeta('blog', 'x')).toBeNull();
    });
  });
});
