/**
 * MarketingBriefsService — CRUD __marketing_brief table.
 *
 * Phase 1 ADR-036 — backend service pour l'admin UI :
 *   - listBriefs(filters) : pagination + filtres business_unit / status / agent_id
 *   - getBriefById(id) : fetch unique
 *   - updateBriefStatus(id, status, reviewer) : workflow validation humaine
 *
 * Pattern miroir de MarketingDataService (extends SupabaseBaseService) +
 * RPC Gate. Pas de validation métier ici (DTO Zod côté controller s'en charge).
 *
 * RGPD : pas de filtre cst_marketing_consent_at ici (briefs ne contiennent pas
 * de PII utilisateur — juste agent_id + payload). Le filtre RGPD s'applique
 * côté agent quand il query __orders/users pour bâtir le brief, pas ici.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';

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
      this.logger.error(`listBriefs failed: ${error.message}`);
      throw new Error(`Failed to list briefs: ${error.message}`);
    }

    return {
      items: (data || []) as unknown as MarketingBriefRow[],
      total: count || 0,
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
      .single();

    if (error) {
      this.logger.warn(`getBriefById ${id} not found: ${error.message}`);
      throw new NotFoundException(`Brief ${id} not found`);
    }

    return data as unknown as MarketingBriefRow;
  }

  /**
   * Update le status (workflow validation humaine).
   * Phase 1 — pas de transition strict checking (admin UI gère la cohérence).
   */
  async updateBriefStatus(
    id: string,
    nextStatus: 'reviewed' | 'approved' | 'published' | 'archived',
    actor: string,
  ): Promise<MarketingBriefRow> {
    const update: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'reviewed') {
      update.reviewed_by = actor;
      update.reviewed_at = new Date().toISOString();
    } else if (nextStatus === 'approved') {
      update.approved_by = actor;
      update.approved_at = new Date().toISOString();
    } else if (nextStatus === 'published') {
      update.published_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('__marketing_brief')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`updateBriefStatus ${id} failed: ${error.message}`);
      throw new Error(`Failed to update brief: ${error.message}`);
    }

    return data as unknown as MarketingBriefRow;
  }

  /** Stats simples pour dashboard (compteur par status × business_unit). */
  async getBriefStats(): Promise<{
    by_status: Record<string, number>;
    by_business_unit: Record<string, number>;
    total: number;
  }> {
    const { data, error } = await this.supabase
      .from('__marketing_brief')
      .select('status,business_unit');

    if (error) {
      this.logger.error(`getBriefStats failed: ${error.message}`);
      return { by_status: {}, by_business_unit: {}, total: 0 };
    }

    const rows = (data || []) as Array<{
      status: string;
      business_unit: string;
    }>;
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
