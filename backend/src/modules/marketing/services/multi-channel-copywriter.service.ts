import { Injectable, Logger, Optional } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { UTMBuilderService } from './utm-builder.service';
import { AiContentService } from '../../ai-content/ai-content.service';
import { getSocialTemplate } from '../templates/social-post-templates';
import type {
  SocialChannel,
  ChannelVariants,
  DaySlot,
  UTMParams,
} from '../interfaces/marketing-hub.interfaces';

/**
 * Multi-channel copywriter service.
 *
 * Integration with AiContentService:
 * - Uses ContentType: social_instagram, social_facebook, social_youtube
 * - Leverages existing cache (7d SHA256), circuit breaker, failover (Claude→Groq)
 * - Batch via AiContentService.batchGenerate() (max 10, Promise.allSettled)
 *
 * This service is the orchestrator — it builds the context and delegates
 * generation to AiContentService via the registered content types.
 */
@Injectable()
export class MultiChannelCopywriterService {
  private readonly logger = new Logger(MultiChannelCopywriterService.name);

  constructor(
    private readonly hubData: MarketingHubDataService,
    private readonly utmBuilder: UTMBuilderService,
    @Optional() private readonly aiContent?: AiContentService,
  ) {}

  /**
   * Generate copy for a single slot (all channels).
   * Returns the channel variants ready to be stored in __marketing_social_posts.
   */
  async generateForSlot(
    slot: DaySlot,
    weekIso: string,
  ): Promise<{
    channels: ChannelVariants;
    utmLinks: Array<{
      channel: SocialChannel;
      full_url: string;
      params: UTMParams;
    }>;
  } | null> {
    const brief = slot.brief;
    const channels: ChannelVariants = {};
    const utmLinks: Array<{
      channel: SocialChannel;
      full_url: string;
      params: UTMParams;
    }> = [];

    for (const channel of brief.target_channels) {
      try {
        // Build UTM link for this channel
        const utm = this.utmBuilder.buildUTMLink({
          path: brief.source_url.replace('https://www.automecanik.com', ''),
          week_iso: weekIso,
          pillar: slot.pillar,
          gamme_alias: brief.gamme_alias || 'generic',
          channel,
          format: this.getDefaultFormat(channel, slot.pillar),
        });
        utmLinks.push({ channel, full_url: utm.full_url, params: utm.params });

        // Build generation context
        const contentType = `social_${channel}` as const;
        const context = {
          brief: {
            gamme_name: brief.topic,
            gamme_alias: brief.gamme_alias,
            utm_link: utm.full_url,
            pillar: slot.pillar,
            format: this.getDefaultFormat(channel, slot.pillar),
            key_selling_points: brief.key_selling_points,
            price_range: brief.price_source?.value,
          },
          prompt: brief.topic,
          features: brief.key_selling_points,
        };

        const template = getSocialTemplate(slot.pillar, channel);

        if (!this.aiContent) {
          this.logger.warn(
            `AiContentService unavailable, skipping ${channel}/${brief.topic}`,
          );
          continue;
        }

        const result = await this.aiContent.generateContent({
          type: contentType,
          prompt: brief.topic,
          tone: 'professional',
          language: 'fr',
          maxLength: template?.maxLength || 2200,
          temperature: 0.4,
          context,
          useCache: true,
        });

        try {
          channels[channel] = JSON.parse(result.content);
        } catch {
          this.logger.warn(
            `JSON parse failed for ${channel}, raw: ${result.content.slice(0, 200)}`,
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `Generation failed for ${channel}/${brief.topic}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { channels, utmLinks };
  }

  /**
   * Batch generate copy for all slots in a weekly plan.
   * Uses AiContentService.batchGenerate() (max 10 per batch).
   */
  async generateBatch(
    slots: DaySlot[],
    weekIso: string,
    dryRun: boolean = false,
  ): Promise<{ generated: number; errors: number }> {
    let generated = 0;
    let errors = 0;

    for (const slot of slots) {
      try {
        const result = await this.generateForSlot(slot, weekIso);
        if (!result) {
          errors++;
          continue;
        }

        if (!dryRun) {
          // Persist post
          await this.hubData.upsertSocialPost({
            week_iso: weekIso,
            day_of_week: slot.day_of_week,
            slot_label: slot.pillar,
            primary_channel: slot.brief.target_channels[0],
            channels_list: slot.brief.target_channels,
            channels: result.channels,
            gamme_id: slot.brief.gamme_id ?? null,
            gamme_alias: slot.brief.gamme_alias ?? null,
            content_source: slot.brief.content_source,
            source_url: slot.brief.source_url,
            objective: slot.brief.objective,
            utm_campaign: result.utmLinks[0]?.params.utm_campaign || '',
            utm_source: result.utmLinks[0]?.params.utm_source || 'instagram',
            utm_medium: 'social',
            utm_content: result.utmLinks[0]?.params.utm_content,
            status: 'generated',
          });

          // Register UTM links
          for (const utm of result.utmLinks) {
            await this.hubData.registerUTM({
              utm_campaign: utm.params.utm_campaign,
              utm_source: utm.params.utm_source,
              utm_medium: utm.params.utm_medium,
              utm_content: utm.params.utm_content,
              target_url: utm.full_url,
            });
          }
        }

        generated++;
        this.logger.log(
          `${dryRun ? '[DRY-RUN] ' : ''}Generated: ${slot.pillar}/${slot.brief.topic}`,
        );
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `Batch error for slot ${slot.day_of_week}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { generated, errors };
  }

  private getDefaultFormat(channel: SocialChannel, pillar: string): string {
    if (channel === 'youtube') return 'short';
    if (channel === 'instagram' && pillar === 'conseil') return 'carrousel';
    if (channel === 'instagram') return 'post';
    return 'post';
  }
}
