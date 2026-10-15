import { MultiChannelCopywriterService } from './multi-channel-copywriter.service';
import { UTMBuilderService } from './utm-builder.service';
import type { MarketingHubDataService } from './marketing-hub-data.service';
import type { AiContentService } from '../../ai-content/ai-content.service';
import type { DaySlot } from '../interfaces/marketing-hub.interfaces';
import { SITE_ORIGIN } from '../../../config/app.config';

const facebook = {
  caption: 'Consultez les conseils Automecanik.',
  hashtags: ['#automecanik'],
  format: 'post',
  link_preview: true,
};
const slot: DaySlot = {
  day_of_week: 1,
  date_iso: '2026-10-12',
  pillar: 'conseil',
  optimal_hour: '12:00',
  brief: {
    topic: 'Freinage',
    angle: 'Conseils',
    gamme_id: 1,
    gamme_alias: 'frein',
    content_source: 'blog_advice',
    source_url: `${SITE_ORIGIN}/blog/conseils/frein?vehicle=42#conseils`,
    target_channels: ['facebook'],
    objective: 'traffic',
    cta_type: 'partage',
    key_selling_points: [],
    visual_direction: 'Pièce',
  },
};

function setup(available = true) {
  const hub = {
    upsertSocialPost: jest.fn().mockResolvedValue({ id: 17 }),
    registerUTM: jest.fn().mockResolvedValue(true),
  };
  const ai = {
    generateContent: jest
      .fn()
      .mockResolvedValue({ content: JSON.stringify(facebook) }),
  };
  const service = new MultiChannelCopywriterService(
    hub as unknown as MarketingHubDataService,
    new UTMBuilderService(),
    available ? (ai as unknown as AiContentService) : undefined,
  );
  return { service, hub, ai };
}

describe('marketing copy delivery accounting', () => {
  it('keeps a successful persisted delivery', async () => {
    const { service, hub } = setup();
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 1,
      errors: 0,
    });
    expect(hub.registerUTM).toHaveBeenCalledWith(
      expect.objectContaining({ social_post_id: 17, utm_source: 'facebook' }),
    );
  });

  it('does not count an unavailable AI service', async () => {
    const { service, hub } = setup(false);
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 0,
      errors: 1,
    });
    expect(hub.upsertSocialPost).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'not JSON',
    'null',
    '{}',
    '[]',
    '{"caption":42}',
    JSON.stringify({ ...facebook, hashtags: 'bad' }),
  ])('rejects invalid output %s', async (content) => {
    const { service, hub, ai } = setup();
    ai.generateContent.mockResolvedValue({ content });
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 0,
      errors: 1,
    });
    expect(hub.upsertSocialPost).not.toHaveBeenCalled();
  });

  it('reports provider rejection/timeout without a delivery', async () => {
    const { service, ai } = setup();
    ai.generateContent.mockRejectedValue(new Error('provider timeout'));
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 0,
      errors: 1,
    });
  });

  it('does not count null persistence or register orphan attribution', async () => {
    const { service, hub } = setup();
    hub.upsertSocialPost.mockResolvedValue(null);
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 0,
      errors: 1,
    });
    expect(hub.registerUTM).not.toHaveBeenCalled();
  });

  it('does not count false attribution persistence as a complete delivery', async () => {
    const { service, hub } = setup();
    hub.registerUTM.mockResolvedValue(false);
    expect(await service.generateBatch([slot], '2026-W42')).toMatchObject({
      generated: 0,
      persisted: 1,
      errors: 1,
    });
  });

  it('keeps only validated channels and exposes the partial result', async () => {
    const { service, hub, ai } = setup();
    ai.generateContent
      .mockResolvedValueOnce({ content: '{}' })
      .mockResolvedValueOnce({ content: JSON.stringify(facebook) });
    const partial = {
      ...slot,
      brief: {
        ...slot.brief,
        target_channels: ['instagram', 'facebook'] as const,
      },
    };
    const result = await service.generateBatch(
      [
        {
          ...partial,
          brief: {
            ...partial.brief,
            target_channels: [...partial.brief.target_channels],
          },
        },
      ],
      '2026-W42',
    );
    expect(result).toMatchObject({
      attempted: 2,
      valid_variants: 1,
      persisted: 1,
      generated: 1,
      errors: 1,
    });
    expect(hub.upsertSocialPost).toHaveBeenCalledWith(
      expect.objectContaining({
        // The primary channel belongs to the existing upsert identity, not the result.
        primary_channel: 'instagram',
        channels_list: ['facebook'],
        channels: { facebook },
      }),
    );
    expect(hub.registerUTM).toHaveBeenCalledTimes(1);
  });

  it('dry-run never calls AI or persistence', async () => {
    const { service, hub, ai } = setup();
    expect(await service.generateBatch([slot], '2026-W42', true)).toMatchObject(
      { generated: 0, attempted: 0, persisted: 0 },
    );
    expect(ai.generateContent).not.toHaveBeenCalled();
    expect(hub.upsertSocialPost).not.toHaveBeenCalled();
  });

  it('attempts a repeated channel only once', async () => {
    const { service, ai } = setup();
    const duplicate = {
      ...slot,
      brief: {
        ...slot.brief,
        target_channels: ['facebook', 'facebook'] as ['facebook', 'facebook'],
      },
    };
    expect(await service.generateBatch([duplicate], '2026-W42')).toMatchObject({
      attempted: 1,
      valid_variants: 1,
      generated: 1,
    });
    expect(ai.generateContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'instagram',
      {
        caption: 'Conseils Automecanik',
        hashtags: ['#automecanik'],
        format: 'post',
        dimensions: '1080x1080',
      },
    ],
    [
      'youtube',
      {
        title: 'Freinage',
        description: 'Conseils Automecanik',
        tags: ['automecanik'],
        format: 'short',
      },
    ],
  ] as const)('preserves a valid %s variant', async (channel, content) => {
    const { service, ai } = setup();
    ai.generateContent.mockResolvedValue({ content: JSON.stringify(content) });
    expect(
      await service.generateBatch(
        [{ ...slot, brief: { ...slot.brief, target_channels: [channel] } }],
        '2026-W42',
      ),
    ).toMatchObject({ generated: 1, errors: 0, valid_variants: 1 });
  });
});
