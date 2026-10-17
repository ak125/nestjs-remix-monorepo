import { MarketingPipelineController } from './marketing-pipeline.controller';
import type { MarketingHubDataService } from '../services/marketing-hub-data.service';
import type { WeeklyPlanGeneratorService } from '../services/weekly-plan-generator.service';
import type { MultiChannelCopywriterService } from '../services/multi-channel-copywriter.service';
import type { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

function setup(generated: number, errors: number) {
  const hub = {
    getWeeklyPlan: jest.fn().mockResolvedValue({ plan_json: [] }),
    upsertWeeklyPlan: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const result = {
    generated,
    errors,
    attempted: 1,
    valid_variants: generated,
    persisted: generated,
    mode: 'generate',
    details: [],
  };
  const copywriter = { generateBatch: jest.fn().mockResolvedValue(result) };
  const controller = new MarketingPipelineController(
    hub as unknown as MarketingHubDataService,
    {} as WeeklyPlanGeneratorService,
    copywriter as unknown as MultiChannelCopywriterService,
    {} as BrandComplianceGateService,
  );
  return { controller, hub, result };
}

describe('marketing pipeline delivery response', () => {
  it.each([
    [0, 1],
    [1, 1],
    [0, 0],
  ])(
    'does not report full success for %i deliveries and %i errors',
    async (generated, errors) => {
      const { controller, result } = setup(generated, errors);
      expect(await controller.generateCopy({ week_iso: '2026-W42' })).toEqual({
        success: false,
        data: result,
      });
    },
  );

  it('keeps a positive persisted response', async () => {
    const { controller, result } = setup(1, 0);
    expect(await controller.generateCopy({ week_iso: '2026-W42' })).toEqual({
      success: true,
      data: result,
    });
  });

  it('rejects failure to persist plan progress', async () => {
    const { controller, hub } = setup(1, 0);
    hub.upsertWeeklyPlan.mockResolvedValue(null);
    await expect(
      controller.generateCopy({ week_iso: '2026-W42' }),
    ).rejects.toMatchObject({ code: 'RESOURCE.CONFLICT' });
  });
});
