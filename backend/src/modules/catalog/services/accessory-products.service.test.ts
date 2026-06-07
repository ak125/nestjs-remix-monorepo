/**
 * AccessoryProductsService — R2 "Accessoires" block data layer (PR-2a).
 *
 * Pins: flag-gating (OFF = no query, no surface), the pg_parent_gamme_id lookup,
 * and the REUSE of the canonical R2 products primitive (UnifiedPageDataService.getPageData)
 * per accessory gamme — empty groups are dropped.
 */
import { AccessoryProductsService } from './accessory-products.service';
import type { UnifiedPageDataService } from './unified-page-data.service';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { ConfigService } from '@nestjs/config';

function makeSupabase(
  accGammes: unknown[] | null,
  error: { message: string } | null = null,
) {
  const inFn = jest.fn().mockResolvedValue({ data: accGammes, error });
  const eqFn = jest.fn().mockReturnValue({ in: inFn });
  const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
  const fromFn = jest.fn().mockReturnValue({ select: selectFn });
  return { client: { from: fromFn }, fromFn, selectFn, eqFn, inFn };
}

function makeService(opts: {
  flag: boolean;
  accGammes?: unknown[] | null;
  lookupError?: { message: string } | null;
  pageByPg?: Record<number, { pieces: unknown[]; minPrice: number }>;
}) {
  const config = {
    get: jest.fn().mockReturnValue('https://example.supabase.co'),
  } as unknown as ConfigService;
  const getPageData = jest.fn(async (_typeId: number, pgId: number) => {
    const p = opts.pageByPg?.[pgId];
    return { pieces: p?.pieces ?? [], minPrice: p?.minPrice ?? 0 } as Awaited<
      ReturnType<UnifiedPageDataService['getPageData']>
    >;
  });
  const unified = { getPageData } as unknown as UnifiedPageDataService;
  const flags = {
    accessoryBlocksOnR2Enabled: opts.flag,
  } as unknown as FeatureFlagsService;

  const svc = new AccessoryProductsService(config, unified, flags);
  const sb = makeSupabase(opts.accGammes ?? [], opts.lookupError ?? null);
  (svc as unknown as { supabase: unknown }).supabase = sb.client;
  return { svc, getPageData, sb };
}

describe('AccessoryProductsService', () => {
  it('flag OFF → empty, runs NO query (no surface)', async () => {
    const { svc, getPageData, sb } = makeService({ flag: false });

    const res = await svc.getForVehicle(82, 9045);

    expect(res).toEqual({
      enabled: false,
      mainPgId: 82,
      typeId: 9045,
      accessories: [],
    });
    expect(sb.fromFn).not.toHaveBeenCalled();
    expect(getPageData).not.toHaveBeenCalled();
  });

  it('flag ON, no linked accessories → enabled, empty', async () => {
    const { svc, getPageData } = makeService({ flag: true, accGammes: [] });

    const res = await svc.getForVehicle(82, 9045);

    expect(res).toEqual({
      enabled: true,
      mainPgId: 82,
      typeId: 9045,
      accessories: [],
    });
    expect(getPageData).not.toHaveBeenCalled();
  });

  it('flag ON → reuses getPageData per accessory; returns groups with products', async () => {
    const { svc, getPageData } = makeService({
      flag: true,
      accGammes: [
        {
          pg_id: 1330,
          pg_alias: 'deflecteur-disque-de-frein',
          pg_name: 'Déflecteur disque de frein',
        },
      ],
      pageByPg: { 1330: { pieces: [{ id: 1 }, { id: 2 }], minPrice: 12.5 } },
    });

    const res = await svc.getForVehicle(82, 9045);

    expect(getPageData).toHaveBeenCalledWith(9045, 1330);
    expect(res.enabled).toBe(true);
    expect(res.accessories).toHaveLength(1);
    expect(res.accessories[0]).toEqual({
      pgId: 1330,
      pgAlias: 'deflecteur-disque-de-frein',
      pgName: 'Déflecteur disque de frein',
      count: 2,
      minPrice: 12.5,
      products: [{ id: 1 }, { id: 2 }],
    });
  });

  it('flag ON → accessory with 0 compatible products is dropped', async () => {
    const { svc } = makeService({
      flag: true,
      accGammes: [{ pg_id: 1330, pg_alias: 'a', pg_name: 'A' }],
      pageByPg: { 1330: { pieces: [], minPrice: 0 } },
    });

    const res = await svc.getForVehicle(82, 9045);

    expect(res.enabled).toBe(true);
    expect(res.accessories).toHaveLength(0);
  });

  it('flag ON but a falsy mainPgId/typeId → enabled, empty (no query)', async () => {
    const { svc, getPageData } = makeService({ flag: true, accGammes: [] });

    const res = await svc.getForVehicle(0, 9045);

    expect(res).toEqual({
      enabled: true,
      mainPgId: 0,
      typeId: 9045,
      accessories: [],
    });
    expect(getPageData).not.toHaveBeenCalled();
  });
});
