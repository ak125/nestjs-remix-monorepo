import {
  DomainConflictException,
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';
import { SocialReviewTarget } from '../dto/social-review.dto';
import {
  PublicationPreparationInput,
  PublicationPreparationRecord,
  PublicationPreparationRecordSchema,
} from '../dto/publication-preparation.dto';
import { isDeepStrictEqual } from 'util';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DatabaseException } from '@common/exceptions';
import type {
  SocialPost,
  PostStatus,
  SocialChannel,
  BrandRule,
  WeeklyPlan,
  GateSummary,
  PriorityGamme,
} from '../interfaces/marketing-hub.interfaces';

@Injectable()
export class MarketingHubDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(MarketingHubDataService.name);

  constructor() {
    super();
  }

  // ── Social Posts ──

  async preparePublication(
    postId: number,
    input: PublicationPreparationInput,
    actor: string,
  ): Promise<PublicationPreparationRecord> {
    const { data, error } = await this.supabase.rpc(
      'prepare_marketing_publication',
      {
        p_post_id: postId,
        p_request_id: input.request_id,
        p_channel: input.channel,
        p_content_revision: input.content_revision,
        p_review_version: input.review_version,
        p_account: input.account,
        p_media: input.media,
        p_actor: actor,
      },
    );
    if (error) {
      if (['40001', '23505'].includes(error.code))
        throw new DomainConflictException({
          message:
            'Preparation changed or request ID already used; reload before preparing',
        });
      if (error.code === 'P0002')
        throw new DomainNotFoundException({ message: 'Post not found' });
      if (error.code === '23514')
        throw new DomainValidationException({
          message:
            'Current channel approval and valid preparation references required',
          field: 'preparation',
        });
      throw new DatabaseException({
        message: 'Unable to persist publication preparation',
        context: { operation: 'preparePublication', sourceCode: error.code },
      });
    }
    const parsed = PublicationPreparationRecordSchema.safeParse(data);
    if (
      !parsed.success ||
      parsed.data.post_id !== postId ||
      parsed.data.actor !== actor ||
      parsed.data.approval_snapshot.content_revision !==
        input.content_revision ||
      Object.entries(input).some(
        ([key, value]) => !isDeepStrictEqual(data[key], value),
      )
    ) {
      throw new DatabaseException({
        message: 'Missing or inconsistent persisted preparation',
      });
    }
    return parsed.data;
  }

  async getPublicationPreparations(
    postId: number,
  ): Promise<PublicationPreparationRecord[]> {
    const { data, error } = await this.supabase
      .from('__marketing_publication_preparations')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .order('request_id', { ascending: false })
      .limit(50);
    if (error)
      throw new DatabaseException({
        message: 'Unable to load preparation history',
        context: {
          operation: 'getPublicationPreparations',
          sourceCode: error.code,
        },
      });
    const parsed = PublicationPreparationRecordSchema.array().safeParse(data);
    if (
      !parsed.success ||
      parsed.data.some((record) => record.post_id !== postId)
    ) {
      throw new DatabaseException({ message: 'Invalid preparation history' });
    }
    return parsed.data;
  }

  async getPublicationPreparation(
    postId: number,
    requestId: string,
  ): Promise<PublicationPreparationRecord | null> {
    const { data, error } = await this.supabase
      .from('__marketing_publication_preparations')
      .select('*')
      .eq('post_id', postId)
      .eq('request_id', requestId)
      .maybeSingle();
    if (error)
      throw new DatabaseException({
        message: 'Unable to load selected preparation',
        context: {
          operation: 'getPublicationPreparation',
          sourceCode: error.code,
        },
      });
    if (data === null) return null;
    const parsed = PublicationPreparationRecordSchema.safeParse(data);
    if (
      !parsed.success ||
      parsed.data.post_id !== postId ||
      parsed.data.request_id !== requestId ||
      parsed.data.approval_snapshot.content_revision !==
        parsed.data.content_revision
    ) {
      throw new DatabaseException({ message: 'Invalid selected preparation' });
    }
    return parsed.data;
  }

  async getPostById(postId: number): Promise<SocialPost | null> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();
    if (error)
      throw new DatabaseException({
        message: 'Unable to load marketing post',
        context: { operation: 'getPostById', sourceCode: error.code },
      });
    return data as SocialPost | null;
  }

  async upsertSocialPost(
    post: Partial<SocialPost> & {
      week_iso: string;
      day_of_week: number;
      slot_label: string;
      primary_channel: string;
    },
  ): Promise<SocialPost | null> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .upsert(post, {
        onConflict: 'week_iso,day_of_week,slot_label,primary_channel',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`upsertSocialPost failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to persist marketing post',
        context: { operation: 'upsertSocialPost', sourceCode: error.code },
      });
    }
    return data as SocialPost;
  }

  async getPostsByWeek(
    weekIso: string,
    status?: PostStatus,
  ): Promise<SocialPost[]> {
    let query = this.supabase
      .from('__marketing_social_posts')
      .select('*')
      .eq('week_iso', weekIso)
      .order('day_of_week', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getPostsByWeek failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to load marketing posts',
        context: { operation: 'getPostsByWeek', sourceCode: error.code },
      });
    }
    return (data ?? []) as SocialPost[];
  }

  async updatePostStatus(
    postId: number,
    status: PostStatus,
    extra?: Partial<SocialPost>,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .update({ ...extra, status })
      .eq('id', postId)
      .select('id');

    if (error) {
      this.logger.error(`updatePostStatus failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to update marketing post',
        context: { operation: 'updatePostStatus', sourceCode: error.code },
      });
    }
    return data?.length === 1;
  }

  async reviewSocialPost(
    postId: number,
    target: SocialReviewTarget,
    action: 'gate' | 'approve' | 'reject',
    actor: string,
    gate?: GateSummary,
  ): Promise<SocialPost> {
    const { data, error } = await this.supabase.rpc(
      'review_marketing_social_post',
      {
        p_post_id: postId,
        p_channel: target.channel,
        p_content_revision: target.content_revision,
        p_review_version: target.review_version,
        p_action: action,
        p_actor: actor,
        p_gate: gate ?? null,
      },
    );
    if (error) {
      if (error.code === '40001')
        throw new DomainConflictException({
          message: 'Content or review changed; reload before deciding',
        });
      if (error.code === 'P0002')
        throw new DomainNotFoundException({ message: 'Post not found' });
      if (error.code === '23514')
        throw new DomainValidationException({
          message: 'Channel review requirements not satisfied',
          field: 'review',
        });
      throw new DatabaseException({
        message: 'Unable to persist channel review',
        context: { operation: 'reviewSocialPost', sourceCode: error.code },
      });
    }
    const expectedState =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : null;
    if (
      !data ||
      typeof data !== 'object' ||
      data.id !== postId ||
      data.content_revision !== target.content_revision ||
      data.review_version !== target.review_version + 1 ||
      !data.channel_reviews?.[target.channel] ||
      data.channel_reviews[target.channel].content_revision !==
        target.content_revision ||
      data.channel_reviews[target.channel].actor !== actor ||
      (expectedState &&
        data.channel_reviews[target.channel].state !== expectedState)
    ) {
      throw new DatabaseException({
        message: 'Missing persisted channel review',
      });
    }
    return data as SocialPost;
  }

  async getPostHistory(postId: number): Promise<
    Array<{
      content_revision: number;
      review_version: number;
      snapshot: SocialPost;
      recorded_at: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from('__marketing_social_post_history')
      .select('content_revision,review_version,snapshot,recorded_at')
      .eq('post_id', postId)
      .order('content_revision', { ascending: false })
      .order('review_version', { ascending: false })
      .limit(50);
    if (error)
      throw new DatabaseException({
        message: 'Unable to load content history',
        context: { operation: 'getPostHistory', sourceCode: error.code },
      });
    return data ?? [];
  }

  async getApprovedPostsByChannel(
    weekIso: string,
    channel: SocialChannel,
  ): Promise<SocialPost[]> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .select('*')
      .eq('week_iso', weekIso)
      .contains('channels_list', [channel])
      .not('status', 'in', '(published,archived)')
      .eq(`channel_reviews->${channel}->>state`, 'approved')
      .order('day_of_week', { ascending: true });

    if (error) {
      this.logger.error(`getApprovedPostsByChannel failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to load approved posts',
        context: {
          operation: 'getApprovedPostsByChannel',
          sourceCode: error.code,
        },
      });
    }
    return ((data ?? []) as SocialPost[]).filter(
      (post) =>
        post.channels?.[channel] &&
        post.channel_reviews?.[channel]?.state === 'approved' &&
        post.channel_reviews[channel]?.content_revision ===
          post.content_revision,
    );
  }

  /**
   * Anti-duplication: gamme IDs posted in last N days.
   */
  async getRecentGammeIds(days: number = 28): Promise<number[]> {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .select('gamme_id')
      .not('gamme_id', 'is', null)
      .in('status', ['approved', 'published'])
      .gte('created_at', cutoff);

    if (error) {
      this.logger.error(`getRecentGammeIds failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to load marketing history',
        context: { operation: 'getRecentGammeIds', sourceCode: error.code },
      });
    }
    const ids = (data ?? []).map((r: { gamme_id: number }) => r.gamme_id);
    return Array.from(new Set(ids));
  }

  // ── Weekly Plans ──

  async upsertWeeklyPlan(
    plan: Partial<WeeklyPlan> & { week_iso: string },
  ): Promise<WeeklyPlan | null> {
    const { data, error } = await this.supabase
      .from('__marketing_weekly_plans')
      .upsert(plan, { onConflict: 'week_iso' })
      .select()
      .single();

    if (error) {
      this.logger.error(`upsertWeeklyPlan failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to persist marketing plan',
        context: { operation: 'upsertWeeklyPlan', sourceCode: error.code },
      });
    }
    return data as WeeklyPlan;
  }

  async getWeeklyPlan(weekIso: string): Promise<WeeklyPlan | null> {
    const { data, error } = await this.supabase
      .from('__marketing_weekly_plans')
      .select('*')
      .eq('week_iso', weekIso)
      .maybeSingle();

    if (error)
      throw new DatabaseException({
        message: 'Unable to load marketing plan',
        context: { operation: 'getWeeklyPlan', sourceCode: error.code },
      });
    return data as WeeklyPlan;
  }

  // ── Brand Rules ──

  async getActiveBrandRules(channel?: SocialChannel): Promise<BrandRule[]> {
    let query = this.supabase
      .from('__marketing_brand_rules')
      .select('*')
      .eq('active', true);

    // Get rules for specific channel + global rules (channel IS NULL)
    if (channel) {
      query = query.or(`channel.eq.${channel},channel.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getActiveBrandRules failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to load brand rules',
        context: { operation: 'getActiveBrandRules', sourceCode: error.code },
      });
    }
    return (data ?? []) as BrandRule[];
  }

  // ── Gamme Resolution ──

  async resolveGammeAlias(alias: string): Promise<PriorityGamme | null> {
    const { data, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_alias', alias)
      .eq('pg_display', '1')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new DatabaseException({
        message: 'Unable to resolve marketing gamme',
        context: { operation: 'resolveGammeAlias', sourceCode: error.code },
      });
    }
    if (!data) {
      this.logger.warn(`resolveGammeAlias: no gamme found for "${alias}"`);
      return null;
    }

    return {
      pg_id: data.pg_id as number,
      pg_alias: data.pg_alias as string,
      pg_name: data.pg_name as string,
      reason: 'manual',
    };
  }

  async getTopSeoGammes(limit: number = 8): Promise<PriorityGamme[]> {
    const { data, error } = await this.supabase
      .from('__seo_gamme')
      .select('gamme_id, sg_title')
      .not('sg_title', 'is', null)
      .limit(limit * 2);

    if (error) {
      throw new DatabaseException({
        message: 'Unable to load marketing SEO sources',
        context: { operation: 'getTopSeoGammes', sourceCode: error.code },
      });
    }
    if (!data || data.length === 0) {
      return [];
    }

    const gammeIds = (
      data as Array<{ gamme_id: number; sg_title: string }>
    ).map((r) => r.gamme_id);

    const { data: gammes, error: gErr } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', gammeIds)
      .eq('pg_display', '1')
      .limit(limit);

    if (gErr) {
      throw new DatabaseException({
        message: 'Unable to load marketing catalogue sources',
        context: {
          operation: 'getTopSeoGammes.catalogue',
          sourceCode: gErr.code,
        },
      });
    }
    if (!gammes) return [];

    return (
      gammes as Array<{ pg_id: number; pg_alias: string; pg_name: string }>
    )
      .filter((g) => g.pg_alias && g.pg_alias.length > 0)
      .slice(0, limit)
      .map((g) => ({
        pg_id: g.pg_id,
        pg_alias: g.pg_alias,
        pg_name: g.pg_name,
        reason: 'high_traffic' as const,
      }));
  }

  // ── UTM Registry ──

  async registerUTM(params: {
    utm_campaign: string;
    utm_source: string;
    utm_medium: string;
    utm_content?: string;
    social_post_id?: number;
    target_url: string;
  }): Promise<boolean> {
    const { error } = await this.supabase
      .from('__marketing_utm_registry')
      .upsert(params, {
        onConflict: 'utm_campaign,utm_source,utm_medium,utm_content,target_url',
      });

    if (error) {
      this.logger.error(`registerUTM failed: ${error.message}`);
      return false;
    }
    return true;
  }
}
