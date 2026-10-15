import { BrandComplianceGateService } from './brand-compliance-gate.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { SocialPost } from '../interfaces/marketing-hub.interfaces';

describe('gate persistence', () => {
  it('checks YouTube title and narration using YouTube rules, not the primary caption', async () => {
    const hub = {
      getActiveBrandRules: jest.fn().mockResolvedValue([
        {
          rule_type: 'forbidden_word',
          rule_key: 'claims',
          rule_value: { words: ['miracle'] },
          severity: 'block',
        },
      ]),
      reviewSocialPost: jest.fn().mockResolvedValue({}),
    };
    const service = new BrandComplianceGateService(hub as any);
    const result = await service.evaluateAndPersist(
      {
        id: 7,
        content_revision: 2,
        review_version: 0,
        primary_channel: 'facebook',
        channels_list: ['facebook', 'youtube'],
        channels: {
          facebook: { caption: 'Texte prudent' },
          youtube: {
            title: 'Conseil',
            description: 'Lien en description',
            hook_script: 'Solution miracle',
            tags: [],
            format: 'short',
          },
        },
      } as SocialPost,
      { channel: 'youtube', content_revision: 2, review_version: 0 },
      '42',
    );
    expect(hub.getActiveBrandRules).toHaveBeenCalledWith('youtube');
    expect(result.can_approve).toBe(false);
    expect(result.brand.violations[0].snippet).toBe('miracle');
    expect(hub.reviewSocialPost).toHaveBeenCalledWith(
      7,
      { channel: 'youtube', content_revision: 2, review_version: 0 },
      'gate',
      '42',
      result,
    );
  });

  it('refuses an obsolete snapshot before reading rules or persisting', async () => {
    const hub = { getActiveBrandRules: jest.fn(), reviewSocialPost: jest.fn() };
    const service = new BrandComplianceGateService(hub as any);
    await expect(
      service.evaluateAndPersist(
        { id: 7, content_revision: 3, review_version: 1 } as SocialPost,
        { channel: 'facebook', content_revision: 2, review_version: 1 },
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE.CONFLICT' });
    expect(hub.getActiveBrandRules).not.toHaveBeenCalled();
    expect(hub.reviewSocialPost).not.toHaveBeenCalled();
  });
  it('does not return a usable gate when persistence fails', async () => {
    const hub = {
      getActiveBrandRules: jest.fn().mockResolvedValue([]),
      reviewSocialPost: jest
        .fn()
        .mockRejectedValue(new Error('persistence failed')),
    };
    const service = new BrandComplianceGateService(
      hub as unknown as MarketingHubDataService,
    );
    await expect(
      service.evaluateAndPersist({
        id: 7,
        content_revision: 1,
        review_version: 0,
        channels_list: ['facebook'],
        primary_channel: 'facebook',
        channels: {
          facebook: {
            caption: 'Découvrez Automecanik',
            hashtags: ['#automecanik'],
            format: 'post',
            link_preview: true,
          },
        },
        utm_source: 'facebook',
        utm_campaign: 'test',
        utm_medium: 'social',
      } as SocialPost),
    ).rejects.toThrow('persistence failed');
    expect(hub.reviewSocialPost).toHaveBeenCalled();
  });
});
