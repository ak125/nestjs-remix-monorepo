import { PublishQueueService } from './publish-queue.service';
import { UTMBuilderService } from './utm-builder.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type {
  SocialChannel,
  SocialPost,
} from '../interfaces/marketing-hub.interfaces';

function fixture(channel: SocialChannel = 'instagram'): SocialPost {
  return {
    id: 7,
    content_revision: 2,
    review_version: 4,
    week_iso: '2026-W42',
    day_of_week: 1,
    status: 'approved',
    channels_list: [channel],
    primary_channel: channel,
    channels: {
      instagram: {
        caption: 'Texte validé',
        hashtags: ['#freinage'],
        format: 'post',
        dimensions: '1080x1350',
        alt_text: 'Plaquettes comparées',
        visual_brief: 'Comparaison',
      },
      facebook: {
        caption: 'Texte validé',
        hashtags: [],
        format: 'post',
        link_preview: true,
      },
      youtube: {
        title: 'Plaquettes',
        description: 'Choisir les bonnes plaquettes',
        tags: ['freinage'],
        format: 'short',
        hook_script: 'Même voiture...',
        thumbnail_brief: 'Deux plaquettes',
      },
    },
    channel_reviews: {
      [channel]: {
        state: 'approved',
        content_revision: 2,
        actor: '42',
        decided_at: '2026-10-14T00:00:00Z',
      },
    },
    source_url: '/pieces/frein?vehicle=42#conseils',
    utm_campaign: 'freinage',
    utm_content: 'existing_variant',
  } as SocialPost;
}

function setup(post = fixture()) {
  const hub = {
    getApprovedPostsByChannel: jest.fn().mockResolvedValue([post]),
  };
  return {
    hub,
    service: new PublishQueueService(
      hub as unknown as MarketingHubDataService,
      new UTMBuilderService(),
    ),
  };
}

describe('editorial export preparation', () => {
  it.each(['instagram', 'facebook', 'youtube'] as const)(
    'preserves the complete %s variant and explicitly blocks publication',
    async (channel) => {
      const post = fixture(channel);
      const { service } = setup(post);
      const result = await service.exportManifest('2026-W42', channel);
      expect(result).toMatchObject({
        schema_version: 2,
        purpose: 'editorial_preparation',
      });
      expect(result.posts[0]).toMatchObject({
        export_id: `social:7:r2:${channel}`,
        channel_content: post.channels[channel],
        publication: {
          ready: false,
          account: null,
          approval: null,
          blockers: expect.arrayContaining([
            'account_not_bound',
            'publication_approval_missing',
          ]),
        },
      });
      if (channel !== 'facebook')
        expect(result.posts[0].publication.blockers).toContain(
          'final_media_not_bound',
        );
      expect(result.posts[0].content_sha256).toMatch(/^[a-f0-9]{64}$/);
    },
  );

  it('keeps identity and checksum stable on re-export and object key reordering', async () => {
    const post = fixture();
    const { service } = setup(post);
    const first = (await service.exportManifest('2026-W42', 'instagram'))
      .posts[0];
    post.review_version += 1; // Decision on a different channel, not an editorial edit.
    post.channels.instagram = Object.fromEntries(
      Object.entries(post.channels.instagram!).reverse(),
    ) as typeof post.channels.instagram;
    const second = (await service.exportManifest('2026-W42', 'instagram'))
      .posts[0];
    expect(first.export_id).toBeDefined();
    expect(second.export_id).toBe(first.export_id);
    expect(first.content_sha256).toBeDefined();
    expect(second.content_sha256).toBe(first.content_sha256);
    post.channels.instagram!.caption += ' modifié';
    const changed = (await service.exportManifest('2026-W42', 'instagram'))
      .posts[0];
    expect(changed.content_sha256).not.toBe(first.content_sha256);
  });

  it.each([
    '2021-W53',
    '2026-W00',
    '2026-W54',
    '2026-W1',
    '2026-W42\r\nInjected',
    '0000-W01',
  ])('rejects invalid ISO week %s before DB access', async (week) => {
    const { hub, service } = setup();
    await expect(service.exportManifest(week, 'instagram')).rejects.toThrow();
    expect(hub.getApprovedPostsByChannel).not.toHaveBeenCalled();
  });

  it.each([
    [
      'missing format',
      (p: SocialPost) => {
        delete (
          p.channels.instagram as Partial<
            NonNullable<SocialPost['channels']['instagram']>
          >
        ).format;
      },
    ],
    [
      'blank caption',
      (p: SocialPost) => {
        p.channels.instagram!.caption = ' ';
      },
    ],
    [
      'unknown approved field',
      (p: SocialPost) => {
        Object.assign(p.channels.instagram!, {
          new_unhandled_field: 'must not disappear',
        });
      },
    ],
    [
      'missing reviewer',
      (p: SocialPost) => {
        p.channel_reviews.instagram!.actor = '';
      },
    ],
    [
      'invalid review counter',
      (p: SocialPost) => {
        p.review_version = -1;
      },
    ],
    [
      'invalid day',
      (p: SocialPost) => {
        p.day_of_week = 8;
      },
    ],
    [
      'wrong week',
      (p: SocialPost) => {
        p.week_iso = '2026-W41';
      },
    ],
    [
      'channel absent from target list',
      (p: SocialPost) => {
        p.channels_list = ['facebook'];
      },
    ],
  ] as const)('refuses a malformed approved row: %s', async (_name, change) => {
    const post = fixture();
    change(post);
    await expect(
      setup(post).service.exportManifest('2026-W42', 'instagram'),
    ).rejects.toThrow();
  });

  it('does not silently duplicate the same post in an export', async () => {
    const post = fixture();
    const { hub, service } = setup(post);
    hub.getApprovedPostsByChannel.mockResolvedValue([post, post]);
    await expect(
      service.exportManifest('2026-W42', 'instagram'),
    ).rejects.toThrow();
  });
});
