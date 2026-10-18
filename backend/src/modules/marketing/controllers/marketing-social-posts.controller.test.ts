import { IsAdminGuard } from '@auth/is-admin.guard';
import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
const target = { channel: 'facebook', content_revision: 1, review_version: 0 };
const req = { user: { id: '42' } } as unknown as Request;
import { MarketingSocialPostsController } from './marketing-social-posts.controller';
import type { MarketingHubDataService } from '../services/marketing-hub-data.service';
import type { PublishQueueService } from '../services/publish-queue.service';
import type { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

function setup(post: unknown = { id: 17 }) {
  const hub = {
    getPostById: jest.fn().mockResolvedValue(post),
    getPostsByWeek: jest.fn().mockResolvedValue([]),
  };
  const gate = {
    evaluateAndPersist: jest.fn().mockResolvedValue({ can_approve: true }),
  };
  const controller = new MarketingSocialPostsController(
    hub as unknown as MarketingHubDataService,
    {} as PublishQueueService,
    gate as unknown as BrandComplianceGateService,
  );
  return { controller, hub, gate };
}
describe('single-post gate selection', () => {
  it('evaluates the requested id, without a fictitious week query', async () => {
    const { controller, hub, gate } = setup();
    expect(await controller.runGate('17', target, req)).toEqual({
      data: { can_approve: true },
    });
    expect(hub.getPostById).toHaveBeenCalledWith(17);
    expect(hub.getPostsByWeek).not.toHaveBeenCalled();
    expect(gate.evaluateAndPersist).toHaveBeenCalledWith(
      { id: 17 },
      target,
      '42',
    );
  });
  it.each(['17x', '0', '-1', '9007199254740992'])(
    'rejects invalid id %s before reading',
    async (id) => {
      const { controller, hub } = setup();
      await expect(controller.runGate(id, target, req)).rejects.toThrow();
      expect(hub.getPostById).not.toHaveBeenCalled();
    },
  );
  it('does not evaluate an absent post', async () => {
    const { controller, gate } = setup(null);
    await expect(controller.runGate('17', target, req)).rejects.toThrow();
    expect(gate.evaluateAndPersist).not.toHaveBeenCalled();
  });
});

describe('administrative boundary', () => {
  it('keeps the native admin guard on the controller', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, MarketingSocialPostsController),
    ).toContain(IsAdminGuard);
  });
  it.each([undefined, { id: '42', level: 1 }])(
    'denies anonymous/customer session %p',
    (user) => {
      const context = {
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      expect(new IsAdminGuard().canActivate(context)).toBe(false);
    },
  );
});
