import { PublishQueueService } from './publish-queue.service';
import { UTMBuilderService } from './utm-builder.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { SocialPost } from '../interfaces/marketing-hub.interfaces';

const requestId = 'a2856df0-3baa-4a65-a87d-c6f83af9de21';
function setup() {
  const content = {
    caption: 'Texte approuvé',
    hashtags: [],
    format: 'post',
    link_preview: true,
  };
  const approval = {
    state: 'approved',
    content_revision: 2,
    actor: 'reviewer',
    decided_at: '2026-10-14T10:00:00Z',
  };
  const editorial = {
    week_iso: '2026-W42',
    day_of_week: 1,
    channels_list: ['facebook'],
    channels: { facebook: content },
    source_url: '/pieces/frein?vehicle=42#conseils',
    utm_campaign: 'freinage',
    utm_content: 'post-7',
  };
  const post = {
    ...JSON.parse(JSON.stringify(editorial)),
    id: 7,
    content_revision: 2,
    review_version: 3,
    status: 'approved',
    channel_reviews: { facebook: JSON.parse(JSON.stringify(approval)) },
  } as SocialPost;
  const preparation = {
    request_id: requestId,
    post_id: 7,
    channel: 'facebook',
    content_revision: 2,
    review_version: 3,
    account: { external_id: 'page-test', label: 'Compte fictif' },
    media: [
      {
        bucket: 'marketing-private',
        path: 'final/photo.png',
        sha256: 'a'.repeat(64),
        role: 'image',
      },
    ],
    actor: 'admin-42',
    created_at: '2026-10-14T10:01:00Z',
    approval_snapshot: approval,
    editorial_snapshot: editorial,
  };
  const hub = {
    getPublicationPreparation: jest.fn().mockResolvedValue(preparation),
    getPostById: jest.fn().mockResolvedValue(post),
    getApprovedPostsByChannel: jest.fn().mockResolvedValue([post]),
  };
  const service = new PublishQueueService(
    hub as unknown as MarketingHubDataService,
    new UTMBuilderService(),
  );
  return { hub, service, post, preparation };
}

describe('export of a selected durable preparation', () => {
  it('reuses the editorial manifest, binds only the selected account/media and never authorizes publication', async () => {
    const { service, hub, preparation } = setup();
    const output = await service.exportPreparation(7, requestId);
    expect(output).toMatchObject({
      schema_version: 1,
      purpose: 'bound_publication_preparation',
      export_id: `preparation:${requestId}`,
      preparation,
      publication: {
        ready: false,
        blockers: expect.arrayContaining([
          'account_authorization_unverified',
          'media_availability_and_rights_unverified',
          'publication_approval_missing',
        ]),
      },
    });
    const { publication: _publication, ...editorial } = (
      await service.exportManifest('2026-W42', 'facebook')
    ).posts[0];
    expect(output.editorial).toEqual(editorial);
    expect(output.editorial.link).toContain('vehicle=42');
    expect(output.editorial.link).toContain('utm_source=facebook');
    expect(output.editorial.link).toContain('#conseils');
    expect(hub.getPublicationPreparation).toHaveBeenCalledWith(7, requestId);
  });
  it('is stable on repeat export, including reordered stored JSON keys', async () => {
    const { service, preparation } = setup();
    const first = await service.exportPreparation(7, requestId);
    preparation.approval_snapshot = Object.fromEntries(
      Object.entries(preparation.approval_snapshot).reverse(),
    ) as typeof preparation.approval_snapshot;
    expect(await service.exportPreparation(7, requestId)).toEqual(first);
  });
  it('does not invalidate a preparation for an unrelated network decision', async () => {
    const { service, post } = setup();
    post.review_version += 1;
    expect(
      (await service.exportPreparation(7, requestId)).preparation
        .review_version,
    ).toBe(3);
  });
  it.each(['invalid', '../export', 'a2856df0-3baa-4a65-a87d-c6f83af9de21\r\n'])(
    'rejects invalid preparation ID before reading storage: %s',
    async (id) => {
      const { service, hub } = setup();
      await expect(service.exportPreparation(7, id)).rejects.toMatchObject({
        code: 'VALIDATION.FAILED',
      });
      expect(hub.getPublicationPreparation).not.toHaveBeenCalled();
    },
  );
  it.each(['getPublicationPreparation', 'getPostById'] as const)(
    'returns absence for missing %s',
    async (method) => {
      const { service, hub } = setup();
      hub[method].mockResolvedValue(null);
      await expect(
        service.exportPreparation(7, requestId),
      ).rejects.toMatchObject({ code: 'RESOURCE.NOT_FOUND' });
    },
  );
  it.each([
    [
      'new content',
      (p: SocialPost) => {
        p.content_revision = 3;
      },
    ],
    [
      'revoked review',
      (p: SocialPost) => {
        p.channel_reviews.facebook!.state = 'rejected';
      },
    ],
    [
      'reapproved content',
      (p: SocialPost) => {
        p.channel_reviews.facebook!.decided_at = '2026-10-14T11:00:00Z';
      },
    ],
    [
      'archived post',
      (p: SocialPost) => {
        p.status = 'archived';
      },
    ],
    [
      'published post',
      (p: SocialPost) => {
        p.status = 'published';
      },
    ],
    [
      'inconsistent source',
      (p: SocialPost) => {
        p.channels.facebook!.caption += ' changed without revision';
      },
    ],
    [
      'inconsistent URL',
      (p: SocialPost) => {
        p.source_url = '/other';
      },
    ],
  ] as const)(
    'refuses %s instead of exporting an obsolete binding',
    async (_name, change) => {
      const { service, post } = setup();
      change(post);
      await expect(
        service.exportPreparation(7, requestId),
      ).rejects.toMatchObject({ code: 'RESOURCE.CONFLICT' });
    },
  );
  it('does not fall back to a weekly export when storage is unavailable', async () => {
    const { service, hub } = setup();
    hub.getPublicationPreparation.mockRejectedValue(new Error('unavailable'));
    await expect(service.exportPreparation(7, requestId)).rejects.toThrow(
      'unavailable',
    );
    expect(hub.getApprovedPostsByChannel).not.toHaveBeenCalled();
  });
  it('refuses an incomplete stored snapshot instead of filling it from current content', async () => {
    const { service, preparation } = setup();
    Reflect.deleteProperty(preparation.editorial_snapshot, 'utm_campaign');
    await expect(service.exportPreparation(7, requestId)).rejects.toMatchObject(
      {
        code: 'VALIDATION.FAILED',
      },
    );
  });
});
