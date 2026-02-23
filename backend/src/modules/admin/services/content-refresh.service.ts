import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from '../../rag-proxy/events/rag-ingestion.events';
import type {
  ContentRefreshJobData,
  ContentRefreshJobDataR5,
} from '../../../workers/types/content-refresh.types';

/** Gamme-based page types (R5 is diagnostic-slug-based, handled separately) */
type GammePageType = ContentRefreshJobData['pageType'];

@Injectable()
export class ContentRefreshService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ContentRefreshService.name);

  constructor(
    configService: ConfigService,
    @InjectQueue('seo-monitor') private readonly seoMonitorQueue: Queue,
  ) {
    super(configService);
  }

  /**
   * Listener: triggered when RAG ingestion completes.
   * Detects affected gammes and queues content refresh jobs.
   */
  @OnEvent(RAG_INGESTION_COMPLETED)
  async onIngestionCompleted(event: RagIngestionCompletedEvent): Promise<void> {
    if (event.status !== 'done') return;

    const gammes = event.affectedGammes || [];
    if (gammes.length === 0) {
      this.logger.warn(
        `Ingestion completed (${event.jobId}) but no affected gammes detected`,
      );
      return;
    }

    this.logger.log(
      `RAG ingestion ${event.jobId} completed. Affected gammes: [${gammes.join(', ')}]. Queueing content refresh...`,
    );

    const gammesMap = event.affectedGammesMap || {};
    for (const pgAlias of gammes) {
      const supplementaryFiles = gammesMap[pgAlias] || [];
      await this.queueRefreshForGamme(
        pgAlias,
        event.jobId,
        `rag_${event.source}_ingest`,
        supplementaryFiles,
      );
    }

    // Queue R5 diagnostic refresh for affected diagnostic files
    const diagnostics = event.affectedDiagnostics || [];
    if (diagnostics.length > 0) {
      this.logger.log(
        `Affected diagnostics: [${diagnostics.join(', ')}]. Queueing R5 refresh...`,
      );
      for (const diagBaseName of diagnostics) {
        await this.queueRefreshForDiagnostic(
          diagBaseName,
          event.jobId,
          `rag_${event.source}_ingest`,
        );
      }
    }
  }

  /**
   * Queue content refresh jobs for a single gamme across all applicable page types.
   */
  async queueRefreshForGamme(
    pgAlias: string,
    triggerJobId: string,
    triggerSource: string,
    supplementaryFiles: string[] = [],
    force?: boolean,
  ): Promise<GammePageType[]> {
    // Resolve pg_alias → pg_id
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_alias', pgAlias)
      .eq('pg_display', '1')
      .single();

    if (!gamme) {
      this.logger.warn(`No active gamme found for alias: ${pgAlias}`);
      return [];
    }

    const pgId = gamme.pg_id as number;

    // Determine which page types need refresh
    const pageTypes = await this.determinePageTypes(pgId, pgAlias);

    // Queue a job for each page type
    const queued: GammePageType[] = [];
    for (const pageType of pageTypes) {
      const created = await this.createAndQueueJob(
        pgId,
        pgAlias,
        pageType,
        triggerJobId,
        triggerSource,
        supplementaryFiles,
        force,
      );
      if (created) queued.push(pageType);
    }

    this.logger.log(
      `Queued ${queued.length} refresh jobs for ${pgAlias}: [${queued.join(', ')}]`,
    );
    return queued;
  }

  /**
   * Queue R5 diagnostic refresh jobs for diagnostics matching a RAG file basename.
   * Looks up __seo_observable slugs whose cluster_id matches the file basename.
   */
  async queueRefreshForDiagnostic(
    ragFileBaseName: string,
    triggerJobId: string,
    triggerSource: string,
  ): Promise<string[]> {
    // Find observables whose cluster_id matches the RAG file name
    const { data: observables } = await this.client
      .from('__seo_observable')
      .select('slug')
      .eq('cluster_id', ragFileBaseName)
      .limit(50);

    if (!observables || observables.length === 0) {
      this.logger.debug(
        `No observables found for diagnostic RAG file: ${ragFileBaseName}`,
      );
      return [];
    }

    const queued: string[] = [];
    for (const obs of observables) {
      const slug = obs.slug as string;
      const created = await this.createAndQueueDiagnosticJob(
        slug,
        triggerJobId,
        triggerSource,
      );
      if (created) queued.push(slug);
    }

    this.logger.log(
      `Queued ${queued.length} R5 diagnostic refresh jobs for RAG file ${ragFileBaseName}: [${queued.join(', ')}]`,
    );
    return queued;
  }

  /**
   * Manual trigger: queue refresh for one or more gammes.
   */
  async triggerManualRefresh(
    pgAliases: string[],
    supplementaryFiles: string[] = [],
    force?: boolean,
  ): Promise<{
    queued: Array<{ pgAlias: string; pageTypes: GammePageType[] }>;
  }> {
    const results: Array<{ pgAlias: string; pageTypes: GammePageType[] }> = [];

    for (const pgAlias of pgAliases) {
      const pageTypes = await this.queueRefreshForGamme(
        pgAlias,
        'manual',
        'manual',
        supplementaryFiles,
        force,
      );
      results.push({ pgAlias, pageTypes });
    }

    return { queued: results };
  }

  /**
   * Get dashboard stats: counts by status + recent items.
   */
  async getDashboard(): Promise<{
    counts: Record<string, number>;
    recent: unknown[];
  }> {
    // Counts by status — use head queries to avoid PostgREST max-rows limit
    const statusKeys = [
      'draft',
      'auto_published',
      'skipped',
      'failed',
      'published',
    ];
    const results = await Promise.all(
      statusKeys.map((s) =>
        this.client
          .from('__rag_content_refresh_log')
          .select('*', { count: 'exact', head: true })
          .eq('status', s),
      ),
    );

    const counts: Record<string, number> = {};
    statusKeys.forEach((s, i) => {
      counts[s] = results[i].count || 0;
    });

    // Recent items
    const { data: recent } = await this.client
      .from('__rag_content_refresh_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return { counts, recent: recent || [] };
  }

  /**
   * Get refresh log entries with filters.
   */
  async getStatus(filters: {
    status?: string;
    page_type?: string;
    pg_alias?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: unknown[]; total: number }> {
    let query = this.client
      .from('__rag_content_refresh_log')
      .select('*', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.page_type) query = query.eq('page_type', filters.page_type);
    if (filters.pg_alias)
      query = query.ilike('pg_alias', `%${filters.pg_alias}%`);

    query = query
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch status: ${error.message}`);
      return { data: [], total: 0 };
    }

    return { data: data || [], total: count || 0 };
  }

  /**
   * Publish a draft: marks it as published and sets is_draft=false on dependent tables.
   */
  async publishRefresh(
    id: number,
    adminUser: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Get the refresh log entry
    const { data: entry, error: fetchErr } = await this.client
      .from('__rag_content_refresh_log')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !entry) {
      return { success: false, error: 'Entry not found' };
    }

    if (entry.status !== 'draft') {
      return {
        success: false,
        error: `Cannot publish entry with status '${entry.status}'`,
      };
    }

    // Update tracking log
    const { error: updateErr } = await this.client
      .from('__rag_content_refresh_log')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: adminUser,
      })
      .eq('id', id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // For R1/R3 guide achat: set sgpg_is_draft = false
    const pageType = entry.page_type as string;
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      await this.client
        .from('__seo_gamme_purchase_guide')
        .update({ sgpg_is_draft: false })
        .eq('sgpg_pg_id', String(entry.pg_id));
    }

    // For R4 reference: set is_published = true
    if (pageType === 'R4_reference') {
      await this.client
        .from('__seo_reference')
        .update({ is_published: true })
        .eq('slug', entry.pg_alias);
    }

    this.logger.log(
      `Published refresh #${id} (${entry.pg_alias}/${pageType}) by ${adminUser}`,
    );
    return { success: true };
  }

  /**
   * Reject a draft with a reason.
   */
  async rejectRefresh(
    id: number,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.client
      .from('__rag_content_refresh_log')
      .update({
        status: 'failed',
        error_message: `REJECTED: ${reason}`,
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    this.logger.log(`Rejected refresh #${id}: ${reason}`);
    return { success: true };
  }

  /**
   * QA Gate: verify that SEO-protected fields have not been mutated
   * since baseline was captured in __qa_protected_meta_hash.
   * Computes MD5 JS-side (same formula as baseline: md5(col1||'||'||col2||'||'||col3)).
   */
  async checkProtectedFieldsGate(): Promise<{
    seo_mutations: number;
    ref_mutations: number;
    h1_override_mutations: number;
    gate: 'GO' | 'BLOCK';
    checked_at: string;
    baseline_count: number;
    details: Array<{ pg_alias: string; field: string }>;
  }> {
    // 1. Fetch baselines
    const { data: baselines } = await this.client
      .from('__qa_protected_meta_hash')
      .select('pg_id, pg_alias, seo_hash, ref_hash, h1_override_hash');

    if (!baselines || baselines.length === 0) {
      return {
        seo_mutations: 0,
        ref_mutations: 0,
        h1_override_mutations: 0,
        gate: 'GO',
        checked_at: new Date().toISOString(),
        baseline_count: 0,
        details: [],
      };
    }

    const pgIds = baselines.map((b) => String(b.pg_id));
    const pgAliases = baselines.map((b) => b.pg_alias as string);

    // 2. Fetch current SEO values
    const { data: seoRows } = await this.client
      .from('__seo_gamme')
      .select('sg_pg_id, sg_title, sg_h1, sg_descrip')
      .in('sg_pg_id', pgIds);

    // 3. Fetch current reference values
    const { data: refRows } = await this.client
      .from('__seo_reference')
      .select('slug, title, meta_description, canonical_url')
      .in('slug', pgAliases);

    // 4. Fetch current h1_override values
    const { data: pgRows } = await this.client
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id, sgpg_h1_override')
      .in('sgpg_pg_id', pgIds);

    // Build lookup maps
    const seoMap = new Map((seoRows || []).map((r) => [String(r.sg_pg_id), r]));
    const refMap = new Map((refRows || []).map((r) => [r.slug as string, r]));
    const pgMap = new Map((pgRows || []).map((r) => [String(r.sgpg_pg_id), r]));

    // 5. Compare hashes
    let seoMutations = 0;
    let refMutations = 0;
    let h1Mutations = 0;
    const details: Array<{ pg_alias: string; field: string }> = [];

    for (const baseline of baselines) {
      const pgId = String(baseline.pg_id);
      const alias = baseline.pg_alias as string;

      // SEO check
      const seo = seoMap.get(pgId);
      if (seo) {
        const hash = this.md5Gate(
          (seo.sg_title as string) || '',
          (seo.sg_h1 as string) || '',
          (seo.sg_descrip as string) || '',
        );
        if (hash !== baseline.seo_hash) {
          seoMutations++;
          details.push({ pg_alias: alias, field: 'seo' });
        }
      }

      // Reference check
      const ref = refMap.get(alias);
      if (ref) {
        const hash = this.md5Gate(
          (ref.title as string) || '',
          (ref.meta_description as string) || '',
          (ref.canonical_url as string) || '',
        );
        if (hash !== baseline.ref_hash) {
          refMutations++;
          details.push({ pg_alias: alias, field: 'ref' });
        }
      }

      // H1 override check
      const pg = pgMap.get(pgId);
      if (pg) {
        const hash = createHash('md5')
          .update((pg.sgpg_h1_override as string) || '')
          .digest('hex');
        if (hash !== baseline.h1_override_hash) {
          h1Mutations++;
          details.push({ pg_alias: alias, field: 'h1_override' });
        }
      }
    }

    const totalMutations = seoMutations + refMutations + h1Mutations;

    return {
      seo_mutations: seoMutations,
      ref_mutations: refMutations,
      h1_override_mutations: h1Mutations,
      gate: totalMutations === 0 ? 'GO' : 'BLOCK',
      checked_at: new Date().toISOString(),
      baseline_count: baselines.length,
      details: totalMutations > 0 ? details : [],
    };
  }

  // ── SEO Gamme Draft Management ──

  /**
   * List all gammes with pending draft content (sg_descrip_draft or sg_content_draft).
   */
  async listSeoDrafts(): Promise<{
    drafts: Array<{
      pg_id: string;
      pg_alias: string;
      sg_descrip: string | null;
      sg_descrip_draft: string | null;
      sg_content_draft: string | null;
      sg_draft_source: string | null;
      sg_draft_updated_at: string | null;
      quality_score: number | null;
    }>;
  }> {
    const { data, error } = await this.client
      .from('__seo_gamme')
      .select(
        'sg_pg_id, sg_descrip, sg_descrip_draft, sg_content_draft, sg_draft_source, sg_draft_updated_at, sg_draft_llm_model',
      )
      .or('sg_descrip_draft.not.is.null,sg_content_draft.not.is.null')
      .order('sg_draft_updated_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list SEO drafts: ${error.message}`);
      return { drafts: [] };
    }

    // Resolve pg_alias from pieces_gamme
    const pgIds = (data || []).map((r) => String(r.sg_pg_id));
    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .in('pg_id', pgIds);

    const aliasMap = new Map(
      (gammes || []).map((g) => [String(g.pg_id), g.pg_alias as string]),
    );

    // Fetch quality scores from pipeline log (latest per pg_alias)
    const aliases = [...aliasMap.values()];
    const scoreMap = new Map<string, number | null>();
    if (aliases.length > 0) {
      const { data: scores } = await this.client
        .from('__rag_content_refresh_log')
        .select('pg_alias, quality_score, completed_at')
        .in('pg_alias', aliases)
        .in('status', ['auto_published', 'draft', 'published'])
        .not('quality_score', 'is', null)
        .order('completed_at', { ascending: false });

      // Keep only the latest score per pg_alias
      for (const row of scores || []) {
        const alias = row.pg_alias as string;
        if (!scoreMap.has(alias)) {
          scoreMap.set(alias, row.quality_score as number);
        }
      }
    }

    return {
      drafts: (data || []).map((r) => {
        const alias = aliasMap.get(String(r.sg_pg_id)) || 'unknown';
        return {
          pg_id: String(r.sg_pg_id),
          pg_alias: alias,
          sg_descrip: r.sg_descrip as string | null,
          sg_descrip_draft: r.sg_descrip_draft as string | null,
          sg_content_draft: r.sg_content_draft as string | null,
          sg_draft_source: r.sg_draft_source as string | null,
          sg_draft_updated_at: r.sg_draft_updated_at as string | null,
          quality_score: scoreMap.get(alias) ?? null,
        };
      }),
    };
  }

  /**
   * Preview draft vs current for a specific gamme.
   */
  async getSeoDraft(pgId: string): Promise<{
    current: { sg_descrip: string | null; sg_content: string | null };
    draft: {
      sg_descrip_draft: string | null;
      sg_content_draft: string | null;
      sg_draft_source: string | null;
      sg_draft_updated_at: string | null;
    };
  } | null> {
    const { data, error } = await this.client
      .from('__seo_gamme')
      .select(
        'sg_descrip, sg_content, sg_descrip_draft, sg_content_draft, sg_draft_source, sg_draft_updated_at',
      )
      .eq('sg_pg_id', pgId)
      .single();

    if (error || !data) return null;

    return {
      current: {
        sg_descrip: data.sg_descrip as string | null,
        sg_content: data.sg_content as string | null,
      },
      draft: {
        sg_descrip_draft: data.sg_descrip_draft as string | null,
        sg_content_draft: data.sg_content_draft as string | null,
        sg_draft_source: data.sg_draft_source as string | null,
        sg_draft_updated_at: data.sg_draft_updated_at as string | null,
      },
    };
  }

  /**
   * Publish draft: copy draft → live, clear draft columns, re-baseline QA hash if sg_descrip changed.
   */
  async publishSeoDraft(
    pgId: string,
  ): Promise<{ published: boolean; fields: string[]; error?: string }> {
    // Fetch current + draft
    const { data, error: fetchErr } = await this.client
      .from('__seo_gamme')
      .select('sg_title, sg_h1, sg_descrip, sg_descrip_draft, sg_content_draft')
      .eq('sg_pg_id', pgId)
      .single();

    if (fetchErr || !data) {
      return { published: false, fields: [], error: 'Gamme not found' };
    }

    const hasDraftDescrip = !!data.sg_descrip_draft;
    const hasDraftContent = !!data.sg_content_draft;

    if (!hasDraftDescrip && !hasDraftContent) {
      return { published: false, fields: [], error: 'No draft to publish' };
    }

    // Build update payload
    const update: Record<string, unknown> = {
      sg_descrip_draft: null,
      sg_content_draft: null,
      sg_draft_source: null,
      sg_draft_updated_at: null,
    };
    const fields: string[] = [];

    if (hasDraftDescrip) {
      update.sg_descrip = data.sg_descrip_draft;
      fields.push('sg_descrip');
    }
    if (hasDraftContent) {
      update.sg_content = data.sg_content_draft;
      fields.push('sg_content');
    }

    const { error: updateErr } = await this.client
      .from('__seo_gamme')
      .update(update)
      .eq('sg_pg_id', pgId);

    if (updateErr) {
      return { published: false, fields: [], error: updateErr.message };
    }

    // Re-baseline QA hash if sg_descrip changed
    if (hasDraftDescrip) {
      const newDescrip = data.sg_descrip_draft as string;
      const newHash = createHash('md5')
        .update(
          [
            (data.sg_title as string) || '',
            (data.sg_h1 as string) || '',
            newDescrip,
          ].join('||'),
        )
        .digest('hex');

      // Resolve pg_alias for the QA table
      const { data: gamme } = await this.client
        .from('pieces_gamme')
        .select('pg_alias')
        .eq('pg_id', pgId)
        .single();

      if (gamme?.pg_alias) {
        await this.client
          .from('__qa_protected_meta_hash')
          .update({ seo_hash: newHash })
          .eq('pg_alias', gamme.pg_alias);

        this.logger.log(
          `Re-baselined QA seo_hash for pgId=${pgId} after sg_descrip publish`,
        );
      }
    }

    this.logger.log(
      `Published SEO draft for pgId=${pgId}: [${fields.join(', ')}]`,
    );
    return { published: true, fields };
  }

  /**
   * Reject draft: clear draft columns without publishing.
   */
  async rejectSeoDraft(
    pgId: string,
  ): Promise<{ rejected: boolean; error?: string }> {
    const { error } = await this.client
      .from('__seo_gamme')
      .update({
        sg_descrip_draft: null,
        sg_content_draft: null,
        sg_draft_source: null,
        sg_draft_updated_at: null,
      })
      .eq('sg_pg_id', pgId);

    if (error) {
      return { rejected: false, error: error.message };
    }

    this.logger.log(`Rejected SEO draft for pgId=${pgId}`);
    return { rejected: true };
  }

  /** MD5 with '||' separator — mirrors PostgreSQL: md5(coalesce(a,'') || '||' || coalesce(b,'') || '||' || coalesce(c,'')) */
  private md5Gate(...fields: string[]): string {
    return createHash('md5').update(fields.join('||')).digest('hex');
  }

  // ── Private helpers ──

  private async determinePageTypes(
    pgId: number,
    pgAlias: string,
  ): Promise<GammePageType[]> {
    const types: GammePageType[] = [];

    // R1/R3 Guide Achat: check if purchase guide exists
    const { count: pgCount } = await this.client
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_id', { count: 'exact', head: true })
      .eq('sgpg_pg_id', String(pgId));

    if ((pgCount ?? 0) > 0) {
      types.push('R1_pieces');
      types.push('R3_guide_achat');
    }

    // R3 Conseils: check if conseil exists
    const { count: conseilCount } = await this.client
      .from('__seo_gamme_conseil')
      .select('sgc_id', { count: 'exact', head: true })
      .eq('sgc_pg_id', String(pgId));

    if ((conseilCount ?? 0) > 0) {
      types.push('R3_conseils');
    }

    // R4 Reference: auto-enabled when RAG knowledge file exists
    const ragFile = join(
      '/opt/automecanik/rag/knowledge/gammes',
      `${pgAlias}.md`,
    );
    if (existsSync(ragFile)) {
      types.push('R4_reference');
    }

    return types;
  }

  private async createAndQueueJob(
    pgId: number,
    pgAlias: string,
    pageType: GammePageType,
    triggerJobId: string,
    triggerSource: string,
    supplementaryFiles: string[] = [],
    force?: boolean,
  ): Promise<boolean> {
    // Guard: don't interrupt active jobs
    const { data: active } = await this.client
      .from('__rag_content_refresh_log')
      .select('id')
      .eq('pg_alias', pgAlias)
      .eq('page_type', pageType)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (active) {
      this.logger.warn(`Skipping: active job for ${pgAlias}/${pageType}`);
      return false;
    }

    // Upsert tracking row (unique index on pg_alias+page_type)
    const { data: row, error } = await this.client
      .from('__rag_content_refresh_log')
      .upsert(
        {
          pg_id: pgId,
          pg_alias: pgAlias,
          page_type: pageType,
          status: 'pending',
          trigger_source: triggerSource,
          trigger_job_id: triggerJobId,
          quality_score: null,
          quality_flags: null,
          error_message: null,
          completed_at: null,
          bullmq_job_id: null,
        },
        { onConflict: 'pg_alias,page_type' },
      )
      .select('id')
      .single();

    if (error) {
      this.logger.warn(
        `Failed upsert for ${pgAlias}/${pageType}: ${error.message}`,
      );
      return false;
    }

    // Queue BullMQ job
    const jobData: ContentRefreshJobData = {
      refreshLogId: row.id as number,
      pgId,
      pgAlias,
      pageType,
      ...(supplementaryFiles.length > 0 ? { supplementaryFiles } : {}),
      ...(force ? { force } : {}),
    };

    const job = await this.seoMonitorQueue.add('content-refresh', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    // Update tracking row with BullMQ job ID
    await this.client
      .from('__rag_content_refresh_log')
      .update({ bullmq_job_id: String(job.id) })
      .eq('id', row.id);

    return true;
  }

  private async createAndQueueDiagnosticJob(
    diagnosticSlug: string,
    triggerJobId: string,
    triggerSource: string,
  ): Promise<boolean> {
    // Guard: don't interrupt active jobs
    const { data: active } = await this.client
      .from('__rag_content_refresh_log')
      .select('id')
      .eq('pg_alias', diagnosticSlug)
      .eq('page_type', 'R5_diagnostic')
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (active) {
      this.logger.warn(`Skipping: active diagnostic job for ${diagnosticSlug}`);
      return false;
    }

    // Upsert tracking row (unique index on pg_alias+page_type)
    const { data: row, error } = await this.client
      .from('__rag_content_refresh_log')
      .upsert(
        {
          pg_id: 0,
          pg_alias: diagnosticSlug,
          page_type: 'R5_diagnostic',
          status: 'pending',
          trigger_source: triggerSource,
          trigger_job_id: triggerJobId,
          quality_score: null,
          quality_flags: null,
          error_message: null,
          completed_at: null,
          bullmq_job_id: null,
        },
        { onConflict: 'pg_alias,page_type' },
      )
      .select('id')
      .single();

    if (error) {
      this.logger.warn(
        `Failed upsert for diagnostic ${diagnosticSlug}: ${error.message}`,
      );
      return false;
    }

    const jobData: ContentRefreshJobDataR5 = {
      refreshLogId: row.id as number,
      diagnosticSlug,
      pageType: 'R5_diagnostic',
    };

    const job = await this.seoMonitorQueue.add('content-refresh', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    await this.client
      .from('__rag_content_refresh_log')
      .update({ bullmq_job_id: String(job.id) })
      .eq('id', row.id);

    return true;
  }
}
