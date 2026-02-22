import { Injectable, Logger } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import type {
  SocialPost,
  SocialChannel,
  PublishManifest,
} from '../interfaces/marketing-hub.interfaces';

/**
 * Publish Queue Service.
 * - CRUD for posts status IN ('gate_passed', 'approved')
 * - Bulk approve/reject
 * - Export PublishManifest JSON per channel
 * - Idempotent: re-export does not create duplicates
 */
@Injectable()
export class PublishQueueService {
  private readonly logger = new Logger(PublishQueueService.name);

  constructor(private readonly hubData: MarketingHubDataService) {}

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
   * Approve a single post.
   */
  async approvePost(postId: number, approvedBy: string): Promise<boolean> {
    return this.hubData.updatePostStatus(postId, 'approved', {
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    } as Partial<SocialPost>);
  }

  /**
   * Reject a post (back to draft for revision).
   */
  async rejectPost(postId: number): Promise<boolean> {
    return this.hubData.updatePostStatus(postId, 'draft');
  }

  /**
   * Bulk approve multiple posts.
   */
  async bulkApprove(
    postIds: number[],
    approvedBy: string,
  ): Promise<{ approved: number; failed: number }> {
    let approved = 0;
    let failed = 0;

    for (const id of postIds) {
      const ok = await this.approvePost(id, approvedBy);
      if (ok) approved++;
      else failed++;
    }

    this.logger.log(`Bulk approve: ${approved} approved, ${failed} failed`);
    return { approved, failed };
  }

  /**
   * Export a publish manifest for a specific channel.
   * Idempotent: based on approved posts, no state mutation.
   */
  async exportManifest(
    weekIso: string,
    channel: SocialChannel,
  ): Promise<PublishManifest> {
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
      posts: posts.map((post) => {
        const channelData =
          (
            post.channels as Record<
              string,
              Record<string, string | string[] | boolean | undefined>
            >
          )?.[channel] || {};

        return {
          post_id: post.id,
          scheduled_date: this.getDateForWeekDay(weekIso, post.day_of_week),
          scheduled_time: OPTIMAL_HOURS[post.day_of_week] || '12:00',
          caption: String(channelData.caption || channelData.description || ''),
          hashtags: (channelData.hashtags ||
            channelData.tags ||
            []) as string[],
          link: post.source_url
            ? `${post.source_url}?utm_source=${post.utm_source}&utm_medium=${post.utm_medium}&utm_campaign=${post.utm_campaign}${post.utm_content ? `&utm_content=${post.utm_content}` : ''}`
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
   * Mark posts as published after manual Meta/YT publication.
   */
  async markAsPublished(postIds: number[]): Promise<number> {
    let count = 0;
    for (const id of postIds) {
      const ok = await this.hubData.updatePostStatus(id, 'published', {
        published_at: new Date().toISOString(),
      } as Partial<SocialPost>);
      if (ok) count++;
    }
    return count;
  }

  private getDateForWeekDay(weekIso: string, dayOfWeek: number): string {
    const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return '';
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    const jan4 = new Date(year, 0, 4);
    const dayDiff = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayDiff + 1 + (week - 1) * 7);
    const target = new Date(monday);
    target.setDate(monday.getDate() + dayOfWeek - 1);
    return target.toISOString().split('T')[0];
  }
}
