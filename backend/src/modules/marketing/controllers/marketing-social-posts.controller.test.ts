import { MarketingSocialPostsController } from './marketing-social-posts.controller';
import type { MarketingHubDataService } from '../services/marketing-hub-data.service';
import type { PublishQueueService } from '../services/publish-queue.service';
import type { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

const target = { channel: 'facebook', content_revision: 1, review_version: 0 };
const req = { user: { id: '42' } } as any;

describe('individual marketing brand gate', () => {
  function setup(post: unknown = { id: 7 }) {
    const hub = {
      getPostsByWeek: jest.fn().mockResolvedValue([]),
      getPostById: jest.fn().mockResolvedValue(post),
    };
    const gate = {
      evaluateAndPersist: jest.fn().mockResolvedValue({ can_approve: false }),
    };
    return {
      hub,
      gate,
      controller: new MarketingSocialPostsController(
        hub as unknown as MarketingHubDataService,
        {} as PublishQueueService,
        gate as unknown as BrandComplianceGateService,
      ),
    };
  }
  it('loads the requested ID without querying an empty week', async () => {
    const { controller, hub, gate } = setup();
    expect(await controller.runGate('7', target, req)).toEqual({
      data: { can_approve: false },
    });
    expect(hub.getPostById).toHaveBeenCalledWith(7);
    expect(hub.getPostsByWeek).not.toHaveBeenCalled();
    expect(gate.evaluateAndPersist).toHaveBeenCalledWith(
      { id: 7 },
      target,
      '42',
    );
  });
  it('returns not found and never runs a gate for an absent ID', async () => {
    const { controller, gate } = setup(null);
    await expect(controller.runGate('7', target, req)).rejects.toMatchObject({
      code: 'RESOURCE.NOT_FOUND',
    });
    expect(gate.evaluateAndPersist).not.toHaveBeenCalled();
  });
  it.each(['7junk', '0', '-1', '1.5', '9007199254740992'])(
    'rejects invalid ID %s before access',
    async (id) => {
      const { controller, hub } = setup();
      await expect(controller.runGate(id, target, req)).rejects.toMatchObject({
        code: 'VALIDATION.FAILED',
      });
      expect(hub.getPostById).not.toHaveBeenCalled();
      expect(hub.getPostsByWeek).not.toHaveBeenCalled();
    },
  );
});
