import { DiagnosticService } from './diagnostic.service';

/**
 * FH-6 du dossier filtre à huile : la carte R4 « Symptômes associés » liait
 * `/diagnostic-auto/<texte libre>` (404). Seul un slug de diagnostic publié
 * peut devenir un lien.
 */
function makeService(result: { data: unknown; error: unknown }) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
  };
  const service = Object.create(
    DiagnosticService.prototype,
  ) as DiagnosticService;
  Object.defineProperty(service, 'supabase', { value: chain, writable: false });
  return { service, chain };
}

describe('DiagnosticService.filterPublishedSlugs', () => {
  it('ne garde que les slugs publiés, dans l’ordre reçu', async () => {
    const { service, chain } = makeService({
      data: [{ slug: 'voyant-huile-allume' }, { slug: 'bruit-filtre-a-huile' }],
      error: null,
    });

    const out = await service.filterPublishedSlugs([
      'bruit-filtre-a-huile',
      'Voyant huile qui s allume ou clignote',
      'voyant-huile-allume',
    ]);

    expect(out).toEqual(['bruit-filtre-a-huile', 'voyant-huile-allume']);
    expect(chain.from).toHaveBeenCalledWith('__seo_observable');
    expect(chain.eq).toHaveBeenCalledWith('is_published', true);
  });

  it('écarte les valeurs vides et les doublons sans interroger la base pour rien', async () => {
    const { service, chain } = makeService({ data: [], error: null });

    expect(
      await service.filterPublishedSlugs(['', '  ', null, undefined]),
    ).toEqual([]);
    expect(chain.from).not.toHaveBeenCalled();

    await service.filterPublishedSlugs(['a', 'a', '']);
    expect(chain.in).toHaveBeenCalledWith('slug', ['a']);
  });

  it('lève une erreur si la lecture échoue, au lieu de rendre une liste vide', async () => {
    const { service } = makeService({
      data: null,
      error: { message: 'timeout' },
    });

    await expect(service.filterPublishedSlugs(['a'])).rejects.toThrow(
      'timeout',
    );
  });
});
