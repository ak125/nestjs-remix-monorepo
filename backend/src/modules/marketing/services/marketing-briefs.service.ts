/**
 * MarketingBriefsService — CRUD __marketing_brief table.
 *
 * Phase 1 ADR-036 — backend service pour l'admin UI :
 *   - listBriefs(filters) : pagination + filtres business_unit / status / agent_id
 *   - getBriefById(id) : fetch unique
 *   - updateBriefStatus(id, status, reviewer) : workflow validation humaine
 *
 * Pattern miroir de MarketingDataService (extends SupabaseBaseService) +
 * RPC Gate. Le service applique les transitions et leurs prérequis métier.
 *
 * RGPD : pas de filtre cst_marketing_consent_at ici (briefs ne contiennent pas
 * de PII utilisateur — juste agent_id + payload). Le filtre RGPD s'applique
 * côté agent quand il query __orders/users pour bâtir le brief, pas ici.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import {
  DatabaseException,
  DomainConflictException,
  DomainValidationException,
} from '@common/exceptions';
import { MarketingBusinessUnit } from '@config/marketing-matrix.types';
import {
  MarketingBriefStatus,
  CreateMarketingBriefSchema,
  LinkBriefSocialDto,
} from '../dto/marketing-brief.dto';
import { z } from 'zod';

export interface MarketingBriefRow {
  id: string;
  agent_id: string;
  business_unit: 'ECOMMERCE' | 'LOCAL' | 'HYBRID';
  channel: string;
  conversion_goal: 'CALL' | 'VISIT' | 'QUOTE' | 'ORDER';
  cta: string;
  target_segment: string;
  payload: Record<string, unknown>;
  coverage_manifest: Record<string, unknown>;
  brand_gate_level: 'PASS' | 'WARN' | 'FAIL' | null;
  compliance_gate_level: 'PASS' | 'WARN' | 'FAIL' | null;
  gate_summary: Record<string, unknown> | null;
  status: 'draft' | 'reviewed' | 'approved' | 'published' | 'archived';
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  social_post_id: number | null;
  actual_impressions: number;
  actual_clicks: number;
  actual_calls: number;
  actual_visits: number;
  actual_quotes: number;
  actual_orders: number;
  actual_revenue_cents: number;
  performance_updated_at: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  generation_prompt_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefFilters {
  business_unit?: 'ECOMMERCE' | 'LOCAL' | 'HYBRID';
  status?: string;
  agent_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedBriefs {
  items: MarketingBriefRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class MarketingBriefsService extends SupabaseBaseService {
  protected override readonly logger = new Logger(MarketingBriefsService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  async linkSocialContent(
    id: string,
    target: LinkBriefSocialDto,
    actor: string,
  ) {
    const { data, error } = await this.supabase.rpc(
      'link_marketing_brief_social',
      {
        p_brief_id: id,
        p_post_id: target.post_id,
        p_expected_updated_at: target.expected_updated_at,
        p_content_revision: target.content_revision,
        p_review_version: target.review_version,
        p_actor: actor,
      },
    );
    if (error) {
      if (error.code === '40001')
        throw new DomainConflictException({
          message:
            'Brief, content or association changed; reload before linking',
        });
      if (error.code === 'P0002')
        throw new NotFoundException('Brief or social content not found');
      if (error.code === '23514')
        throw new DomainValidationException({
          message: 'Approved brief and compatible open content required',
          field: 'social_content',
        });
      throw new DatabaseException({
        message: 'Unable to associate brief and social content',
        context: { operation: 'linkSocialContent', sourceCode: error.code },
      });
    }
    const receipt = z
      .object({
        id: z.literal(target.post_id),
        week_iso: z.string().regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/),
        content_revision: z
          .number()
          .int()
          .safe()
          .min(target.content_revision + 1),
        review_version: z
          .number()
          .int()
          .safe()
          .min(target.review_version + 1),
        source_brief: z
          .object({
            brief: z
              .object({
                id: z.literal(id),
                updated_at: z.string().datetime({ offset: true }),
              })
              .passthrough(),
            linked_by: z.literal(actor),
            linked_content_revision: z.literal(target.content_revision + 1),
            input_content_revision: z.literal(target.content_revision),
            input_review_version: z.literal(target.review_version),
          })
          .passthrough(),
      })
      .safeParse(data);
    if (
      !receipt.success ||
      Date.parse(receipt.data.source_brief.brief.updated_at) !==
        Date.parse(target.expected_updated_at)
    )
      throw new DatabaseException({
        message: 'Brief association persistence not confirmed',
      });
    return receipt.data;
  }

  /** Liste paginée des briefs (admin UI). */
  async listBriefs(filters: BriefFilters): Promise<PaginatedBriefs> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('__marketing_brief')
      .select('*', { count: 'exact' });

    if (filters.business_unit) {
      query = query.eq('business_unit', filters.business_unit);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.agent_id) {
      query = query.eq('agent_id', filters.agent_id);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseException({
        message: 'Unable to load marketing briefs',
        context: { operation: 'listBriefs', sourceCode: error.code },
      });
    }
    if (
      !Array.isArray(data) ||
      !Number.isSafeInteger(count) ||
      count < data.length
    ) {
      throw new DatabaseException({
        message: 'Invalid marketing brief list response',
      });
    }

    return {
      items: data as unknown as MarketingBriefRow[],
      total: count,
      page,
      limit,
    };
  }

  /** Fetch un brief par id (admin UI détail). */
  async getBriefById(id: string): Promise<MarketingBriefRow> {
    const { data, error } = await this.supabase
      .from('__marketing_brief')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new DatabaseException({
        message: 'Unable to load marketing brief',
        context: { operation: 'getBriefById', sourceCode: error.code },
      });
    }
    if (data === null) throw new NotFoundException(`Brief ${id} not found`);

    return data as unknown as MarketingBriefRow;
  }

  /** Same policy for the detail screen and persisted decisions. */
  getReviewState(brief: MarketingBriefRow): {
    allowed_actions: Array<'reviewed' | 'approved' | 'archived'>;
    blocked_reason: string | null;
  } {
    if (brief.status === 'published' || brief.status === 'archived') {
      return {
        allowed_actions: [],
        blocked_reason: 'Ce brief est clôturé pour la revue.',
      };
    }
    if (brief.status === 'approved')
      return { allowed_actions: ['archived'], blocked_reason: null };
    if (brief.status !== 'draft' && brief.status !== 'reviewed') {
      return {
        allowed_actions: [],
        blocked_reason: 'Statut du brief non reconnu.',
      };
    }
    // Nullable database metadata corresponds to omitted optional creation fields.
    const content = CreateMarketingBriefSchema.safeParse({
      ...brief,
      social_post_id: brief.social_post_id ?? undefined,
      ai_provider: brief.ai_provider ?? undefined,
      ai_model: brief.ai_model ?? undefined,
      generation_prompt_hash: brief.generation_prompt_hash ?? undefined,
    });
    let blocked: string | null = null;
    if (!content.success)
      blocked = 'Le contenu du brief ne respecte pas le contrat métier.';
    else if (brief.status === 'reviewed') {
      if (
        !brief.reviewed_by?.trim() ||
        !z.string().datetime({ offset: true }).safeParse(brief.reviewed_at)
          .success
      ) {
        blocked = 'La preuve de revue est incomplète.';
      } else if (
        !['PASS', 'WARN'].includes(brief.brand_gate_level ?? '') ||
        !['PASS', 'WARN'].includes(brief.compliance_gate_level ?? '') ||
        brief.gate_summary?.can_approve !== true ||
        !Array.isArray(brief.gate_summary?.blocking_issues) ||
        brief.gate_summary.blocking_issues.length !== 0
      ) {
        blocked =
          'Les contrôles de marque et de conformité sont absents ou bloquants.';
      }
    }
    return {
      allowed_actions: blocked
        ? ['archived']
        : [brief.status === 'draft' ? 'reviewed' : 'approved', 'archived'],
      blocked_reason: blocked,
    };
  }

  /** Compare-and-set on the displayed version; publication has its own workflow. */
  async updateBriefStatus(
    id: string,
    nextStatus: 'reviewed' | 'approved' | 'published' | 'archived',
    actor: string,
    expectedUpdatedAt: string,
  ): Promise<MarketingBriefRow> {
    const current = await this.getBriefById(id);
    if (current.updated_at !== expectedUpdatedAt) {
      throw new DomainConflictException({
        message: 'Brief changed; reload before deciding',
      });
    }
    const transitionAllowed =
      (current.status === 'draft' && nextStatus === 'reviewed') ||
      (current.status === 'reviewed' && nextStatus === 'approved') ||
      (['draft', 'reviewed', 'approved'].includes(current.status) &&
        nextStatus === 'archived');
    if (!transitionAllowed)
      throw new DomainConflictException({
        message: 'Brief transition not allowed',
      });
    const review = this.getReviewState(current);
    if (!review.allowed_actions.some((action) => action === nextStatus)) {
      throw new DomainValidationException({
        message: review.blocked_reason ?? 'Brief review prerequisites missing',
      });
    }
    const update: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'reviewed') {
      update.reviewed_by = actor;
      update.reviewed_at = new Date().toISOString();
      update.approved_by = null;
      update.approved_at = null;
    } else if (nextStatus === 'approved') {
      update.approved_by = actor;
      update.approved_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('__marketing_brief')
      .update(update)
      .eq('id', id)
      .eq('status', current.status)
      .eq('updated_at', expectedUpdatedAt)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new DatabaseException({
        message: 'Unable to persist brief decision',
        context: { operation: 'updateBriefStatus', sourceCode: error.code },
      });
    }
    if (data === null)
      throw new DomainConflictException({
        message: 'Brief changed during review; reload before deciding',
      });

    return data as unknown as MarketingBriefRow;
  }

  /** Stats simples pour dashboard (compteur par status × business_unit). */
  async getBriefStats(): Promise<{
    by_status: Record<string, number>;
    by_business_unit: Record<string, number>;
    total: number;
  }> {
    const { data, count, error } = await this.supabase
      .from('__marketing_brief')
      .select('status,business_unit', { count: 'exact' });

    if (error) {
      throw new DatabaseException({
        message: 'Unable to load marketing brief statistics',
        context: { operation: 'getBriefStats', sourceCode: error.code },
      });
    }

    const result = z
      .array(
        z.object({
          status: z.nativeEnum(MarketingBriefStatus),
          business_unit: z.nativeEnum(MarketingBusinessUnit),
        }),
      )
      .safeParse(data);
    // PostgREST may cap returned rows. Never call a partial sample a total.
    if (!result.success || count !== result.data.length) {
      throw new DatabaseException({
        message: 'Incomplete marketing brief statistics',
      });
    }
    const rows = result.data;
    const by_status: Record<string, number> = {};
    const by_business_unit: Record<string, number> = {};

    for (const r of rows) {
      by_status[r.status] = (by_status[r.status] || 0) + 1;
      by_business_unit[r.business_unit] =
        (by_business_unit[r.business_unit] || 0) + 1;
    }

    return { by_status, by_business_unit, total: rows.length };
  }
}
