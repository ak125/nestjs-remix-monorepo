import type { SocialReviewTarget } from '../dto/social-review.dto';
import type { SocialPublicationTarget } from '../dto/social-publication.dto';
import { Injectable, Logger } from '@nestjs/common';
import {
  DatabaseException,
  DomainConflictException,
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import type { RpcGateContext } from '@security/rpc-gate/rpc-gate.types';
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

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  private reviewRpcContext(actor: string): RpcGateContext {
    return {
      source: 'admin',
      userId: actor,
      role: this.isReadOnlyMode
        ? 'anon'
        : this.isDevKillSwitchEnabled
          ? 'dev_readonly'
          : 'service_role',
    };
  }

  // ── Social Posts ──

  async getPostById(postId: number): Promise<SocialPost | null> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();
    if (error) {
      this.logger.error(`getPostById failed: ${error.message}`);
      throw new DatabaseException({ message: 'Unable to read marketing post' });
    }
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
      return null;
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
        message: 'Unable to read marketing posts',
      });
    }
    return (data ?? []) as SocialPost[];
  }

  async updatePostStatus(
    postId: number,
    status: PostStatus,
    extra?: Partial<SocialPost>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('__marketing_social_posts')
      .update({ status, ...extra })
      .eq('id', postId);

    if (error) {
      this.logger.error(`updatePostStatus failed: ${error.message}`);
      return false;
    }
    return true;
  }

  async updatePostGates(
    postId: number,
    gateSummary: GateSummary,
    qualityScore: number,
  ): Promise<boolean> {
    const newStatus = gateSummary.can_approve ? 'gate_passed' : 'gate_failed';
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .update({
        brand_gate_level: gateSummary.brand.level,
        compliance_gate_level: gateSummary.compliance.level,
        gate_summary: gateSummary,
        quality_score: qualityScore,
        status: newStatus,
      })
      .eq('id', postId)
      .select('id')
      .maybeSingle();

    if (error) {
      this.logger.error(`updatePostGates failed: ${error.message}`);
      return false;
    }
    return data?.id === postId;
  }

  async reviewSocialPost(
    postId: number,
    target: SocialReviewTarget,
    action: 'gate' | 'approve' | 'reject',
    actor: string,
    gate?: GateSummary,
  ): Promise<SocialPost> {
    const { data, error } = await this.callRpc<SocialPost>(
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
      this.reviewRpcContext(actor),
    );
    if (error) {
      const code = 'code' in error ? error.code : undefined;
      if (code === '40001')
        throw new DomainConflictException({
          message: 'Content or review changed; reload before deciding',
        });
      if (code === 'P0002')
        throw new DomainNotFoundException({ message: 'Post not found' });
      if (code === '23514')
        throw new DomainValidationException({
          message: 'Channel review requirements not satisfied',
          field: 'review',
        });
      throw new DatabaseException({
        message: 'Unable to persist channel review',
        context: { operation: 'reviewSocialPost', sourceCode: code },
      });
    }
    const expectedState =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : gate?.can_approve &&
              gate.brand.level !== 'FAIL' &&
              gate.compliance.level !== 'FAIL' &&
              !gate.blocking_issues.length
            ? 'gate_passed'
            : 'gate_failed';
    if (
      !data ||
      typeof data !== 'object' ||
      data.id !== postId ||
      data.content_revision !== target.content_revision ||
      data.review_version !== target.review_version + 1 ||
      !data.channel_reviews?.[target.channel] ||
      (action === 'approve' &&
        !/^[a-f0-9]{64}$/.test(
          data.channel_reviews[target.channel].approved_content_hash ?? '',
        )) ||
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

  async declarePublication(
    postId: number,
    target: SocialPublicationTarget,
    actor: string,
  ): Promise<SocialPost> {
    const { data, error } = await this.callRpc<SocialPost>(
      'declare_marketing_social_publication',
      {
        p_post_id: postId,
        p_channel: target.channel,
        p_content_revision: target.content_revision,
        p_review_version: target.review_version,
        p_content_hash: target.approved_content_hash,
        p_url: target.url,
        p_actor: actor,
      },
      this.reviewRpcContext(actor),
    );
    if (error) {
      const code = 'code' in error ? error.code : undefined;
      if (code === '40001')
        throw new DomainConflictException({
          message:
            'Content, review or publication changed; reload before declaring',
        });
      if (code === 'P0002')
        throw new DomainNotFoundException({ message: 'Post not found' });
      if (code === '23514')
        throw new DomainValidationException({
          message: 'Current channel approval and publication evidence required',
          field: 'publication',
        });
      throw new DatabaseException({
        message: 'Unable to persist publication evidence',
        context: { sourceCode: code },
      });
    }
    const proof = data?.publications?.[target.channel];
    if (
      !data ||
      data.id !== postId ||
      data.content_revision !== target.content_revision ||
      !Number.isSafeInteger(data.review_version) ||
      data.review_version < target.review_version ||
      proof?.content_revision !== target.content_revision ||
      proof?.url !== target.url ||
      proof?.content_hash !== target.approved_content_hash ||
      !proof?.declared_by ||
      !proof?.declared_at
    ) {
      throw new DatabaseException({
        message: 'Missing persisted publication evidence',
      });
    }
    return data as SocialPost;
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
      .in('status', ['gate_passed', 'approved'])
      .order('day_of_week', { ascending: true });

    if (error) {
      this.logger.error(`getApprovedPostsByChannel failed: ${error.message}`);
      throw new DatabaseException({
        message: 'Unable to read approved marketing posts',
      });
    }
    return (data ?? []) as SocialPost[];
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
  ): Promise<WeeklyPlan> {
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
    if (data?.id == null || data.week_iso !== plan.week_iso) {
      throw new DatabaseException({
        message: 'Marketing plan write was not confirmed',
        context: { operation: 'upsertWeeklyPlan', weekIso: plan.week_iso },
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

    if (error) {
      this.logger.error(`getWeeklyPlan failed: ${error.message}`);
      throw new DatabaseException({ message: 'Unable to read marketing plan' });
    }
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
        message: 'Unable to read active brand rules',
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

  /** Content presence only; this selection does not measure or rank traffic. */
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
        reason: 'seo_content' as const,
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
    const { data, error } = await this.supabase
      .from('__marketing_utm_registry')
      .upsert(params, {
        onConflict: 'utm_campaign,utm_source,utm_medium,utm_content,target_url',
      })
      .select('id')
      .maybeSingle();

    if (error) {
      this.logger.error(`registerUTM failed: ${error.message}`);
      return false;
    }
    return data?.id != null;
  }
}
