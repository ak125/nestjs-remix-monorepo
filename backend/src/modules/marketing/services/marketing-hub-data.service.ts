import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
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
      return [];
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
    const { error } = await this.supabase
      .from('__marketing_social_posts')
      .update({
        brand_gate_level: gateSummary.brand.level,
        compliance_gate_level: gateSummary.compliance.level,
        gate_summary: gateSummary,
        quality_score: qualityScore,
        status: newStatus,
      })
      .eq('id', postId);

    if (error) {
      this.logger.error(`updatePostGates failed: ${error.message}`);
      return false;
    }
    return true;
  }

  async getApprovedPostsByChannel(
    weekIso: string,
    channel: SocialChannel,
  ): Promise<SocialPost[]> {
    const { data, error } = await this.supabase
      .from('__marketing_social_posts')
      .select('*')
      .eq('week_iso', weekIso)
      .eq('primary_channel', channel)
      .eq('status', 'approved')
      .order('day_of_week', { ascending: true });

    if (error) {
      this.logger.error(`getApprovedPostsByChannel failed: ${error.message}`);
      return [];
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
      return [];
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
      return null;
    }
    return data as WeeklyPlan;
  }

  async getWeeklyPlan(weekIso: string): Promise<WeeklyPlan | null> {
    const { data, error } = await this.supabase
      .from('__marketing_weekly_plans')
      .select('*')
      .eq('week_iso', weekIso)
      .single();

    if (error) return null;
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
      return [];
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
      .single();

    if (error || !data) {
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

    if (error || !data || data.length === 0) {
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

    if (gErr || !gammes) return [];

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
