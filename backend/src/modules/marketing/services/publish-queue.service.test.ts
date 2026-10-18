import { PublishQueueService } from './publish-queue.service';
import { UTMBuilderService } from './utm-builder.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { SocialPost } from '../interfaces/marketing-hub.interfaces';
import { SITE_ORIGIN } from '../../../config/app.config';

const post = {
  id: 17,
  content_revision: 1,
  review_version: 2,
  publications: {},
  channel_reviews: {
    youtube: {
      state: 'approved',
      content_revision: 1,
      actor: '42',
      decided_at: '2026-10-16T12:00:00Z',
      approved_content_hash: 'a'.repeat(64),
    },
  },
  week_iso: '2026-W42',
  day_of_week: 1,
  slot_label: 'conseil',
  primary_channel: 'facebook',
  channels_list: ['facebook', 'youtube'],
  status: 'approved',
  gamme_alias: 'frein',
  utm_campaign: 'fixture',
  utm_source: 'facebook',
  utm_medium: 'social',
  utm_content: 'facebook_post_old',
  source_url: `${SITE_ORIGIN}/blog/conseils/frein?vehicle=42&utm_source=old#conseils`,
  channels: {
    youtube: {
      title: 'Entretien',
      description: 'Consultez les conseils.',
      tags: [],
      format: 'short',
    },
  },
} as SocialPost;

function setup(candidate = post) {
  const hub = {
    getApprovedPostsByChannel: jest.fn().mockResolvedValue([candidate]),
  };
  const service = new PublishQueueService(
    hub as unknown as MarketingHubDataService,
    new UTMBuilderService(),
  );
  return { service, hub };
}

describe('manual export of each social variant', () => {
  it('exports the selected variant with its own deterministic attribution', async () => {
    const manifest = await setup().service.exportManifest(
      '2026-W42',
      'youtube',
    );
    const exported = manifest.posts[0];
    expect(manifest.timezone).toBe('Europe/Paris');
    expect(exported.title).toBe(post.channels.youtube!.title);
    expect(exported.caption).toBe(post.channels.youtube!.description);
    const url = new URL(exported.link);
    expect(url.pathname).toBe('/blog/conseils/frein');
    expect(url.hash).toBe('#conseils');
    expect(url.searchParams.get('vehicle')).toBe('42');
    expect(url.searchParams.getAll('utm_source')).toEqual(['youtube']);
    expect(url.searchParams.get('utm_content')).toMatch(/^youtube_short_/);
    expect(url.searchParams.get('utm_campaign')).toBe(post.utm_campaign);
    expect(exported.scheduled_date).toBe('2026-10-12');
  });
  it.each(['2026-W00', '2026-W54', '2025-W53', 'bad'])(
    'rejects invalid ISO week %s before storage',
    async (week) => {
      const { service, hub } = setup();
      await expect(service.exportManifest(week, 'youtube')).rejects.toThrow();
      expect(hub.getApprovedPostsByChannel).not.toHaveBeenCalled();
    },
  );
  it('refuses an absent approved variant instead of exporting empty text', async () => {
    await expect(
      setup({ ...post, channels: {} }).service.exportManifest(
        '2026-W42',
        'youtube',
      ),
    ).rejects.toThrow();
  });
  it('refuses an undeclared variant', async () => {
    await expect(
      setup({ ...post, channels_list: ['facebook'] }).service.exportManifest(
        '2026-W42',
        'youtube',
      ),
    ).rejects.toThrow();
  });
  it.each([
    ['2020-W53', 7, '2021-01-03'],
    ['2026-W13', 7, '2026-03-29'],
    ['2026-W43', 7, '2026-10-25'],
  ] as const)(
    'preserves the civil campaign date %s day %i',
    async (week_iso, day_of_week, expected) => {
      const manifest = await setup({
        ...post,
        week_iso,
        day_of_week,
      }).service.exportManifest(week_iso, 'youtube');
      expect(manifest.posts[0].scheduled_date).toBe(expected);
    },
  );
});
