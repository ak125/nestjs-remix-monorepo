import { Logger } from '@nestjs/common';
import { SeoLinkTrackingService } from './seo-link-tracking.service';

// Run the real cleanup method with an in-memory database boundary. Deliberately
// bypass the base constructor: this suite must never create a Supabase client.
describe('SEO cleanup job outcome', () => {
  it.each([
    [null, null, true],
    [{ message: 'click deletion refused' }, null, false],
    [null, { message: 'impression deletion refused' }, false],
    [
      { message: 'click deletion refused' },
      { message: 'impression deletion refused' },
      false,
    ],
  ])(
    'reports success only when both deletions succeed (%j, %j)',
    async (clickError, impressionError, success) => {
      const cutoff = jest
        .fn()
        .mockResolvedValueOnce({
          count: clickError ? null : 2,
          error: clickError,
        })
        .mockResolvedValueOnce({
          count: impressionError ? null : 3,
          error: impressionError,
        });
      const from = jest
        .fn()
        .mockReturnValue({ delete: jest.fn().mockReturnValue({ lt: cutoff }) });
      const service: SeoLinkTrackingService = Object.assign(
        Object.create(SeoLinkTrackingService.prototype),
        {
          supabase: { from },
          logger: new Logger('SeoCleanupTest'),
        },
      );
      const result = await service.cleanupOldData(90);
      expect(result).toEqual({
        success,
        deletedClicks: clickError ? 0 : 2,
        deletedImpressions: impressionError ? 0 : 3,
      });
      expect(from.mock.calls).toEqual([
        ['seo_link_clicks'],
        ['seo_link_impressions'],
      ]);
    },
  );
});
