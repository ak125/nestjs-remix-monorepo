// backend/src/modules/rm/services/__tests__/rm-builder-seo-legacy-markers.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

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
  (service as any).fireShadowObservation = jest.fn();
  return { service, callRpc };
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
