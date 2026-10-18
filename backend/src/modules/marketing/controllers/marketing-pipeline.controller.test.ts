import { DomainValidationException } from '@common/exceptions';
import { MarketingPipelineController } from './marketing-pipeline.controller';
import type { MarketingHubDataService } from '../services/marketing-hub-data.service';
import type { WeeklyPlanGeneratorService } from '../services/weekly-plan-generator.service';
import { MultiChannelCopywriterService } from '../services/multi-channel-copywriter.service';
import { UTMBuilderService } from '../services/utm-builder.service';
import type { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

function setup(generated = 1, errors = 0) {
  const hub = {
    getWeeklyPlan: jest.fn().mockResolvedValue({ plan_json: [] }),
    upsertWeeklyPlan: jest.fn().mockResolvedValue({ id: 1 }),
    getPostsByWeek: jest.fn().mockResolvedValue([]),
    resolveGammeAlias: jest.fn().mockResolvedValue(null),
  };
  const result = { generated, errors };
  const writer = { generateBatch: jest.fn().mockResolvedValue(result) };
  const planner = {
    generatePlan: jest.fn(async (opts: { week_iso: string }) => ({
      week_iso: opts.week_iso,
      status: 'draft',
      plan_json: [],
      priority_gammes: [],
    })),
  };
  const controller = new MarketingPipelineController(
    hub as unknown as MarketingHubDataService,
    planner as unknown as WeeklyPlanGeneratorService,
    writer as unknown as MultiChannelCopywriterService,
    {} as BrandComplianceGateService,
  );
  return { controller, hub, result, planner, writer };
}

describe('pipeline generation truth', () => {
  it.each([
    [0, 1],
    [1, 1],
    [0, 0],
  ])(
    'does not announce full success for %i generated and %i errors',
    async (generated, errors) => {
      const { controller, result } = setup(generated, errors);
      expect(await controller.generateCopy({ week_iso: '2026-W42' })).toEqual({
        success: false,
        data: result,
      });
    },
  );
  it('keeps a confirmed successful generation', async () => {
    const { controller, result } = setup();
    expect(await controller.generateCopy({ week_iso: '2026-W42' })).toEqual({
      success: true,
      data: result,
    });
  });
  it('refuses an unconfirmed plan write', async () => {
    const { controller, hub } = setup();
    hub.upsertWeeklyPlan.mockResolvedValue(null);
    await expect(
      controller.generateCopy({ week_iso: '2026-W42' }),
    ).rejects.toThrow();
  });
  it('simulates without even reading the remote plan', async () => {
    const fail = jest.fn(() => {
      throw new Error('business I/O forbidden');
    });
    const hub = {
      getWeeklyPlan: fail,
      upsertWeeklyPlan: fail,
    } as unknown as MarketingHubDataService;
    const writer = new MultiChannelCopywriterService(
      hub,
      new UTMBuilderService(),
    );
    const controller = new MarketingPipelineController(
      hub,
      {} as WeeklyPlanGeneratorService,
      writer,
      {} as BrandComplianceGateService,
    );
    expect(
      await controller.generateCopy({ week_iso: '2026-W42', dry_run: true }),
    ).toMatchObject({
      success: true,
      data: { mode: 'plan', generated: 0, attempted: 0, persisted: 0 },
    });
    expect(fail).not.toHaveBeenCalled();
  });
});

describe('pipeline inputs before business I/O', () => {
  const routes = [
    'generatePlan',
    'generateCopy',
    'gateAll',
    'getPlan',
    'getStatus',
  ] as const;
  it.each(routes)(
    '%s refuses impossible ISO weeks before I/O',
    async (route) => {
      for (const week of ['2026-W00', '2026-W54', '2021-W53']) {
        const { controller, hub, planner, writer } = setup();
        const action =
          route === 'getPlan' || route === 'getStatus'
            ? controller[route](week)
            : controller[route]({ week_iso: week });
        await expect(action).rejects.toBeInstanceOf(DomainValidationException);
        for (const mock of Object.values(hub))
          expect(mock).not.toHaveBeenCalled();
        expect(planner.generatePlan).not.toHaveBeenCalled();
        expect(writer.generateBatch).not.toHaveBeenCalled();
      }
    },
  );
  it.each(['true', 0, null])(
    'refuses dry_run=%j before reading or generating',
    async (dry_run) => {
      const { controller, hub, writer } = setup();
      await expect(
        controller.generateCopy({ week_iso: '2026-W42', dry_run }),
      ).rejects.toBeInstanceOf(DomainValidationException);
      expect(hub.getWeeklyPlan).not.toHaveBeenCalled();
      expect(writer.generateBatch).not.toHaveBeenCalled();
    },
  );
  it.each([null, [], 42].map((body) => [body]))(
    'returns a validation error for body %j',
    async (body) => {
      const { controller, hub, writer } = setup();
      await expect(controller.generateCopy(body)).rejects.toBeInstanceOf(
        DomainValidationException,
      );
      expect(hub.getWeeklyPlan).not.toHaveBeenCalled();
      expect(writer.generateBatch).not.toHaveBeenCalled();
    },
  );
  it.each(['plaquette-de-frein', [null], ['  ']].map((aliases) => [aliases]))(
    'rejects malformed alias selections %j',
    async (gamme_aliases) => {
      const { controller, hub, planner } = setup();
      await expect(
        controller.generatePlan({ week_iso: '2026-W42', gamme_aliases }),
      ).rejects.toBeInstanceOf(DomainValidationException);
      expect(hub.resolveGammeAlias).not.toHaveBeenCalled();
      expect(planner.generatePlan).not.toHaveBeenCalled();
    },
  );
  it('does not silently drop an unknown alias from an explicit selection', async () => {
    const { controller, hub, planner } = setup();
    hub.resolveGammeAlias.mockResolvedValueOnce({
      pg_id: 1,
      pg_alias: 'known',
    });
    await expect(
      controller.generatePlan({
        week_iso: '2026-W42',
        gamme_aliases: ['known', 'unknown'],
      }),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(planner.generatePlan).not.toHaveBeenCalled();
  });
  it('normalizes and deduplicates selected aliases while preserving order', async () => {
    const { controller, hub, planner } = setup();
    const gamme = {
      pg_id: 1,
      pg_alias: 'known',
      pg_name: 'Known',
      reason: 'manual',
    };
    hub.resolveGammeAlias.mockResolvedValue(gamme);
    await expect(
      controller.generatePlan({
        week_iso: '2020-W53',
        gamme_aliases: [' known ', 'known'],
      }),
    ).resolves.toMatchObject({ success: true });
    expect(hub.resolveGammeAlias).toHaveBeenCalledTimes(1);
    expect(hub.resolveGammeAlias).toHaveBeenCalledWith('known');
    expect(planner.generatePlan).toHaveBeenCalledWith({
      week_iso: '2020-W53',
      priority_gammes: [gamme],
    });
  });
  it('retains an explicit execution request with dry_run=false', async () => {
    const { controller, writer } = setup();
    await expect(
      controller.generateCopy({ week_iso: '2026-W42', dry_run: false }),
    ).resolves.toMatchObject({ success: true });
    expect(writer.generateBatch).toHaveBeenCalledWith([], '2026-W42', false);
  });
});
