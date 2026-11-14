/**
 * GammeUnifiedService.getGammeByAlias — une lecture en échec n'est pas une
 * gamme introuvable.
 *
 * La route R2 résout les URL sans ID par cet appel. Tant qu'une erreur de
 * lecture revenait en `null`, le contrôleur répondait 200 « non trouvée » et la
 * page était servie comme « absente du catalogue » pendant une panne.
 */
import { DatabaseException } from '@common/exceptions';
import { GammeUnifiedService } from './gamme-unified.service';

function makeService(result: { data: unknown; error: unknown }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const limit = jest.fn().mockReturnValue({ maybeSingle });
  const eqDisplay = jest.fn().mockReturnValue({ limit });
  const eqAlias = jest.fn().mockReturnValue({ eq: eqDisplay });
  const select = jest.fn().mockReturnValue({ eq: eqAlias });
  const from = jest.fn().mockReturnValue({ select });

  const svc = Object.create(
    GammeUnifiedService.prototype,
  ) as GammeUnifiedService;
  const internals = svc as unknown as { supabase: unknown; logger: unknown };
  internals.supabase = { from };
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { svc, eqAlias, eqDisplay };
}

describe('GammeUnifiedService.getGammeByAlias', () => {
  it('gamme trouvée → id, nom, alias', async () => {
    const { svc, eqAlias, eqDisplay } = makeService({
      data: {
        pg_id: 402,
        pg_name: 'Plaquette de frein',
        pg_alias: 'plaquette-de-frein',
      },
      error: null,
    });

    await expect(svc.getGammeByAlias('plaquette-de-frein')).resolves.toEqual({
      id: 402,
      name: 'Plaquette de frein',
      alias: 'plaquette-de-frein',
    });
    expect(eqAlias).toHaveBeenCalledWith('pg_alias', 'plaquette-de-frein');
    expect(eqDisplay).toHaveBeenCalledWith('pg_display', '1');
  });

  it('aucune ligne → null (alias réellement inconnu)', async () => {
    const { svc } = makeService({ data: null, error: null });

    await expect(svc.getGammeByAlias('alias-inconnu')).resolves.toBeNull();
  });

  it('lecture en échec → DatabaseException, jamais null', async () => {
    const { svc } = makeService({
      data: null,
      error: { message: 'TypeError: fetch failed' },
    });

    await expect(
      svc.getGammeByAlias('plaquette-de-frein'),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});
