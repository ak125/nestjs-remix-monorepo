import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import {
  MarketingBacklink,
  BacklinkFilters,
  BacklinkStats,
  PaginatedResult,
  MarketingContentRoadmap,
  RoadmapFilters,
  MarketingKpiSnapshot,
  CoverageAnalysis,
  GammeGap,
} from '../interfaces/marketing.interfaces';

@Injectable()
export class MarketingDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(MarketingDataService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  // --- Backlinks ---
  async getBacklinks(
    filters: BacklinkFilters,
  ): Promise<PaginatedResult<MarketingBacklink>> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('__marketing_backlinks')
      .select('*', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.min_da) query = query.gte('da_score', filters.min_da);
    if (filters.domain)
      query = query.ilike('source_domain', `%${filters.domain}%`);
    if (filters.source_category)
      query = query.eq('source_category', filters.source_category);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      this.logger.error('Error fetching backlinks:', error);
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getBacklinkStats(): Promise<BacklinkStats> {
    const { data, error } = await this.supabase
      .from('__marketing_backlinks')
      .select('status, da_score, source_domain, source_category');

    if (error || !data) {
      return {
        total: 0,
        live: 0,
        lost: 0,
        pending: 0,
        broken: 0,
        da30plus: 0,
        uniqueDomains: 0,
        byCategory: {},
      };
    }

    const stats: BacklinkStats = {
      total: data.length,
      live: 0,
      lost: 0,
      pending: 0,
      broken: 0,
      da30plus: 0,
      uniqueDomains: 0,
      byCategory: {},
    };
    const domains = new Set<string>();

    for (const row of data) {
      if (row.status === 'live') stats.live++;
      else if (row.status === 'lost') stats.lost++;
      else if (row.status === 'pending') stats.pending++;
      else if (row.status === 'broken') stats.broken++;
      if ((row.da_score || 0) >= 30) stats.da30plus++;
      if (row.source_domain) domains.add(row.source_domain);
      const cat = row.source_category || 'other';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    }
    stats.uniqueDomains = domains.size;
    return stats;
  }

  async createBacklink(
    data: Partial<MarketingBacklink>,
  ): Promise<MarketingBacklink | null> {
    const { data: result, error } = await this.supabase
      .from('__marketing_backlinks')
      .insert(data)
      .select()
      .single();
    if (error) {
      this.logger.error('Error creating backlink:', error);
      return null;
    }
    return result;
  }

  async createBacklinks(items: Partial<MarketingBacklink>[]): Promise<number> {
    const { data, error } = await this.supabase
      .from('__marketing_backlinks')
      .insert(items)
      .select('id');
    if (error) {
      this.logger.error('Error bulk creating backlinks:', error);
      return 0;
    }
    return data?.length || 0;
  }

  async updateBacklink(
    id: number,
    updates: Partial<MarketingBacklink>,
  ): Promise<MarketingBacklink | null> {
    const { data, error } = await this.supabase
      .from('__marketing_backlinks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      this.logger.error('Error updating backlink:', error);
      return null;
    }
    return data;
  }

  async deleteBacklink(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('__marketing_backlinks')
      .delete()
      .eq('id', id);
    return !error;
  }

  // --- Content Roadmap ---
  async getContentRoadmap(
    filters: RoadmapFilters,
  ): Promise<PaginatedResult<MarketingContentRoadmap>> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('__marketing_content_roadmap')
      .select('*', { count: 'exact' });

    if (filters.content_type)
      query = query.eq('content_type', filters.content_type);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.status) query = query.eq('status', filters.status);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      this.logger.error('Error fetching roadmap:', error);
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getContentCoverage(): Promise<CoverageAnalysis> {
    // Cross-table analysis
    const [gammes, adviceByPg, references, observables, roadmapItems] =
      await Promise.all([
        this.supabase
          .from('pieces_gamme')
          .select('pg_id, pg_name, pg_alias')
          .eq('pg_level', '1'),
        this.supabase.from('__blog_advice').select('ba_pg_id'),
        this.supabase.from('__seo_reference').select('pg_id'),
        this.supabase.from('__seo_observable').select('related_gammes'),
        this.supabase.from('__marketing_content_roadmap').select('pg_id'),
      ]);

    const allGammes = gammes.data || [];
    const advicePgIds = new Set(
      (adviceByPg.data || []).map((a: any) => a.ba_pg_id).filter(Boolean),
    );
    const refPgIds = new Set(
      (references.data || []).map((r: any) => r.pg_id).filter(Boolean),
    );
    const roadmapPgIds = new Set(
      (roadmapItems.data || []).map((r: any) => r.pg_id).filter(Boolean),
    );

    // Build diagnostic gamme set (related_gammes is an array)
    const diagPgIds = new Set<number>();
    for (const obs of observables.data || []) {
      if (obs.related_gammes) {
        for (const pgId of obs.related_gammes) diagPgIds.add(pgId);
      }
    }

    const gaps: GammeGap[] = [];
    let withAdvice = 0,
      withRef = 0,
      withDiag = 0,
      withRoadmap = 0;

    for (const g of allGammes) {
      const hasAdvice = advicePgIds.has(g.pg_id);
      const hasRef = refPgIds.has(g.pg_id);
      const hasDiag = diagPgIds.has(g.pg_id);
      const hasRoadmap = roadmapPgIds.has(g.pg_id);

      if (hasAdvice) withAdvice++;
      if (hasRef) withRef++;
      if (hasDiag) withDiag++;
      if (hasRoadmap) withRoadmap++;

      if (!hasAdvice || !hasRef || !hasDiag) {
        gaps.push({
          pg_id: g.pg_id,
          pg_name: g.pg_name,
          pg_alias: g.pg_alias,
          has_advice: hasAdvice,
          has_reference: hasRef,
          has_diagnostic: hasDiag,
          has_roadmap: hasRoadmap,
        });
      }
    }

    const totalGammes = allGammes.length;
    const coveredCount = allGammes.filter(
      (g) =>
        advicePgIds.has(g.pg_id) ||
        refPgIds.has(g.pg_id) ||
        diagPgIds.has(g.pg_id),
    ).length;

    return {
      total_gammes: totalGammes,
      gammes_with_advice: withAdvice,
      gammes_with_reference: withRef,
      gammes_with_diagnostic: withDiag,
      gammes_with_roadmap: withRoadmap,
      coverage_pct:
        totalGammes > 0 ? Math.round((coveredCount / totalGammes) * 100) : 0,
      gaps: gaps.sort(
        (a, b) => (a.has_advice ? 1 : 0) - (b.has_advice ? 1 : 0),
      ),
    };
  }

  async createRoadmapItem(
    data: Partial<MarketingContentRoadmap>,
  ): Promise<MarketingContentRoadmap | null> {
    const { data: result, error } = await this.supabase
      .from('__marketing_content_roadmap')
      .insert(data)
      .select()
      .single();
    if (error) {
      this.logger.error('Error creating roadmap item:', error);
      return null;
    }
    return result;
  }

  async updateRoadmapItem(
    id: number,
    updates: Partial<MarketingContentRoadmap>,
  ): Promise<MarketingContentRoadmap | null> {
    const { data, error } = await this.supabase
      .from('__marketing_content_roadmap')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      this.logger.error('Error updating roadmap item:', error);
      return null;
    }
    return data;
  }

  async deleteRoadmapItem(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('__marketing_content_roadmap')
      .delete()
      .eq('id', id);
    return !error;
  }

  // --- KPI Snapshots ---
  async getKpiTimeline(days: number = 90): Promise<MarketingKpiSnapshot[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const { data, error } = await this.supabase
      .from('__marketing_kpi_snapshots')
      .select('*')
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true });
    if (error) {
      this.logger.error('Error fetching KPI timeline:', error);
      return [];
    }
    return data || [];
  }

  async saveKpiSnapshot(
    snapshot: Partial<MarketingKpiSnapshot>,
  ): Promise<MarketingKpiSnapshot | null> {
    const { data, error } = await this.supabase
      .from('__marketing_kpi_snapshots')
      .upsert(
        {
          ...snapshot,
          snapshot_date:
            snapshot.snapshot_date || new Date().toISOString().split('T')[0],
        },
        { onConflict: 'snapshot_date' },
      )
      .select()
      .single();
    if (error) {
      this.logger.error('Error saving KPI snapshot:', error);
      return null;
    }
    return data;
  }

  // --- Dashboard aggregate ---
  async getDashboardStats(): Promise<{
    backlinks: any;
    outreach: any;
    content: any;
    campaigns: any;
  }> {
    const [blStats, outreachRes, roadmapRes, campaignRes] = await Promise.all([
      this.getBacklinkStats(),
      this.supabase.from('__marketing_outreach').select('status'),
      this.supabase.from('__marketing_content_roadmap').select('status'),
      this.supabase.from('__marketing_campaigns').select('status'),
    ]);

    const outreachData = outreachRes.data || [];
    const sent = outreachData.filter((o: any) => o.status !== 'draft').length;
    const accepted = outreachData.filter(
      (o: any) => o.status === 'accepted',
    ).length;

    const roadmapData = roadmapRes.data || [];
    const published = roadmapData.filter(
      (r: any) => r.status === 'published',
    ).length;

    const campaignData = campaignRes.data || [];
    const activeCampaigns = campaignData.filter(
      (c: any) => c.status === 'active',
    ).length;

    return {
      backlinks: {
        total: blStats.total,
        live: blStats.live,
        da30plus: blStats.da30plus,
        uniqueDomains: blStats.uniqueDomains,
      },
      outreach: {
        sent,
        accepted,
        responseRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
      },
      content: { total: roadmapData.length, published, coverage_pct: 0 },
      campaigns: { active: activeCampaigns, total: campaignData.length },
    };
  }
}
