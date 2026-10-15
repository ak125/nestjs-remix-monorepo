import { PublishQueueService } from './publish-queue.service';
import { MarketingSocialPostsController } from '../controllers/marketing-social-posts.controller';
import { UTMBuilderService } from './utm-builder.service';

const target = { channel: 'facebook', content_revision: 2, review_version: 3 };

describe('version-bound channel decisions', () => {
  function setup() {
    const hub = {
      updatePostStatus: jest.fn().mockResolvedValue(true),
      reviewSocialPost: jest.fn().mockResolvedValue({ id: 7 }),
      getApprovedPostsByChannel: jest.fn().mockResolvedValue([]),
    };
    const service = new PublishQueueService(
      hub as any,
      new UTMBuilderService(),
    );
    const controller = new MarketingSocialPostsController(
      hub as any,
      service,
      {} as any,
    );
    return { hub, service, controller };
  }

  it('refuses legacy approval with only an approver name', async () => {
    const { controller, hub } = setup();
    await expect(
      controller.approvePost(
        '7',
        { approved_by: 'forged' } as any,
        { user: { id: '42' } } as any,
      ),
    ).rejects.toThrow();
    expect(hub.updatePostStatus).not.toHaveBeenCalled();
  });

  it('binds a decision to the exact version and authenticated actor', async () => {
    const { controller, hub } = setup();
    await controller.approvePost(
      '7',
      target as any,
      { user: { id: '42' } } as any,
    );
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
      controller.approvePost('7', target as any, { user: {} } as any),
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
      controller.approvePost('7', body, { user: { id: '42' } } as any),
    ).rejects.toThrow();
    expect(hub.reviewSocialPost).not.toHaveBeenCalled();
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
