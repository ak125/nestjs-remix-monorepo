import { Logger } from '@nestjs/common';
import { SeoLinkTrackingService } from './seo-link-tracking.service';

/**
 * `cleanupOldData` used to answer `success: true` even when Supabase refused
 * one of the two deletes: the scheduled purge then looked healthy while raw
 * data kept growing. A refused delete must surface as `success: false`.
 */
describe('SeoLinkTrackingService.cleanupOldData — honest status', () => {
  type DeleteResult = {
    count: number | null;
    error: { message: string } | null;
  };

  /** Service with a stubbed Supabase client: one delete result per table. */
  function serviceWith(results: Record<string, DeleteResult>) {
    const lt = jest.fn();
    const from = jest.fn((table: string) => ({
      delete: () => ({
        lt: (column: string, cutoff: string) => {
          lt(table, column, cutoff);
          return Promise.resolve(results[table]);
        },
      }),
    }));
    // Bypass the constructor (it builds a real client from the environment).
    const service = Object.create(
      SeoLinkTrackingService.prototype,
    ) as SeoLinkTrackingService;
    Object.assign(service, {
      supabase: { from },
      logger: new Logger('test'),
    });
    return { service, lt };
  }

  const ok = (count: number): DeleteResult => ({ count, error: null });
  const refused: DeleteResult = { count: null, error: { message: 'denied' } };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports success and the counts when both deletes succeed', async () => {
    const { service, lt } = serviceWith({
      seo_link_clicks: ok(3),
      seo_link_impressions: ok(5),
    });
    await expect(service.cleanupOldData(30)).resolves.toEqual({
      success: true,
      deletedClicks: 3,
      deletedImpressions: 5,
    });
    expect(lt).toHaveBeenCalledWith(
      'seo_link_clicks',
      'clicked_at',
      expect.any(String),
    );
    expect(lt).toHaveBeenCalledWith(
      'seo_link_impressions',
      'viewed_at',
      expect.any(String),
    );
  });

  it('reports failure when the click delete is refused', async () => {
    const { service } = serviceWith({
      seo_link_clicks: refused,
      seo_link_impressions: ok(5),
    });
    await expect(service.cleanupOldData(30)).resolves.toEqual({
      success: false,
      deletedClicks: 0,
      deletedImpressions: 5,
    });
  });

  it('reports failure when the impression delete is refused', async () => {
    const { service } = serviceWith({
      seo_link_clicks: ok(3),
      seo_link_impressions: refused,
    });
    await expect(service.cleanupOldData(30)).resolves.toEqual({
      success: false,
      deletedClicks: 3,
      deletedImpressions: 0,
    });
  });

  it('keeps the 90-day default when no retention is given', async () => {
    const { service, lt } = serviceWith({
      seo_link_clicks: ok(0),
      seo_link_impressions: ok(0),
    });
    const before = Date.now();
    await service.cleanupOldData();
    const cutoff = Date.parse(lt.mock.calls[0][2]);
    const days = (before - cutoff) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
  });
});
