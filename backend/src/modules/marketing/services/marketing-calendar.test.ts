import { PublishQueueService } from './publish-queue.service';
import { WeeklyPlanGeneratorService } from './weekly-plan-generator.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { MarketingDataService } from './marketing-data.service';
import { UTMBuilderService } from './utm-builder.service';
import { SITE_ORIGIN } from '../../../config/app.config';

describe('marketing calendar and export', () => {
  it('does not replace an unavailable source with a generic stored plan', async () => {
    const sourceError = new Error('source unavailable');
    const hub = {
      getTopSeoGammes: jest.fn().mockRejectedValue(sourceError),
      getRecentGammeIds: jest.fn().mockResolvedValue([]),
      upsertWeeklyPlan: jest.fn().mockResolvedValue({}),
    };
    const coverage = {
      getContentCoverage: jest.fn().mockResolvedValue({ gaps: [] }),
    };
    const service = new WeeklyPlanGeneratorService(
      hub as unknown as MarketingHubDataService,
      coverage as unknown as MarketingDataService,
      new UTMBuilderService(),
    );
    await expect(service.generatePlan({ week_iso: '2026-W42' })).rejects.toBe(
      sourceError,
    );
    expect(hub.upsertWeeklyPlan).not.toHaveBeenCalled();
    expect(coverage.getContentCoverage).not.toHaveBeenCalled();
  });

  const cases = [
    ['2020-W53', 5, '2021-01-01'],
    ['2026-W01', 1, '2025-12-29'],
    ['2026-W13', 7, '2026-03-29'],
    ['2026-W43', 7, '2026-10-25'],
  ] as const;
  it.each(cases)(
    'exports ISO calendar date %s/%s as %s',
    async (week, day, date) => {
      const hub = {
        getApprovedPostsByChannel: jest.fn().mockResolvedValue([
          {
            id: 1,
            week_iso: week,
            channels_list: ['facebook'],
            content_revision: 1,
            review_version: 2,
            channel_reviews: {
              facebook: {
                state: 'approved',
                content_revision: 1,
                actor: '42',
                decided_at: '2026-10-14T00:00:00Z',
              },
            },
            day_of_week: day,
            channels: {
              facebook: {
                caption: 'Texte',
                hashtags: [],
                format: 'post',
                link_preview: true,
              },
            },
            source_url: `${SITE_ORIGIN}/pieces/frein?vehicle=42#conseils`,
            utm_source: 'facebook',
            utm_medium: 'social',
            utm_campaign: 'campagne test',
            utm_content: 'variant',
          },
        ]),
      };
      const manifest = await new PublishQueueService(
        hub as unknown as MarketingHubDataService,
        new UTMBuilderService(),
      ).exportManifest(week, 'facebook');
      expect(manifest.posts[0].scheduled_date).toBe(date);
      const url = new URL(manifest.posts[0].link);
      expect(url.searchParams.get('vehicle')).toBe('42');
      expect(url.searchParams.get('utm_campaign')).toBe('campagne test');
      expect(url.hash).toBe('#conseils');
    },
  );

  it.each(cases)(
    'plans ISO calendar date %s/%s as %s',
    async (week, day, date) => {
      const hub = {
        getRecentGammeIds: jest.fn().mockResolvedValue([]),
        upsertWeeklyPlan: jest.fn().mockImplementation(async (value) => value),
      };
      const service = new WeeklyPlanGeneratorService(
        hub as unknown as MarketingHubDataService,
        {} as MarketingDataService,
        new UTMBuilderService(),
      );
      const plan = await service.generatePlan({
        week_iso: week,
        priority_gammes: [
          {
            pg_id: 1,
            pg_alias: 'frein',
            pg_name: 'Freinage',
            reason: 'manual',
          },
        ],
        calendar_rules: {
          posting_days: [day],
          pillar_schedule: { [day]: 'conseil' },
          optimal_hours: { [day]: '12:00' },
          excluded_dates: [],
          max_posts_per_day: 1,
        },
      });
      expect(plan?.plan_json[0].date_iso).toBe(date);
    },
  );
});
