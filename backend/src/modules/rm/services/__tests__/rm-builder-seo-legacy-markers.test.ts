// backend/src/modules/rm/services/__tests__/rm-builder-seo-legacy-markers.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { ServiceUnavailableException } from '@nestjs/common';
import { RmController } from '../../controllers/rm.controller';
import { SeoTemplateService } from '../../../catalog/services/seo-template.service';
import { RmBuilderService } from '../rm-builder.service';
import type { CacheService } from '@cache/cache.service';

/**
 * Branchement de #VMotorisation# / #VCodeMoteur# (2026-09-11).
 *
 * `rm_get_page_complete_v2` renvoie déjà `vehicleInfo.typeFuel` et
 * `vehicleInfo.motorCodesFormatted`. Le builder les transmet à
 * `SeoTemplateService` dans les champs dédiés aux marqueurs legacy — et
 * n'alimente PAS `fuel` / `motor_codes`, qui changeraient aussi h1/title.
 */
function buildService(processTemplates: jest.Mock) {
  const dummy = {} as never;
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    getGeneration: jest.fn().mockResolvedValue(1),
  };
  const service = new RmBuilderService(
    cache as unknown as CacheService,
    { processTemplates } as never, // SeoTemplateService
    dummy, // RpcGateService — callRpc est mocké
    dummy, // SeoShadowObservatory — fireShadowObservation est mocké
  );
  const callRpc = jest.fn();
  (service as any).callRpc = callRpc;
  (service as any).loadSeoCtxSwitches = jest.fn().mockResolvedValue({});
  const fireShadowObservation = jest.fn();
  (service as any).fireShadowObservation = fireShadowObservation;
  return { service, callRpc, cache, fireShadowObservation };
}

const seoRaw = {
  h1: '#Gamme# #VMarque#',
  title: 't',
  description: 'd',
  content: 'demotorisation #VMotorisation# pour codemoteur #VCodeMoteur#',
  preview: 'p',
};

function rpcData(vehicleInfo: Record<string, unknown> | null) {
  return {
    success: true,
    products: [{ id: 1 }],
    count: 1,
    minPrice: 10,
    grouped_pieces: [],
    vehicleInfo,
    gamme: { pg_name: 'Pompe à injection', pg_alias: 'pompe-a-injection' },
    seo: {},
    oemRefs: [],
    crossSelling: [],
    filters: { brands: [], qualities: [], sides: [], price_range: {} },
    validation: {},
    duration_ms: 0,
    seo_raw: seoRaw,
    seo_context: {
      type_id: '19354',
      pg_id: '1795',
      mf_id: '1',
      marque_name: 'Volkswagen',
      marque_alias: 'volkswagen',
      modele_name: 'Golf IV',
      modele_alias: 'golf-iv',
      type_name: '1.9 TDI',
      type_alias: '1-9-tdi',
      type_power_ps: '90',
    },
  };
}

const processedSeo = {
  success: true,
  h1: 'h',
  title: 't',
  description: 'd',
  content: 'c',
  preview: 'p',
  keywords: null,
};

describe('RmBuilderService.getPageCompleteV2 — valeurs des marqueurs legacy', () => {
  it('transmet carburant et codes moteur de vehicleInfo, sans alimenter fuel/motor_codes', async () => {
    const processTemplates = jest.fn().mockResolvedValue(processedSeo);
    const { service, callRpc } = buildService(processTemplates);
    callRpc.mockResolvedValue({
      data: rpcData({ typeFuel: 'Diesel', motorCodesFormatted: 'AJM, ATJ' }),
      error: null,
    });

    await service.getPageCompleteV2({ gamme_id: 1795, vehicle_id: 19354 });

    expect(processTemplates).toHaveBeenCalledTimes(1);
    const [templates, ctx] = processTemplates.mock.calls[0];
    expect(templates).toEqual(seoRaw);
    expect(ctx).toMatchObject({
      pg_id: 1795,
      type_id: 19354,
      legacy_marker_motorisation: 'Diesel',
      legacy_marker_code_moteur: 'AJM, ATJ',
    });
    expect(ctx.fuel).toBeUndefined();
    expect(ctx.motor_codes).toBeUndefined();
  });

  it('vehicleInfo absent ou valeurs nulles : champs non renseignés (le service rend du vide)', async () => {
    const processTemplates = jest.fn().mockResolvedValue(processedSeo);
    const { service, callRpc } = buildService(processTemplates);

    callRpc.mockResolvedValueOnce({ data: rpcData(null), error: null });
    await service.getPageCompleteV2({ gamme_id: 1795, vehicle_id: 19354 });

    callRpc.mockResolvedValueOnce({
      data: rpcData({ typeFuel: null, motorCodesFormatted: null }),
      error: null,
    });
    await service.getPageCompleteV2({ gamme_id: 1795, vehicle_id: 19355 });

    expect(processTemplates).toHaveBeenCalledTimes(2);
    for (const [, ctx] of processTemplates.mock.calls) {
      expect(ctx.legacy_marker_motorisation).toBeUndefined();
      expect(ctx.legacy_marker_code_moteur).toBeUndefined();
    }
  });
});

describe('RmBuilderService.getPageCompleteV2 — échec SEO sans contenu de repli', () => {
  const params = { gamme_id: 1795, vehicle_id: 19354 };

  it.each(['exception', 'success:false'])(
    '%s ne publie ni modèle brut ni résultat dégradé et ne remplit pas le cache RM',
    async (failure) => {
      const processTemplates =
        failure === 'exception'
          ? jest
              .fn()
              .mockRejectedValue(new Error('template dependency unavailable'))
          : jest.fn().mockResolvedValue({
              ...processedSeo,
              success: false,
              description: 'Texte de secours non validé',
            });
      const { service, callRpc, cache, fireShadowObservation } =
        buildService(processTemplates);
      callRpc.mockImplementation(async () => ({
        data: rpcData({}),
        error: null,
      }));

      const result = await service.getPageCompleteV2(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.cacheHit).toBe(false);
      expect(result.seo).toEqual({
        h1: '',
        title: '',
        description: '',
        content: '',
        preview: '',
      });
      expect(result).not.toHaveProperty('seo_raw');
      expect(result).not.toHaveProperty('seo_context');
      expect(cache.set).not.toHaveBeenCalled();
      expect(fireShadowObservation).not.toHaveBeenCalled();
    },
  );

  it.each(['exception', 'success:false'])(
    'le contrôleur traduit %s en 503, sans exposer les détails internes',
    async (failure) => {
      const processTemplates =
        failure === 'exception'
          ? jest
              .fn()
              .mockRejectedValue(new Error('private-template-dependency'))
          : jest.fn().mockResolvedValue({ ...processedSeo, success: false });
      const { service, callRpc } = buildService(processTemplates);
      callRpc.mockResolvedValue({ data: rpcData({}), error: null });
      const controller = new RmController(service, {} as never, {} as never);

      const error = await controller
        .getPageV2(params.gamme_id, params.vehicle_id, 200)
        .then(
          () => {
            throw new Error(
              'La préparation SEO invalide aurait dû répondre 503',
            );
          },
          (e: unknown) => e,
        );
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      const body = JSON.stringify(
        (error as ServiceUnavailableException).getResponse(),
      );
      expect(body).not.toMatch(
        /private-template-dependency|#Gamme#|seo_raw|Texte de secours/,
      );
    },
  );

  it('reprend le traitement après une panne sans figer le résultat dégradé en cache', async () => {
    const processTemplates = jest
      .fn()
      .mockResolvedValueOnce({ ...processedSeo, success: false })
      .mockResolvedValueOnce(processedSeo);
    const { service, callRpc, cache } = buildService(processTemplates);
    const entries = new Map<string, unknown>();
    cache.get.mockImplementation(async (key: string) => entries.get(key));
    cache.set.mockImplementation(async (key: string, value: unknown) => {
      entries.set(key, value);
    });
    callRpc.mockImplementation(async () => ({
      data: rpcData({}),
      error: null,
    }));

    const failed = await service.getPageCompleteV2(params);
    expect(failed.success).toBe(false);
    expect(entries.size).toBe(0);
    const recovered = await service.getPageCompleteV2(params);
    expect(recovered.success).toBe(true);
    expect(recovered.seo.description).toBe(processedSeo.description);
    expect(recovered.cacheHit).toBe(false);
    const cached = await service.getPageCompleteV2(params);
    expect(cached.cacheHit).toBe(true);
    expect(cached.seo).toEqual(recovered.seo);
    expect(processTemplates).toHaveBeenCalledTimes(2);
    expect(callRpc).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('respecte le vrai signal d’échec du moteur SEO lorsque son cache est indisponible', async () => {
    const templateCache = {
      get: jest.fn().mockRejectedValue(new Error('cache unavailable')),
      set: jest.fn(),
    };
    const templates = new SeoTemplateService(
      templateCache as unknown as CacheService,
      {} as never,
    );
    const { service, callRpc, cache } = buildService(
      jest.fn(templates.processTemplates.bind(templates)),
    );
    callRpc.mockResolvedValue({ data: rpcData({}), error: null });

    const result = await service.getPageCompleteV2(params);

    expect(result.success).toBe(false);
    expect(result.seo.description).toBe('');
    expect(cache.set).not.toHaveBeenCalled();
    expect(templateCache.get).toHaveBeenCalledTimes(1);
  });
});
