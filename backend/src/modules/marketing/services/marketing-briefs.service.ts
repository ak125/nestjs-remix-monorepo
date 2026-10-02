/**
 * MarketingBriefsService — CRUD __marketing_brief table.
 *
 * Phase 1 ADR-036 — backend service pour l'admin UI :
 *   - listBriefs(filters) : pagination + filtres business_unit / status / agent_id
 *   - getBriefById(id) : fetch unique
 *   - updateBriefStatus(id, status, reviewer) : workflow validation humaine
 *
 * Pattern miroir de MarketingDataService (extends SupabaseBaseService) +
 * RPC Gate. Le service impose le workflow et ses préconditions métier.
 *
 * RGPD : pas de filtre cst_marketing_consent_at ici (briefs ne contiennent pas
 * de PII utilisateur — juste agent_id + payload). Le filtre RGPD s'applique
 * côté agent quand il query __orders/users pour bâtir le brief, pas ici.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { BrandComplianceGateService } from './brand-compliance-gate.service';
import type { MarketingBriefRow } from '../interfaces/marketing.interfaces';
import { MARKETING_BRIEF_MAX_PAGE_SIZE } from '../dto/marketing-brief.dto';
export type { MarketingBriefRow } from '../interfaces/marketing.interfaces';

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

  constructor(
    rpcGate: RpcGateService,
    private readonly brandGate: BrandComplianceGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /** Liste paginée des briefs (admin UI). */
  async listBriefs(filters: BriefFilters): Promise<PaginatedBriefs> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(filters.limit || 20, MARKETING_BRIEF_MAX_PAGE_SIZE);
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
      throw new ServiceUnavailableException('Brief storage unavailable');
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
      .maybeSingle();

    if (error) {
      this.logger.error(`getBriefById failed: ${error.message}`);
      throw new ServiceUnavailableException('Brief storage unavailable');
    }
    if (!data) throw new NotFoundException(`Brief ${id} not found`);

    return data as unknown as MarketingBriefRow;
  }

  /**
   * Update le status (workflow validation humaine).
   * Server-side state machine; published records a manual declaration only.
   * Compare-and-set prevents overwriting a concurrent review/content update.
   */
  async updateBriefStatus(
    id: string,
    nextStatus: 'reviewed' | 'approved' | 'published' | 'archived',
    actor: string,
  ): Promise<MarketingBriefRow> {
    if (typeof actor !== 'string' || !actor.trim()) {
      throw new ForbiddenException('Authenticated reviewer identity required');
    }
    const brief = await this.getBriefById(id);
    const allowed: Record<MarketingBriefRow['status'], readonly string[]> = {
      draft: ['reviewed', 'archived'],
      reviewed: ['approved', 'archived'],
      approved: ['published', 'archived'],
      published: ['archived'],
      archived: [],
    };
    if (!allowed[brief.status]?.includes(nextStatus)) {
      throw new ConflictException('Invalid brief status transition');
    }
    if (nextStatus !== 'archived') {
      await this.brandGate.assertBriefCanProgress(brief);
    }
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
      .eq('status', brief.status)
      .eq('updated_at', brief.updated_at)
      .select('*')
      .maybeSingle();

    if (error) {
      this.logger.error(`updateBriefStatus ${id} failed: ${error.message}`);
      throw new ServiceUnavailableException('Brief storage unavailable');
    }
    if (!data)
      throw new ConflictException('Brief changed; reload before retrying');

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
      throw new ServiceUnavailableException('Brief storage unavailable');
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
