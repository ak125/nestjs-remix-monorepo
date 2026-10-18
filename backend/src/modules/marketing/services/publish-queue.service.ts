import {
  parseSocialReview,
  type SocialReviewTarget,
} from '../dto/social-review.dto';
import { parseSocialPublication } from '../dto/social-publication.dto';
import { Injectable, Logger } from '@nestjs/common';
import { DomainValidationException } from '@common/exceptions';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { UTMBuilderService } from './utm-builder.service';
import { socialContentSchemas } from '../dto/social-content.dto';
import { parseSocialExport } from '../dto/social-export.dto';
import type {
  SocialPost,
  SocialChannel,
  PublishManifest,
} from '../interfaces/marketing-hub.interfaces';

/**
 * Publish Queue Service.
 * - Version-bound per-channel review; legacy bulk transitions are refused.
 * - Export PublishManifest JSON per channel
 * - Idempotent: re-export does not create duplicates
 */
@Injectable()
export class PublishQueueService {
  private readonly logger = new Logger(PublishQueueService.name);

  constructor(
    private readonly hubData: MarketingHubDataService,
    private readonly utmBuilder: UTMBuilderService,
  ) {}

  /**
   * Get posts ready for review (gate_passed).
   */
  async getReviewQueue(weekIso: string): Promise<SocialPost[]> {
    return this.hubData.getPostsByWeek(weekIso, 'gate_passed');
  }

  /**
   * Get approved posts ready for export.
   */
  async getApprovedQueue(weekIso: string): Promise<SocialPost[]> {
    return this.hubData.getPostsByWeek(weekIso, 'approved');
  }

  /**
   * Approve the displayed revision of one channel.
   */
  async approvePost(
    postId: number,
    target: SocialReviewTarget,
    actor: string,
  ): Promise<SocialPost> {
    return this.hubData.reviewSocialPost(
      postId,
      parseSocialReview(target),
      'approve',
      actor,
    );
  }

  async rejectPost(
    postId: number,
    target: SocialReviewTarget,
    actor: string,
  ): Promise<SocialPost> {
    return this.hubData.reviewSocialPost(
      postId,
      parseSocialReview(target),
      'reject',
      actor,
    );
  }

  async bulkApprove(): Promise<never> {
    throw new DomainValidationException({
      message: 'Review each channel and exact version before approval',
      field: 'review',
    });
  }

  /**
   * Export a publish manifest for a specific channel.
   * Idempotent: based on approved posts, no state mutation.
   */
  async exportManifest(
    weekIso: string,
    channel: SocialChannel,
  ): Promise<PublishManifest> {
    parseSocialExport({ week: weekIso, channel });
    const posts = await this.hubData.getApprovedPostsByChannel(
      weekIso,
      channel,
    );

    const OPTIMAL_HOURS: Record<number, string> = {
      1: '12:00',
      3: '18:00',
      5: '17:00',
      7: '10:00',
    };

    const manifest: PublishManifest = {
      week_iso: weekIso,
      channel,
      generated_at: new Date().toISOString(),
      timezone: 'Europe/Paris',
      posts: posts
        .filter((post) => {
          const review = post.channel_reviews?.[channel];
          return (
            !['published', 'archived'].includes(post.status) &&
            !post.publications?.[channel] &&
            review?.state === 'approved' &&
            review.content_revision === post.content_revision &&
            /^[a-f0-9]{64}$/.test(review.approved_content_hash ?? '')
          );
        })
        .map((post) => {
          const approval = post.channel_reviews[channel]!;
          if (
            !Number.isSafeInteger(post.content_revision) ||
            post.content_revision < 1 ||
            !Number.isSafeInteger(post.review_version) ||
            post.review_version < 0 ||
            !approval.actor?.trim() ||
            !Number.isFinite(Date.parse(approval.decided_at)) ||
            !Number.isInteger(post.day_of_week) ||
            post.day_of_week < 1 ||
            post.day_of_week > 7
          ) {
            throw new DomainValidationException({
              message: 'Invalid approved post metadata',
              field: 'review',
            });
          }
          const content = socialContentSchemas[channel]?.safeParse(
            post.channels?.[channel],
          );
          if (!post.channels_list?.includes(channel) || !content?.success) {
            throw new DomainValidationException({
              message: `Post ${post.id}: missing or invalid ${channel} variant`,
              field: 'channels',
            });
          }
          const channelData =
            (
              post.channels as Record<
                string,
                Record<string, string | string[] | boolean | undefined>
              >
            )?.[channel] || {};

          return {
            post_id: post.id,
            content_revision: post.content_revision,
            review_version: post.review_version,
            approved_content_hash: approval.approved_content_hash!,
            approval_scope: 'editorial',
            approval: {
              actor: approval.actor,
              decided_at: approval.decided_at,
            },
            scheduled_date: this.getDateForWeekDay(weekIso, post.day_of_week),
            scheduled_time: OPTIMAL_HOURS[post.day_of_week] || '12:00',
            ...(channel === 'youtube'
              ? { title: String(channelData.title) }
              : {}),
            caption: String(
              channelData.caption || channelData.description || '',
            ),
            hashtags: (channelData.hashtags ||
              channelData.tags ||
              []) as string[],
            link: post.source_url
              ? this.utmBuilder.appendParams(post.source_url, {
                  ...this.utmBuilder.buildUTMLink({
                    path: post.source_url,
                    week_iso: post.week_iso,
                    pillar: post.slot_label,
                    gamme_alias: post.gamme_alias || 'generic',
                    channel,
                    format: String(channelData.format),
                  }).params,
                  utm_campaign: post.utm_campaign,
                })
              : '',
            format: String(channelData.format || 'post'),
            visual_brief: String(
              channelData.visual_brief || channelData.thumbnail_brief || '',
            ),
          };
        }),
    };

    this.logger.log(
      `Manifest exported: ${weekIso}/${channel} — ${manifest.posts.length} posts`,
    );

    return manifest;
  }

  /**
   * Refuse the legacy transition without channel publication evidence.
   */
  async markAsPublished(_legacyIds: number[]): Promise<never> {
    throw new DomainValidationException({
      message: 'Declare a HTTPS publication URL for each approved channel',
      field: 'publication',
    });
  }

  async declarePublication(
    postId: number,
    body: unknown,
    actor: string,
  ): Promise<SocialPost> {
    return this.hubData.declarePublication(
      postId,
      parseSocialPublication(body),
      actor,
    );
  }

  private getDateForWeekDay(weekIso: string, dayOfWeek: number): string {
    const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return '';
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    // Civil date only; scheduled_time remains local campaign time.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayDiff = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayDiff + 1 + (week - 1) * 7);
    const target = new Date(monday);
    target.setUTCDate(monday.getUTCDate() + dayOfWeek - 1);
    return target.toISOString().split('T')[0];
  }
}
