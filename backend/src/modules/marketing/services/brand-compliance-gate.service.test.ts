import { BrandComplianceGateService } from './brand-compliance-gate.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { SocialPost } from '../interfaces/marketing-hub.interfaces';

describe('gate persistence', () => {
  it('does not return a usable gate when persistence fails', async () => {
    const hub = {
      getActiveBrandRules: jest.fn().mockResolvedValue([]),
      updatePostGates: jest.fn().mockResolvedValue(false),
    };
    const service = new BrandComplianceGateService(
      hub as unknown as MarketingHubDataService,
    );
    await expect(
      service.evaluateAndPersist({
        id: 7,
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
    ).rejects.toThrow();
  });
});
