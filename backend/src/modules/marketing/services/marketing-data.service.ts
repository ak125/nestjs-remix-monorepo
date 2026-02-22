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
  CoverageAnalysisV2,
  GammeGapV2,
  GammePipelineStatus,
  PipelineRunStatus,
  PipelineStatusResult,
} from '../interfaces/marketing.interfaces';

/** Safe parseInt — returns null for non-numeric values */
const toInt = (v: unknown): number | null => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

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

  async getContentCoverage(): Promise<CoverageAnalysisV2> {
    // 7 parallel queries — includes pipeline-generated content tables
    const [
      gammes,
      seoConseilRows,
      seoGuideRows,
      blogAdviceRows,
      references,
      observables,
      roadmapItems,
    ] = await Promise.all([
      this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_level', '1'),
      this.supabase.from('__seo_gamme_conseil').select('sgc_pg_id'),
      this.supabase.from('__seo_gamme_purchase_guide').select('sgpg_pg_id'),
      this.supabase.from('__blog_advice').select('ba_pg_id'),
      this.supabase.from('__seo_reference').select('pg_id'),
      this.supabase.from('__seo_observable').select('related_gammes'),
      this.supabase.from('__marketing_content_roadmap').select('pg_id'),
    ]);

    const allGammes = gammes.data || [];

    // Build Sets with parseInt to fix TEXT vs INTEGER mismatch
    const conseilSeoPgIds = new Set<number>();
    for (const r of seoConseilRows.data || []) {
      const id = toInt((r as any).sgc_pg_id);
      if (id !== null) conseilSeoPgIds.add(id);
    }

    const purchaseGuidePgIds = new Set<number>();
    for (const r of seoGuideRows.data || []) {
      const id = toInt((r as any).sgpg_pg_id);
      if (id !== null) purchaseGuidePgIds.add(id);
    }

    const blogAdvicePgIds = new Set<number>();
    for (const r of blogAdviceRows.data || []) {
      const id = toInt((r as any).ba_pg_id);
      if (id !== null) blogAdvicePgIds.add(id);
    }

    const refPgIds = new Set<number>();
    for (const r of references.data || []) {
      const id = toInt((r as any).pg_id);
      if (id !== null) refPgIds.add(id);
    }

    const roadmapPgIds = new Set<number>();
    for (const r of roadmapItems.data || []) {
      const id = toInt((r as any).pg_id);
      if (id !== null) roadmapPgIds.add(id);
    }

    const diagPgIds = new Set<number>();
    for (const obs of observables.data || []) {
      if (obs.related_gammes) {
        for (const pgId of obs.related_gammes) {
          const id = toInt(pgId);
          if (id !== null) diagPgIds.add(id);
        }
      }
    }

    const hasAdvice = (pgId: number) =>
      conseilSeoPgIds.has(pgId) || blogAdvicePgIds.has(pgId);

    const gaps: GammeGapV2[] = [];
    let withAdvice = 0,
      withConseilSeo = 0,
      withPurchaseGuide = 0,
      withRef = 0,
      withDiag = 0,
      withRoadmap = 0;

    for (const g of allGammes) {
      const gHasAdvice = hasAdvice(g.pg_id);
      const gHasConseilSeo = conseilSeoPgIds.has(g.pg_id);
      const gHasPurchaseGuide = purchaseGuidePgIds.has(g.pg_id);
      const gHasRef = refPgIds.has(g.pg_id);
      const gHasDiag = diagPgIds.has(g.pg_id);
      const gHasRoadmap = roadmapPgIds.has(g.pg_id);

      if (gHasAdvice) withAdvice++;
      if (gHasConseilSeo) withConseilSeo++;
      if (gHasPurchaseGuide) withPurchaseGuide++;
      if (gHasRef) withRef++;
      if (gHasDiag) withDiag++;
      if (gHasRoadmap) withRoadmap++;

      if (!gHasAdvice || !gHasRef || !gHasDiag) {
        gaps.push({
          pg_id: g.pg_id,
          pg_name: g.pg_name,
          pg_alias: g.pg_alias,
          has_advice: gHasAdvice,
          has_reference: gHasRef,
          has_diagnostic: gHasDiag,
          has_roadmap: gHasRoadmap,
          has_conseil_seo: gHasConseilSeo,
          has_purchase_guide: gHasPurchaseGuide,
        });
      }
    }

    const totalGammes = allGammes.length;
    const coveredCount = allGammes.filter(
      (g) =>
        hasAdvice(g.pg_id) || refPgIds.has(g.pg_id) || diagPgIds.has(g.pg_id),
    ).length;

    return {
      total_gammes: totalGammes,
      gammes_with_advice: withAdvice,
      gammes_with_conseil_seo: withConseilSeo,
      gammes_with_purchase_guide: withPurchaseGuide,
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

  async getPipelineStatus(): Promise<PipelineStatusResult> {
    type PageType =
      | 'R1_pieces'
      | 'R3_conseils'
      | 'R3_guide_achat'
      | 'R4_reference';

    const [gammes, pipelineRows] = await Promise.all([
      this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_level', '1'),
      this.supabase
        .from('__rag_content_refresh_log')
        .select('pg_id, page_type, status, completed_at')
        .order('completed_at', { ascending: false }),
    ]);

    // Content presence sets (same pattern as getContentCoverage)
    const [
      seoConseilRows,
      seoGuideRows,
      blogAdviceRows,
      references,
      observables,
    ] = await Promise.all([
      this.supabase.from('__seo_gamme_conseil').select('sgc_pg_id'),
      this.supabase.from('__seo_gamme_purchase_guide').select('sgpg_pg_id'),
      this.supabase.from('__blog_advice').select('ba_pg_id'),
      this.supabase.from('__seo_reference').select('pg_id'),
      this.supabase.from('__seo_observable').select('related_gammes'),
    ]);

    const conseilPgIds = new Set<number>();
    for (const r of seoConseilRows.data || []) {
      const id = toInt((r as any).sgc_pg_id);
      if (id !== null) conseilPgIds.add(id);
    }
    const blogPgIds = new Set<number>();
    for (const r of blogAdviceRows.data || []) {
      const id = toInt((r as any).ba_pg_id);
      if (id !== null) blogPgIds.add(id);
    }
    const purchasePgIds = new Set<number>();
    for (const r of seoGuideRows.data || []) {
      const id = toInt((r as any).sgpg_pg_id);
      if (id !== null) purchasePgIds.add(id);
    }
    const refPgIds = new Set<number>();
    for (const r of references.data || []) {
      const id = toInt((r as any).pg_id);
      if (id !== null) refPgIds.add(id);
    }
    const diagPgIds = new Set<number>();
    for (const obs of observables.data || []) {
      if (obs.related_gammes) {
        for (const pgId of obs.related_gammes) {
          const id = toInt(pgId);
          if (id !== null) diagPgIds.add(id);
        }
      }
    }

    // Pivot: key = "pg_id|page_type" → latest status (first seen = most recent)
    const statusMap = new Map<string, PipelineRunStatus>();
    const lastRunMap = new Map<number, string>();

    for (const row of pipelineRows.data || []) {
      const pgId = toInt((row as any).pg_id);
      const pt = (row as any).page_type as PageType;
      if (!pgId || !pt) continue;

      const key = `${pgId}|${pt}`;
      if (!statusMap.has(key)) {
        statusMap.set(key, (row as any).status as PipelineRunStatus);
      }

      const completedAt = (row as any).completed_at as string | null;
      if (completedAt) {
        const current = lastRunMap.get(pgId);
        if (!current || completedAt > current) {
          lastRunMap.set(pgId, completedAt);
        }
      }
    }

    const pick = (pgId: number, pt: PageType): PipelineRunStatus =>
      statusMap.get(`${pgId}|${pt}`) ?? null;

    const computeOverall = (
      statuses: PipelineRunStatus[],
    ): GammePipelineStatus['pipeline_overall'] => {
      const nonNull = statuses.filter(Boolean);
      if (nonNull.length === 0) return 'pending';
      if (nonNull.some((s) => s === 'auto_published' || s === 'published'))
        return 'published';
      if (nonNull.some((s) => s === 'failed')) return 'failed';
      if (nonNull.some((s) => s === 'draft')) return 'in_progress';
      if (nonNull.every((s) => s === 'skipped')) return 'skipped';
      return 'pending';
    };

    const summary = {
      total: 0,
      published: 0,
      in_progress: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };

    const gammeResults: GammePipelineStatus[] = (gammes.data || []).map((g) => {
      const r1 = pick(g.pg_id, 'R1_pieces');
      const r3c = pick(g.pg_id, 'R3_conseils');
      const r3g = pick(g.pg_id, 'R3_guide_achat');
      const r4 = pick(g.pg_id, 'R4_reference');
      const overall = computeOverall([r1, r3c, r3g, r4]);

      summary.total++;
      summary[overall]++;

      return {
        pg_id: g.pg_id,
        pg_name: g.pg_name,
        pg_alias: g.pg_alias,
        r1_pieces: r1,
        r3_conseils: r3c,
        r3_guide_achat: r3g,
        r4_reference: r4,
        has_conseil: conseilPgIds.has(g.pg_id) || blogPgIds.has(g.pg_id),
        has_purchase_guide: purchasePgIds.has(g.pg_id),
        has_reference: refPgIds.has(g.pg_id),
        has_diagnostic: diagPgIds.has(g.pg_id),
        pipeline_last_run: lastRunMap.get(g.pg_id) ?? null,
        pipeline_overall: overall,
      };
    });

    return { gammes: gammeResults, summary };
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
