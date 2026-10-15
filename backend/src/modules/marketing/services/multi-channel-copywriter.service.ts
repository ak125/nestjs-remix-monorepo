import { Injectable, Logger, Optional } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { UTMBuilderService } from './utm-builder.service';
import { socialContentSchemas } from '../dto/social-content.dto';
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
 * - Leverages existing cache (7d SHA256), circuit breaker, provider: Claude (Anthropic)
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
    attempted: number;
    failures: Array<{ channel: SocialChannel; reason: string }>;
    utmLinks: Array<{
      channel: SocialChannel;
      full_url: string;
      params: UTMParams;
    }>;
  }> {
    const brief = slot.brief;
    const channels: ChannelVariants = {};
    let attempted = 0;
    const failures: Array<{ channel: SocialChannel; reason: string }> = [];
    const utmLinks: Array<{
      channel: SocialChannel;
      full_url: string;
      params: UTMParams;
    }> = [];

    for (const channel of new Set(brief.target_channels)) {
      try {
        // Build UTM link for this channel
        const utm = this.utmBuilder.buildUTMLink({
          path: brief.source_url,
          week_iso: weekIso,
          pillar: slot.pillar,
          gamme_alias: brief.gamme_alias || 'generic',
          channel,
          format: this.getDefaultFormat(channel, slot.pillar),
        });

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
          failures.push({ channel, reason: 'ai_unavailable' });
          this.logger.warn(
            `AiContentService unavailable, skipping ${channel}/${brief.topic}`,
          );
          continue;
        }

        attempted++;
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

        let parsed: unknown;
        try {
          parsed = JSON.parse(result.content);
        } catch {
          failures.push({ channel, reason: 'invalid_json' });
          continue;
        }
        const validated = socialContentSchemas[channel].safeParse(parsed);
        if (!validated.success) {
          failures.push({ channel, reason: 'invalid_schema' });
          continue;
        }
        Object.assign(channels, { [channel]: validated.data });
        utmLinks.push({ channel, full_url: utm.full_url, params: utm.params });
      } catch (err: unknown) {
        failures.push({ channel, reason: 'generation_failed' });
        this.logger.error(
          `Generation failed for ${channel}/${brief.topic}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { channels, utmLinks, attempted, failures };
  }

  /**
   * Batch generate copy for all slots in a weekly plan.
   * Sequential provider calls. dryRun is a network-free plan, never a generation.
   */
  async generateBatch(
    slots: DaySlot[],
    weekIso: string,
    dryRun: boolean = false,
  ): Promise<{
    generated: number;
    errors: number;
    attempted: number;
    valid_variants: number;
    persisted: number;
    mode: 'plan' | 'generate';
    details: Array<{
      day_of_week: number;
      channel?: SocialChannel;
      reason: string;
    }>;
  }> {
    let generated = 0;
    let errors = 0;
    let attempted = 0;
    let validVariants = 0;
    let persisted = 0;
    const details: Array<{
      day_of_week: number;
      channel?: SocialChannel;
      reason: string;
    }> = [];
    if (dryRun) {
      return {
        generated,
        errors,
        attempted,
        valid_variants: 0,
        persisted,
        mode: 'plan',
        details,
      };
    }

    for (const slot of slots) {
      try {
        const result = await this.generateForSlot(slot, weekIso);
        attempted += result.attempted;
        errors += result.failures.length;
        details.push(
          ...result.failures.map((failure) => ({
            day_of_week: slot.day_of_week,
            ...failure,
          })),
        );
        const validChannels = Object.keys(result.channels) as SocialChannel[];
        validVariants += validChannels.length;
        if (validChannels.length === 0) {
          if (!result.failures.length) {
            errors++;
            details.push({
              day_of_week: slot.day_of_week,
              reason: 'no_valid_variant',
            });
          }
          continue;
        }

        // Persist post
        const post = await this.hubData.upsertSocialPost({
          week_iso: weekIso,
          day_of_week: slot.day_of_week,
          slot_label: slot.pillar,
          // Part of the legacy upsert key: a partial retry must keep its identity.
          primary_channel: slot.brief.target_channels[0],
          channels_list: validChannels,
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
        if (!post) {
          errors++;
          details.push({
            day_of_week: slot.day_of_week,
            reason: 'post_not_persisted',
          });
          continue;
        }
        persisted++;

        // Register UTM links
        let attributionPersisted = true;
        for (const utm of result.utmLinks) {
          const saved = await this.hubData.registerUTM({
            utm_campaign: utm.params.utm_campaign,
            utm_source: utm.params.utm_source,
            utm_medium: utm.params.utm_medium,
            utm_content: utm.params.utm_content,
            target_url: utm.full_url,
            social_post_id: post.id,
          });
          if (!saved) {
            attributionPersisted = false;
            errors++;
            details.push({
              day_of_week: slot.day_of_week,
              channel: utm.channel,
              reason: 'attribution_not_persisted',
            });
          }
        }
        if (!attributionPersisted) continue;

        generated++;
        this.logger.log(`Persisted: ${slot.pillar}/${slot.brief.topic}`);
      } catch (err: unknown) {
        errors++;
        details.push({
          day_of_week: slot.day_of_week,
          reason: 'persistence_failed',
        });
        this.logger.error(
          `Batch error for slot ${slot.day_of_week}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      generated,
      errors,
      attempted,
      valid_variants: validVariants,
      persisted,
      mode: 'generate',
      details,
    };
  }

  private getDefaultFormat(channel: SocialChannel, pillar: string): string {
    if (channel === 'youtube') return 'short';
    if (channel === 'instagram' && pillar === 'conseil') return 'carrousel';
    if (channel === 'instagram') return 'post';
    return 'post';
  }
}
