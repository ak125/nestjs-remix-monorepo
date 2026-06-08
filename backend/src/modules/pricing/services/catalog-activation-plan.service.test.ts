import { BadRequestException } from '@nestjs/common';
import {
  CatalogActivationPlanService,
  type ActivationPlan,
} from './catalog-activation-plan.service';
import { PricingRepository } from './pricing.repository';

const samplePlan: ActivationPlan = {
  brand_pm_id: 730,
  sellable_priced: 21417,
  categories: {
    already_visible: 16373,
    display_gated: 285,
    accessory: 309,
    gamme_inactive: 407,
    orphan_with_oem: 2454,
    orphan_no_source: 2181,
  },
  orphan_no_source_by_gamme: [
    { pg_id: 82, pg_name: 'Disque de frein', pieces: 3 },
  ],
};

function makeService(planImpl?: jest.Mock) {
  const repo = {
    catalogActivationPlan:
      planImpl ?? jest.fn().mockResolvedValue(samplePlan),
  } as unknown as PricingRepository;
  return { service: new CatalogActivationPlanService(repo), repo };
}

describe('CatalogActivationPlanService', () => {
  it('returns the dry-run plan from the repository unchanged', async () => {
    const { service, repo } = makeService();
    const out = await service.plan(730);
    expect(out).toEqual(samplePlan);
    expect(repo.catalogActivationPlan).toHaveBeenCalledWith(730);
  });

  it.each([0, -1, 1.5, NaN])(
    'rejects non-positive-integer brandPmId (%p) without touching the repo',
    async (bad) => {
      const repoCall = jest.fn();
      const { service } = makeService(repoCall);
      await expect(service.plan(bad as number)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repoCall).not.toHaveBeenCalled();
    },
  );

  it('never mutates: the service only reads via the RPC-backed repo method', async () => {
    const repoCall = jest.fn().mockResolvedValue(samplePlan);
    const { service } = makeService(repoCall);
    await service.plan(730);
    // single read call, no commit/activate/display method exists on this service
    expect(repoCall).toHaveBeenCalledTimes(1);
    expect(
      (service as unknown as Record<string, unknown>).commit,
    ).toBeUndefined();
  });
});
