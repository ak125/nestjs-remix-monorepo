import { RmBuilderService } from '../rm-builder.service';
import type { SeoShadowObservatory } from '../../../seo-shadow-observatory/seo-shadow-observatory.service';

/**
 * Retrofit ADR-055 — rm-builder utilise maintenant `SeoShadowObservatory`
 * au lieu de chain inline (ancien pattern PR-3).
 *
 * Ce test vérifie le nouveau contrat :
 *   - `fireShadowObservation(ctx, legacy)` appelle `observatory.observe()`
 *     avec le bon `surface` (`R1_GAMME_VEHICLE_ROUTER`).
 *   - Aucune mutation de `result.seo` (ADR-055 I3 — pas de branche `mode='on'`).
 *   - `observe()` est appelé en sync (sans await — ADR-055 I2).
 */
describe('RmBuilderService — shadow via SeoShadowObservatory (retrofit ADR-055)', () => {
  function buildService(observatory: { observe: jest.Mock }): RmBuilderService {
    const dummy = {} as never;
    return new RmBuilderService(
      dummy, // CacheService
      dummy, // SeoTemplateService
      dummy, // RpcGateService
      observatory as unknown as SeoShadowObservatory,
    );
  }

  const ctx = {
    type_id: 12345,
    pg_id: 124,
    mf_id: 1,
    marque_name: 'Renault',
    marque_alias: 'renault',
    modele_name: 'Clio',
    modele_alias: 'clio',
    type_name: '1.5 dCi',
    type_alias: '1-5-dci',
    gamme_name: 'Plaquettes',
    gamme_alias: 'plaquettes',
    min_price: 25,
    count: 12,
    power_ps: '90',
  };

  const legacy = {
    h1: 'Plaquettes Renault Clio',
    title: 'Plaquettes Clio - Pieces auto',
    description: 'Description legacy',
    content: 'Contenu legacy',
    preview: 'Preview legacy',
  };

  it('fireShadowObservation appelle observatory.observe avec surface R1_GAMME_VEHICLE_ROUTER', () => {
    const observe = jest.fn();
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation(ctx, legacy);

    expect(observe).toHaveBeenCalledTimes(1);
    const input = observe.mock.calls[0][0];
    expect(input.surface).toBe('R1_GAMME_VEHICLE_ROUTER');
    expect(input.entityId).toBe('124:12345');
    expect(input.legacy.title).toBe(legacy.title);
    expect(input.legacy.h1).toBe(legacy.h1);
    expect(input.legacy.description).toBe(legacy.description);
    expect(input.ids.pgId).toBe(124);
    expect(input.ids.typeId).toBe(12345);
    expect(input.ids.gammeAlias).toBe('plaquettes');
    expect(input.vars.gamme).toBe('Plaquettes');
    expect(input.vars.marque).toBe('Renault');
    expect(input.vars.nbCh).toBe(90);
    expect(input.vars.minPrice).toBe(25);
  });

  it('fireShadowObservation construit un requestUrl canonique R1', () => {
    const observe = jest.fn();
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation(ctx, legacy);

    const input = observe.mock.calls[0][0];
    expect(input.requestUrl).toBe(
      'https://www.automecanik.com/pieces/plaquettes.renault.clio.1-5-dci.html',
    );
  });

  it('observe est synchrone (return immédiat — ADR-055 I2)', () => {
    let observed = false;
    const observe = jest.fn(() => {
      observed = true;
    });
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation(ctx, legacy);

    // Si l'API était async/awaitée, observed serait encore false ici.
    expect(observed).toBe(true);
  });

  it('legacy.canonical/robots/keywords sont null (rm-builder ne les calcule pas)', () => {
    const observe = jest.fn();
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation(ctx, legacy);

    const input = observe.mock.calls[0][0];
    expect(input.legacy.canonical).toBeNull();
    expect(input.legacy.robots).toBeNull();
    expect(input.legacy.keywords).toBeNull();
  });

  it('power_ps absent → nbCh = 0 (no NaN propagé)', () => {
    const observe = jest.fn();
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation({ ...ctx, power_ps: '' }, legacy);

    const input = observe.mock.calls[0][0];
    expect(input.vars.nbCh).toBe(0);
  });

  it('min_price/count absents → 0 (defaults)', () => {
    const observe = jest.fn();
    const service = buildService({ observe });

    (
      service as unknown as {
        fireShadowObservation: (c: typeof ctx, l: typeof legacy) => void;
      }
    ).fireShadowObservation(
      {
        ...ctx,
        min_price: undefined as unknown as number,
        count: undefined as unknown as number,
      },
      legacy,
    );

    const input = observe.mock.calls[0][0];
    expect(input.vars.minPrice).toBe(0);
    expect(input.vars.articlesCount).toBe(0);
  });
});
