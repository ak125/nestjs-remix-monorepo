import {
  DomainConflictException,
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';
import { isDeepStrictEqual } from 'util';
import { createHash } from 'crypto';
import { z } from 'zod';
import { socialContentSchemas } from '../dto/social-content.dto';
import { parseSocialExport } from '../dto/social-export.dto';
import {
  parsePublicationPreparation,
  PublicationPreparationSchema,
} from '../dto/publication-preparation.dto';
import {
  SocialReviewTarget,
  parseSocialReview,
} from '../dto/social-review.dto';
import { Injectable, Logger } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { UTMBuilderService } from './utm-builder.service';
import type {
  SocialPost,
  SocialChannel,
  PublishManifest,
} from '../interfaces/marketing-hub.interfaces';

// Only editorial data is needed by the existing manifest builder. Stored
// preparations intentionally do not contain a complete database post row.
const storedEditorialSchema = z.object({
  week_iso: z.string(),
  day_of_week: z.number(),
  channels_list: z.array(z.string()),
  channels: z.record(z.string(), z.unknown()),
  source_url: z.string().nullable(),
  utm_campaign: z.string(),
  utm_content: z.string().nullable(),
});
type ExportPost = Omit<z.infer<typeof storedEditorialSchema>, 'channels'> & {
  channels: Partial<Record<SocialChannel, unknown>>;
} & Pick<
    SocialPost,
    'id' | 'content_revision' | 'review_version' | 'status' | 'channel_reviews'
  >;

/**
 * Publish Queue Service.
 * - CRUD for posts status IN ('gate_passed', 'approved')
 * - Version-bound editorial decisions per network
 * - Export PublishManifest JSON per channel
 * - Export is read-only; publication evidence is a separate workflow
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
   * Approve a single post.
   */
  async approvePost(
    postId: number,
    target: SocialReviewTarget,
    actor: string,
  ): Promise<boolean> {
    await this.hubData.reviewSocialPost(
      postId,
      parseSocialReview(target),
      'approve',
      actor,
    );
    return true;
  }

  async rejectPost(
    postId: number,
    target: SocialReviewTarget,
    actor: string,
  ): Promise<boolean> {
    await this.hubData.reviewSocialPost(
      postId,
      parseSocialReview(target),
      'reject',
      actor,
    );
    return true;
  }

  async preparePublication(postId: number, input: unknown, actor: string) {
    const preparation = await this.hubData.preparePublication(
      postId,
      parsePublicationPreparation(input),
      actor,
    );
    return {
      preparation,
      publication: {
        ready: false as const,
        blockers: [
          'account_authorization_unverified',
          'media_availability_and_rights_unverified',
          'publication_approval_missing',
        ],
      },
    };
  }

  /**
   * Export a publish manifest for a specific channel.
   * Read-only preparation. Stable identity is not a remote deduplication guarantee.
   */
  async exportManifest(
    weekIso: string,
    channel: SocialChannel,
  ): Promise<PublishManifest> {
    parseSocialExport({ week: weekIso, channel });
    const candidates = await this.hubData.getApprovedPostsByChannel(
      weekIso,
      channel,
    );

    return this.buildManifest(weekIso, channel, candidates);
  }

  /** Read-only download, never a reservation or a publication authorization. */
  async exportPreparation(postId: number, requestId: string) {
    const selection =
      PublicationPreparationSchema.shape.request_id.safeParse(requestId);
    if (!selection.success || !Number.isSafeInteger(postId) || postId <= 0)
      throw new DomainValidationException({
        message: 'Invalid preparation selection',
        field: 'preparation',
      });
    const preparation = await this.hubData.getPublicationPreparation(
      postId,
      selection.data,
    );
    if (!preparation)
      throw new DomainNotFoundException({ message: 'Preparation not found' });
    const current = await this.hubData.getPostById(postId);
    if (!current)
      throw new DomainNotFoundException({ message: 'Post not found' });
    // Compare this network's full decision. A decision on another network does
    // not revoke it, but a rejection followed by reapproval must not revive it.
    if (
      current.content_revision !== preparation.content_revision ||
      ['published', 'archived'].includes(current.status) ||
      !isDeepStrictEqual(
        current.channel_reviews?.[preparation.channel],
        preparation.approval_snapshot,
      )
    ) {
      throw new DomainConflictException({
        message: 'Preparation is obsolete; reload content and prepare again',
      });
    }
    const storedEditorial = storedEditorialSchema.safeParse(
      preparation.editorial_snapshot,
    );
    if (!storedEditorial.success)
      throw new DomainValidationException({
        message: 'Invalid preparation editorial snapshot',
        field: 'preparation',
      });
    const savedPost: ExportPost = {
      ...storedEditorial.data,
      id: postId,
      content_revision: preparation.content_revision,
      review_version: preparation.review_version,
      status: 'approved',
      channel_reviews: { [preparation.channel]: preparation.approval_snapshot },
    };
    const savedEntry = this.buildManifest(
      savedPost.week_iso,
      preparation.channel,
      [savedPost],
    ).posts[0];
    const currentEntry = this.buildManifest(
      current.week_iso,
      preparation.channel,
      [current],
    ).posts[0];
    if (
      !savedEntry ||
      !currentEntry ||
      !isDeepStrictEqual(
        savedEntry.content_snapshot,
        currentEntry.content_snapshot,
      )
    )
      throw new DomainConflictException({
        message: 'Preparation content differs from current export',
      });
    const { publication: _unboundPublication, ...editorial } = savedEntry;
    return {
      schema_version: 1 as const,
      purpose: 'bound_publication_preparation' as const,
      export_id: `preparation:${preparation.request_id}`,
      preparation,
      editorial,
      publication: {
        ready: false as const,
        blockers: [
          'account_authorization_unverified',
          'media_availability_and_rights_unverified',
          'publication_approval_missing',
        ],
      },
    };
  }

  private buildManifest(
    weekIso: string,
    channel: SocialChannel,
    candidates: ExportPost[],
  ): PublishManifest {
    parseSocialExport({ week: weekIso, channel });

    const posts = candidates.filter(
      (post) =>
        post.channel_reviews?.[channel]?.state === 'approved' &&
        post.channel_reviews[channel]?.content_revision ===
          post.content_revision &&
        !['published', 'archived'].includes(post.status),
    );

    const OPTIMAL_HOURS: Record<number, string> = {
      1: '12:00',
      3: '18:00',
      5: '17:00',
      7: '10:00',
    };

    const manifest: PublishManifest = {
      schema_version: 2,
      purpose: 'editorial_preparation',
      week_iso: weekIso,
      channel,
      generated_at: new Date().toISOString(),
      posts: posts.map((post) => {
        const metadata = z
          .object({
            id: z.number().int().positive().safe(),
            content_revision: z.number().int().positive().safe(),
            review_version: z.number().int().nonnegative().safe(),
            week_iso: z.literal(weekIso),
            day_of_week: z.number().int().min(1).max(7),
            channels_list: z
              .array(z.string())
              .refine((list) => list.includes(channel)),
          })
          .safeParse(post);
        const approval = z
          .object({
            actor: z.string().trim().min(1),
            decided_at: z.string().datetime({ offset: true }),
          })
          .safeParse(post.channel_reviews[channel]);
        // The same schemas validate generation and review. Unknown fields must
        // be handled explicitly instead of disappearing from approved exports.
        const content = socialContentSchemas[channel]
          .strict()
          .safeParse(post.channels?.[channel]);
        if (!metadata.success || !approval.success || !content.success) {
          throw new DomainValidationException({
            message: `Approved post ${post.id} cannot be exported: invalid content or review metadata`,
            field: 'export',
          });
        }
        const channelData = content.data;
        const link = post.source_url
          ? this.utmBuilder.appendParams(post.source_url, {
              utm_source: channel,
              utm_medium: 'social',
              utm_campaign: post.utm_campaign,
              utm_content: post.utm_content ?? undefined,
            })
          : '';
        const snapshot = {
          post_id: post.id,
          content_revision: post.content_revision,
          channel,
          week_iso: weekIso,
          scheduled_date: this.getDateForWeekDay(weekIso, post.day_of_week),
          scheduled_time: OPTIMAL_HOURS[post.day_of_week] || '12:00',
          channel_content: channelData,
          link,
        };
        const blockers: PublishManifest['posts'][number]['publication']['blockers'] =
          ['account_not_bound', 'publication_approval_missing'];
        if (channel !== 'facebook' || channelData.format !== 'post') {
          blockers.push('final_media_not_bound');
        }

        return {
          export_id: `social:${post.id}:r${post.content_revision}:${channel}`,
          content_snapshot: snapshot,
          content_sha256: createHash('sha256')
            .update(JSON.stringify(snapshot))
            .digest('hex'),
          channel_content: channelData,
          publication: {
            ready: false as const,
            account: null,
            approval: null,
            blockers,
          },
          post_id: post.id,
          content_revision: post.content_revision,
          review_version: post.review_version,
          approval: post.channel_reviews[channel]!,
          approval_scope: 'editorial' as const,
          ...('title' in channelData ? { title: channelData.title } : {}),
          scheduled_date: snapshot.scheduled_date,
          scheduled_time: snapshot.scheduled_time,
          caption:
            'caption' in channelData
              ? channelData.caption
              : channelData.description,
          hashtags:
            'hashtags' in channelData ? channelData.hashtags : channelData.tags,
          link,
          format: channelData.format,
          visual_brief:
            'visual_brief' in channelData
              ? (channelData.visual_brief ?? '')
              : 'thumbnail_brief' in channelData
                ? (channelData.thumbnail_brief ?? '')
                : '',
        };
      }),
    };

    if (
      new Set(manifest.posts.map((post) => post.export_id)).size !==
      manifest.posts.length
    ) {
      throw new DomainValidationException({
        message: 'Duplicate post in export source',
        field: 'export',
      });
    }

    this.logger.log(
      `Manifest exported: ${weekIso}/${channel} — ${manifest.posts.length} posts`,
    );

    return manifest;
  }

  /**
   * Mark posts as published after manual Meta/YT publication.
   */
  async markAsPublished(_postIds: number[]): Promise<number> {
    throw new DomainValidationException({
      message:
        'Publication requires a channel, approved revision and remote evidence; legacy declaration disabled',
      field: 'publication',
    });
  }

  private getDateForWeekDay(weekIso: string, dayOfWeek: number): string {
    const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return '';
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayDiff = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayDiff + 1 + (week - 1) * 7);
    const target = new Date(monday);
    target.setUTCDate(monday.getUTCDate() + dayOfWeek - 1);
    return target.toISOString().split('T')[0];
  }
}
