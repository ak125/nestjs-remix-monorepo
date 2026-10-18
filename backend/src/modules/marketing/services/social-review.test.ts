import { PublishQueueService } from './publish-queue.service';
import { MarketingSocialPostsController } from '../controllers/marketing-social-posts.controller';
import type { Request } from 'express';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { BrandComplianceGateService } from './brand-compliance-gate.service';
import { UTMBuilderService } from './utm-builder.service';

const target = { channel: 'facebook', content_revision: 2, review_version: 3 };

describe('version-bound channel decisions', () => {
  function setup() {
    const hub = {
      updatePostStatus: jest.fn().mockResolvedValue(true),
      reviewSocialPost: jest.fn().mockResolvedValue({ id: 7 }),
      declarePublication: jest.fn().mockResolvedValue({ id: 7 }),
      getApprovedPostsByChannel: jest.fn().mockResolvedValue([]),
    };
    const service = new PublishQueueService(
      hub as unknown as MarketingHubDataService,
      new UTMBuilderService(),
    );
    const controller = new MarketingSocialPostsController(
      hub as unknown as MarketingHubDataService,
      service,
      {} as BrandComplianceGateService,
    );
    return { hub, service, controller };
  }

  it('refuses legacy approval with only an approver name', async () => {
    const { controller, hub } = setup();
    await expect(
      controller.approvePost('7', { approved_by: 'forged' }, {
        user: { id: '42' },
      } as unknown as Request),
    ).rejects.toThrow();
    expect(hub.updatePostStatus).not.toHaveBeenCalled();
  });

  it('binds a decision to the exact version and authenticated actor', async () => {
    const { controller, hub } = setup();
    await controller.approvePost('7', target, {
      user: { id: '42' },
    } as unknown as Request);
    expect(hub.reviewSocialPost).toHaveBeenCalledWith(
      7,
      target,
      'approve',
      '42',
    );
    expect(hub.updatePostStatus).not.toHaveBeenCalled();
  });

  it('does not invent an actor for a session without an ID', async () => {
    const { controller, hub } = setup();
    await expect(
      controller.approvePost('7', target, { user: {} } as unknown as Request),
    ).rejects.toThrow();
    expect(hub.reviewSocialPost).not.toHaveBeenCalled();
  });

  it('blocks the old declaration of publication without evidence', async () => {
    const { service, hub } = setup();
    await expect(service.markAsPublished([7])).rejects.toThrow();
    expect(hub.updatePostStatus).not.toHaveBeenCalled();
  });

  it.each([
    { ...target, channel: 'tiktok' },
    { ...target, content_revision: 0 },
    { ...target, review_version: -1 },
    { ...target, approved_by: 'forged' },
  ])('rejects invalid target %p without persisting', async (body) => {
    const { controller, hub } = setup();
    await expect(
      controller.approvePost('7', body, {
        user: { id: '42' },
      } as unknown as Request),
    ).rejects.toThrow();
    expect(hub.reviewSocialPost).not.toHaveBeenCalled();
  });

  it('declares only the exact approval, with the session actor', async () => {
    const { controller, hub } = setup();
    const body = {
      ...target,
      approved_content_hash: 'a'.repeat(64),
      url: 'https://www.facebook.com/posts/123',
    };
    await controller.declarePublication('7', body, {
      user: { id: '42' },
    } as unknown as Request);
    expect(hub.declarePublication).toHaveBeenCalledWith(7, body, '42');
  });
  it.each([
    { url: 'http://example.test/p' },
    {
      url: Object.assign(new URL('https://example.test/p'), {
        username: 'synthetic-user',
        password: 'synthetic-fixture',
      }).toString(),
    },
    { url: 'https://bad host/p' },
    { approved_content_hash: 'bad' },
    { declared_by: 'forged' },
    { review_version: undefined },
  ])('refuses incomplete or forged publication %p', async (patch) => {
    const { controller, hub } = setup();
    await expect(
      controller.declarePublication(
        '7',
        {
          ...target,
          approved_content_hash: 'a'.repeat(64),
          url: 'https://example.test/p',
          ...patch,
        },
        { user: { id: '42' } } as unknown as Request,
      ),
    ).rejects.toThrow();
    expect(hub.declarePublication).not.toHaveBeenCalled();
  });

  it('exports only the current approval for the requested secondary channel', async () => {
    const { service, hub } = setup();
    const post = {
      id: 7,
      week_iso: '2026-W42',
      channels_list: ['instagram', 'facebook'],
      day_of_week: 1,
      primary_channel: 'instagram',
      status: 'gate_passed',
      content_revision: 2,
      review_version: 4,
      channels: {
        facebook: {
          caption: 'Validé',
          format: 'post',
          hashtags: [],
          link_preview: true,
        },
      },
      channel_reviews: {
        facebook: {
          state: 'approved',
          approved_content_hash: 'a'.repeat(64),
          content_revision: 2,
          actor: '42',
          decided_at: '2026-10-14T00:00:00Z',
        },
      },
    };
    hub.getApprovedPostsByChannel.mockResolvedValue([
      post,
      { ...post, id: 8, channel_reviews: {} },
      { ...post, id: 9, content_revision: 3 },
      { ...post, id: 10, status: 'published' },
      {
        ...post,
        id: 11,
        publications: { facebook: { url: 'https://example.test/p' } },
      },
      {
        ...post,
        id: 12,
        channel_reviews: {
          facebook: {
            ...post.channel_reviews.facebook,
            approved_content_hash: undefined,
          },
        },
      },
    ]);
    const result = await service.exportManifest('2026-W42', 'facebook');
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      post_id: 7,
      content_revision: 2,
      approval_scope: 'editorial',
      approval: { actor: '42' },
    });
  });
});
