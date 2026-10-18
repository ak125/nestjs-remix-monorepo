import { BrandComplianceGateService } from './brand-compliance-gate.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { SocialPost } from '../interfaces/marketing-hub.interfaces';

const post = {
  id: 17,
  content_revision: 1,
  review_version: 0,
  primary_channel: 'facebook',
  channels_list: ['facebook', 'youtube'],
  utm_campaign: 'mktg_2026w42',
  utm_source: 'facebook',
  utm_medium: 'social',
  channels: {
    facebook: {
      caption: 'Conseils Automecanik, partagez.',
      hashtags: [],
      format: 'post',
      link_preview: true,
    },
    youtube: {
      title: 'Entretien',
      description: 'Retrouvez-nous sur automecanik.com',
      tags: [],
      format: 'short',
    },
  },
} as SocialPost;

describe('brand validation of every declared channel', () => {
  const hub = {
    getActiveBrandRules: jest.fn().mockResolvedValue([]),
    reviewSocialPost: jest.fn(),
  };
  const service = new BrandComplianceGateService(
    hub as unknown as MarketingHubDataService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    hub.getActiveBrandRules.mockResolvedValue([]);
    hub.reviewSocialPost.mockImplementation(async (_id, target) => ({
      ...post,
      review_version: target.review_version + 1,
    }));
  });
  it('honors blocking severity even for a rule normally reported as a warning', async () => {
    hub.getActiveBrandRules.mockResolvedValue([
      {
        rule_key: 'emoji_count',
        rule_type: 'tone',
        severity: 'block',
        rule_value: { max: 0 },
      },
    ]);
    const candidate = {
      ...post,
      channels: {
        ...post.channels,
        facebook: {
          ...post.channels.facebook!,
          caption: 'Conseils Automecanik 🔧',
        },
      },
    };
    expect((await service.evaluate(candidate)).can_approve).toBe(false);
  });
  it('preserves valid variants', async () => {
    expect((await service.evaluate(post)).can_approve).toBe(true);
  });
  it.each([undefined, {}, { title: 'Entretien', description: '  ' }])(
    'refuses a missing or empty secondary YouTube body',
    async (youtube) => {
      const candidate = {
        ...post,
        channels: { ...post.channels, youtube },
      } as SocialPost;
      const summary = await service.evaluate(candidate);
      expect(summary.can_approve).toBe(false);
      expect(summary.blocking_issues.join(' ')).toContain('youtube');
    },
  );
  it('refuses an empty declared channel list', async () => {
    expect(
      (await service.evaluate({ ...post, channels_list: [] })).can_approve,
    ).toBe(false);
  });
  it('evaluates channel-specific blocking rules on the secondary variant', async () => {
    hub.getActiveBrandRules.mockImplementation(async (channel: string) =>
      channel === 'youtube'
        ? [
            {
              rule_key: 'competitors',
              rule_type: 'forbidden_word',
              severity: 'block',
              rule_value: { words: ['concurrent'] },
            },
          ]
        : [],
    );
    const candidate = {
      ...post,
      channels: {
        ...post.channels,
        youtube: { ...post.channels.youtube!, description: 'Concurrent' },
      },
    };
    expect((await service.evaluate(candidate)).can_approve).toBe(false);
  });
  it('persists every declared channel with successive confirmed review versions', async () => {
    expect((await service.evaluateAndPersist(post)).can_approve).toBe(true);
    expect(hub.reviewSocialPost).toHaveBeenNthCalledWith(
      1,
      17,
      { channel: 'facebook', content_revision: 1, review_version: 0 },
      'gate',
      'system:marketing-gate',
      expect.any(Object),
    );
    expect(hub.reviewSocialPost).toHaveBeenNthCalledWith(
      2,
      17,
      { channel: 'youtube', content_revision: 1, review_version: 1 },
      'gate',
      'system:marketing-gate',
      expect.any(Object),
    );
  });
  it('blocks a stale target before evaluating or persisting', async () => {
    await expect(
      service.evaluateAndPersist(
        post,
        { channel: 'facebook', content_revision: 1, review_version: 9 },
        '42',
      ),
    ).rejects.toThrow();
    expect(hub.getActiveBrandRules).not.toHaveBeenCalled();
    expect(hub.reviewSocialPost).not.toHaveBeenCalled();
  });
  it('a targeted gate does not review another channel', async () => {
    await service.evaluateAndPersist(
      post,
      { channel: 'youtube', content_revision: 1, review_version: 0 },
      '42',
    );
    expect(hub.getActiveBrandRules).toHaveBeenCalledTimes(1);
    expect(hub.getActiveBrandRules).toHaveBeenCalledWith('youtube');
  });
  it('does not announce a gate result if its write failed', async () => {
    hub.reviewSocialPost.mockRejectedValueOnce(new Error('storage outage'));
    await expect(service.evaluateAndPersist(post)).rejects.toThrow();
  });
});
