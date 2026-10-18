import { WeeklyPlanGeneratorService } from './weekly-plan-generator.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { MarketingDataService } from './marketing-data.service';
import { buildGammeUrl } from '@common/utils/url-builder.utils';
import { SITE_ORIGIN } from '../../../config/app.config';
import type { WeeklyPlan } from '../interfaces/marketing-hub.interfaces';

describe('marketing civil dates and served destinations', () => {
  const gamme = {
    pg_id: 1,
    pg_alias: 'plaquette-de-frein',
    pg_name: 'Plaquettes',
    reason: 'manual' as const,
  };
  it.each([
    ['2020-W53', '2020-12-28'],
    ['2026-W13', '2026-03-23'],
    ['2026-W43', '2026-10-19'],
  ])(
    'builds the intended dates for %s without a local-to-UTC day shift',
    async (week_iso, monday) => {
      const hub = {
        getRecentGammeIds: jest.fn().mockResolvedValue([]),
        upsertWeeklyPlan: jest.fn(async (plan: Partial<WeeklyPlan>) => plan),
      };
      const service = new WeeklyPlanGeneratorService(
        hub as unknown as MarketingHubDataService,
        {} as MarketingDataService,
      );
      const plan = await service.generatePlan({
        week_iso,
        priority_gammes: [gamme],
      });
      expect(plan!.plan_json[0].date_iso).toBe(monday);
      expect(plan!.plan_json[0].brief.source_url).toBe(
        `${SITE_ORIGIN}${buildGammeUrl(gamme.pg_alias, gamme.pg_id)}`,
      );
    },
  );
});

describe('weekly planning dependency failures', () => {
  function setup() {
    const hub = {
      getTopSeoGammes: jest.fn().mockResolvedValue([]),
      getRecentGammeIds: jest.fn().mockResolvedValue([]),
      upsertWeeklyPlan: jest.fn(async (plan: Partial<WeeklyPlan>) => ({
        id: 17,
        ...plan,
      })),
    };
    const marketing = {
      getContentCoverage: jest.fn().mockResolvedValue({ gaps: [] }),
    };
    const service = new WeeklyPlanGeneratorService(
      hub as unknown as MarketingHubDataService,
      marketing as unknown as MarketingDataService,
    );
    return { hub, marketing, service };
  }
  it('stops on SEO failure before falling back or persisting', async () => {
    const { hub, marketing, service } = setup();
    const error = new Error('SEO outage');
    hub.getTopSeoGammes.mockRejectedValue(error);
    await expect(service.generatePlan({ week_iso: '2026-W43' })).rejects.toBe(
      error,
    );
    expect(marketing.getContentCoverage).not.toHaveBeenCalled();
    expect(hub.upsertWeeklyPlan).not.toHaveBeenCalled();
  });
  it('stops on a failed freshness lookup before falling back or persisting', async () => {
    const { hub, marketing, service } = setup();
    hub.getTopSeoGammes.mockResolvedValue([{ pg_id: 1 }]);
    const error = new Error('history outage');
    hub.getRecentGammeIds.mockRejectedValue(error);
    await expect(service.generatePlan({ week_iso: '2026-W43' })).rejects.toBe(
      error,
    );
    expect(marketing.getContentCoverage).not.toHaveBeenCalled();
    expect(hub.upsertWeeklyPlan).not.toHaveBeenCalled();
  });
  it('does not generate generic content after coverage fails', async () => {
    const { hub, marketing, service } = setup();
    const error = new Error('coverage outage');
    marketing.getContentCoverage.mockRejectedValue(error);
    await expect(service.generatePlan({ week_iso: '2026-W43' })).rejects.toBe(
      error,
    );
    expect(hub.upsertWeeklyPlan).not.toHaveBeenCalled();
  });
  it('keeps the generic fallback after successful empty reads', async () => {
    const { hub, marketing, service } = setup();
    const plan = await service.generatePlan({ week_iso: '2026-W43' });
    expect(marketing.getContentCoverage).toHaveBeenCalledTimes(1);
    expect(hub.upsertWeeklyPlan).toHaveBeenCalledTimes(1);
    expect(plan?.plan_json).toHaveLength(4);
    expect(plan?.plan_json.every((slot) => slot.brief.gamme_id === null)).toBe(
      true,
    );
  });
  it('propagates an unconfirmed plan write', async () => {
    const { hub, service } = setup();
    const error = new Error('write unconfirmed');
    hub.upsertWeeklyPlan.mockRejectedValue(error);
    await expect(service.generatePlan({ week_iso: '2026-W43' })).rejects.toBe(
      error,
    );
  });
});
