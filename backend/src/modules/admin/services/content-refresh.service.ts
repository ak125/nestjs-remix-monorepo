import { Injectable, Logger, Optional } from '@nestjs/common';
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
import {
  KEYWORD_PLAN_VALIDATED,
  type KeywordPlanValidatedEvent,
} from '../events/keyword-plan.events';
import {
  PAGE_TYPE_TO_CANONICAL_ROLE,
  type ContentRefreshJobData,
  type ContentRefreshJobDataR5,
} from '../../../workers/types/content-refresh.types';
import { RagFoundationGateService } from '../../rag-proxy/services/rag-foundation-gate.service';

/** Gamme-based page types (R5 is diagnostic-slug-based, handled separately) */
type GammePageType = ContentRefreshJobData['pageType'];

@Injectable()
export class ContentRefreshService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ContentRefreshService.name);

  constructor(
    configService: ConfigService,
    @InjectQueue('content-refresh') private readonly contentRefreshQueue: Queue,
    @Optional()
    private readonly foundationGate?: RagFoundationGateService,
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
      // Persist orphan record for admin visibility
      const validFiles = event.validationSummary?.validFiles ?? 0;
      if (validFiles > 0) {
        await this.logOrphanIngestion(event);
      }
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
   * Write an orphan record when ingestion succeeds but no gammes are detected.
   * Makes "lost" ingestions visible in the admin dashboard.
   */
  private async logOrphanIngestion(
    event: RagIngestionCompletedEvent,
  ): Promise<void> {
    try {
      await this.supabase.from('__rag_content_refresh_log').insert({
        pg_alias: '__orphan__',
        page_type: 'R3_conseils',
        status: 'orphan_no_gamme',
        trigger_source: `rag_${event.source}_ingest`,
        trigger_job_id: event.jobId,
        error_message: `Ingestion OK (${event.validationSummary?.validFiles} valid files) but 0 gammes detected. Quarantined: ${event.validationSummary?.quarantinedFiles ?? 0}`,
        quality_score: 0,
      });
      this.logger.warn(
        `Orphan ingestion logged: jobId=${event.jobId}, validFiles=${event.validationSummary?.validFiles}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to log orphan ingestion: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Listener: triggered when a keyword plan is validated.
   * Queues R3_conseils refresh with force=true so sections get regenerated
   * using the new include_terms / micro_phrases from the keyword plan.
   */
  @OnEvent(KEYWORD_PLAN_VALIDATED)
  async onKeywordPlanValidated(
    event: KeywordPlanValidatedEvent,
  ): Promise<void> {
    if (event.sectionsToImprove.length === 0) {
      this.logger.warn(
        `Keyword plan validated for ${event.pgAlias} (kpId=${event.kpId}) but no sections_to_improve — skipping`,
      );
      return;
    }

    this.logger.log(
      `Keyword plan validated for ${event.pgAlias} (kpId=${event.kpId}). ` +
        `Sections to improve: [${event.sectionsToImprove.join(', ')}]. ` +
        `Queueing R3_conseils refresh with force=true...`,
    );

    await this.createAndQueueJob(
      event.pgId,
      event.pgAlias,
      'R3_conseils',
      `kp-${event.kpId}`,
      'keyword_plan_validated',
      [], // no supplementary files
      true, // force=true — sections_to_improve means re-enrichment needed
    );
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
    filterPageTypes?: GammePageType[],
  ): Promise<GammePageType[]> {
    // F1-GATE: Foundation Write Lock — refuse queueing if Phase 1 not passed
    if (this.foundationGate) {
      const gate = await this.foundationGate.guardWriteForGamme(pgAlias);
      if (!gate.passed && gate.total > 0) {
        this.logger.warn(
          `F1-GATE: refusing to queue refresh for "${pgAlias}" — ${gate.blockedSources.length}/${gate.total} docs blocked`,
        );
        return [];
      }
    }

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

    // Determine which page types need refresh (optionally filtered)
    let pageTypes = await this.determinePageTypes(pgId, pgAlias);
    if (filterPageTypes?.length) {
      pageTypes = pageTypes.filter((pt) => filterPageTypes.includes(pt));
    }

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
    filterPageTypes?: GammePageType[],
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
        filterPageTypes,
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
    skipBreakdown?: { no_rag: number; complete: number; no_contract: number };
  }> {
    // Counts by status — use head queries to avoid PostgREST max-rows limit
    const statusKeys = [
      'draft',
      'auto_published',
      'skipped',
      'failed',
      'published',
      'orphan_no_gamme',
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

    // Breakdown of skipped reasons for admin visibility
    let skipBreakdown:
      | { no_rag: number; complete: number; no_contract: number }
      | undefined;
    if (counts['skipped'] > 0) {
      const { data: skipRows } = await this.client
        .from('__rag_content_refresh_log')
        .select('error_message')
        .eq('status', 'skipped');
      if (skipRows) {
        const breakdown = { no_rag: 0, complete: 0, no_contract: 0 };
        for (const row of skipRows) {
          const msg = (row.error_message || '').toLowerCase();
          if (msg.includes('no_rag') || msg.includes('no rag'))
            breakdown.no_rag++;
          else if (
            msg.includes('no_enrichment') ||
            msg.includes('already complete')
          )
            breakdown.complete++;
          else breakdown.no_contract++;
        }
        skipBreakdown = breakdown;
      }
    }

    // Recent items
    const { data: recent } = await this.client
      .from('__rag_content_refresh_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return { counts, recent: recent || [], skipBreakdown };
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
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_howto') {
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
   * Publish all pending drafts at once.
   */
  async publishAllDrafts(
    adminUser: string,
  ): Promise<{ published: number; failed: number; errors: string[] }> {
    const { data: drafts, error } = await this.client
      .from('__rag_content_refresh_log')
      .select('id, pg_alias, page_type')
      .eq('status', 'draft');

    if (error || !drafts) {
      return {
        published: 0,
        failed: 0,
        errors: [error?.message ?? 'No drafts found'],
      };
    }

    let published = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      const result = await this.publishRefresh(draft.id, adminUser);
      if (result.success) {
        published++;
      } else {
        failed++;
        errors.push(
          `#${draft.id} ${draft.pg_alias}/${draft.page_type}: ${result.error}`,
        );
      }
    }

    this.logger.log(
      `Bulk publish by ${adminUser}: ${published} published, ${failed} failed out of ${drafts.length} drafts`,
    );
    return { published, failed, errors };
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

  /**
   * Determine which page types to refresh for a gamme.
   *
   * Canonical role mapping (legacy worker label → R*):
   *   R1_pieces     → R1_ROUTER
   *   R3_guide_howto→ R3_GUIDE (how-to, NOT guide d'achat)
   *   R3_conseils   → R3_CONSEILS
   *   R4_reference  → R4_REFERENCE
   *   R5_diagnostic → R5_DIAGNOSTIC
   *   R6_guide_achat→ R6_GUIDE_ACHAT
   *
   * Worker labels are kept for BullMQ backward compat.
   * See .spec/00-canon/db-governance/legacy-canon-map.md v1.1.0
   */
  private async determinePageTypes(
    pgId: number,
    pgAlias: string,
  ): Promise<GammePageType[]> {
    const types: GammePageType[] = [];

    // R1_ROUTER + R3_GUIDE (how-to): check if purchase guide exists
    const { count: pgCount } = await this.client
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_id', { count: 'exact', head: true })
      .eq('sgpg_pg_id', String(pgId));

    if ((pgCount ?? 0) > 0) {
      types.push('R1_pieces');
      types.push('R3_guide_howto');
    }

    // R3_CONSEILS + R4_REFERENCE: enabled when RAG knowledge file exists
    // Allows first-time creation of conseil sections from RAG knowledge
    const ragFile = join(
      '/opt/automecanik/rag/knowledge/gammes',
      `${pgAlias}.md`,
    );
    if (existsSync(ragFile)) {
      types.push('R3_conseils');
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
    const refreshLogIdNum = row.id as number;
    const jobData: ContentRefreshJobData = {
      refreshLogId: refreshLogIdNum,
      pgId,
      pgAlias,
      pageType,
      correlationId: `cr-${refreshLogIdNum}-${Date.now()}`,
      ...(supplementaryFiles.length > 0 ? { supplementaryFiles } : {}),
      ...(force ? { force } : {}),
    };

    // Canonical role logging (Regle 4 — legacy-canon-map.md v1.1.0)
    this.logger.log(
      `Job queued: canonicalRole=${PAGE_TYPE_TO_CANONICAL_ROLE[pageType]}, legacyPageType=${pageType}, pgId=${pgId}, pgAlias=${pgAlias}`,
    );

    const job = await this.contentRefreshQueue.add('content-refresh', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 50,
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

    const refreshLogIdNum = row.id as number;
    const jobData: ContentRefreshJobDataR5 = {
      refreshLogId: refreshLogIdNum,
      diagnosticSlug,
      pageType: 'R5_diagnostic',
      correlationId: `cr-${refreshLogIdNum}-${Date.now()}`,
    };

    const job = await this.contentRefreshQueue.add('content-refresh', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });

    await this.client
      .from('__rag_content_refresh_log')
      .update({ bullmq_job_id: String(job.id) })
      .eq('id', row.id);

    return true;
  }

  /**
   * Get composite quality scores per gamme (aggregated across all page types).
   * Uses RPC get_gamme_composite_scores for efficient server-side aggregation.
   */
  async getCompositeScores(aliases?: string[]): Promise<
    Array<{
      pg_alias: string;
      composite_score: number;
      r1_score: number | null;
      r3_guide_score: number | null;
      r3_conseils_score: number | null;
      r4_score: number | null;
      page_types_completed: number;
      page_types_total: number;
      latest_refresh: string | null;
    }>
  > {
    const { data, error } = await this.callRpc<Array<Record<string, unknown>>>(
      'get_gamme_composite_scores',
      {
        p_aliases: aliases?.length ? aliases : null,
      },
    );

    if (error) {
      this.logger.error(`Failed to get composite scores: ${error.message}`);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      pg_alias: row.pg_alias as string,
      composite_score: Number(row.composite_score) || 0,
      r1_score: row.r1_score as number | null,
      r3_guide_score: row.r3_guide_score as number | null,
      r3_conseils_score: row.r3_conseils_score as number | null,
      r4_score: row.r4_score as number | null,
      page_types_completed: row.page_types_completed as number,
      page_types_total: row.page_types_total as number,
      latest_refresh: row.latest_refresh as string | null,
    }));
  }

  /**
   * Get observe-only impact stats: how often gates WOULD have blocked
   * in the current observe-only phase.
   */
  async getObserveOnlyStats(days: number = 7): Promise<{
    window_days: number;
    cutoff: string;
    generated_at: string;
    totals: {
      total_evaluations: number;
      would_block_brief: number;
      would_block_hard: number;
      published_despite_warning: number;
    };
    by_page_type: Array<{
      page_type: string;
      total_evaluations: number;
      would_block_brief: number;
      would_block_hard: number;
      published_despite_warning: number;
    }>;
    gate_distribution: Array<{
      gate: string;
      verdict: string;
      count: number;
    }>;
    ar_flag_distribution: Array<{
      flag: string;
      count: number;
    }>;
  }> {
    const emptyResult = {
      window_days: days,
      cutoff: new Date().toISOString(),
      generated_at: new Date().toISOString(),
      totals: {
        total_evaluations: 0,
        would_block_brief: 0,
        would_block_hard: 0,
        published_despite_warning: 0,
      },
      by_page_type: [],
      gate_distribution: [],
      ar_flag_distribution: [],
    };

    const { data, error } = await this.callRpc<Record<string, unknown>>(
      'get_observe_only_impact_stats',
      { p_days: days },
    );

    if (error) {
      this.logger.error(`Failed to get observe-only stats: ${error.message}`);
      return emptyResult;
    }

    if (!data) return emptyResult;

    return data as unknown as typeof emptyResult;
  }

  /**
   * Get snapshot data for a specific refresh log entry.
   * Returns content fingerprint, quality score, and SEO gamme state.
   */
  async getRefreshSnapshot(refreshLogId: number): Promise<{
    refreshLogId: number;
    pgAlias: string;
    pageType: string;
    status: string;
    qualityScore: number | null;
    contentFingerprint: unknown | null;
    triggerSource: string | null;
    createdAt: string | null;
    completedAt: string | null;
    seoState: {
      title: string | null;
      h1: string | null;
      contentLength: number | null;
      draftUpdatedAt: string | null;
    } | null;
  }> {
    const { data: logEntry, error } = await this.client
      .from('__rag_content_refresh_log')
      .select(
        'id, pg_alias, pg_id, page_type, status, quality_score, content_fingerprint, trigger_source, created_at, completed_at',
      )
      .eq('id', refreshLogId)
      .single();

    if (error || !logEntry) {
      return {
        refreshLogId,
        pgAlias: '',
        pageType: '',
        status: 'not_found',
        qualityScore: null,
        contentFingerprint: null,
        triggerSource: null,
        createdAt: null,
        completedAt: null,
        seoState: null,
      };
    }

    // Fetch current SEO gamme state
    let seoState: {
      title: string | null;
      h1: string | null;
      contentLength: number | null;
      draftUpdatedAt: string | null;
    } | null = null;

    if (logEntry.pg_id) {
      const { data: seo } = await this.client
        .from('__seo_gamme')
        .select('sg_title, sg_h1, sg_content, sg_draft_updated_at')
        .eq('sg_pg_id', String(logEntry.pg_id))
        .single();

      if (seo) {
        seoState = {
          title: seo.sg_title,
          h1: seo.sg_h1,
          contentLength: seo.sg_content ? seo.sg_content.length : null,
          draftUpdatedAt: seo.sg_draft_updated_at,
        };
      }
    }

    return {
      refreshLogId,
      pgAlias: logEntry.pg_alias,
      pageType: logEntry.page_type,
      status: logEntry.status,
      qualityScore: logEntry.quality_score,
      contentFingerprint: logEntry.content_fingerprint,
      triggerSource: logEntry.trigger_source,
      createdAt: logEntry.created_at,
      completedAt: logEntry.completed_at,
      seoState,
    };
  }

  // ── Coverage Map & Activity Timeline ──

  /**
   * Coverage Map: per-gamme content gap analysis.
   * Calls the get_coverage_map() RPC which JOINs across
   * pieces_gamme, __seo_gamme, __seo_gamme_purchase_guide,
   * __seo_gamme_conseil, and __rag_knowledge.
   */
  async getRagCoverageSummary(): Promise<{
    success: boolean;
    data: Record<string, unknown>;
  }> {
    const { data, error } = await this.supabase.rpc('get_rag_coverage_summary');
    if (error) {
      this.logger.error(`RAG coverage summary failed: ${error.message}`);
      return { success: false, data: {} };
    }
    return { success: true, data: data as Record<string, unknown> };
  }

  async getCoverageMap(): Promise<{
    gammes: Array<{
      pg_id: number;
      pg_alias: string;
      pg_name: string;
      has_how_to_choose: boolean;
      has_anti_mistakes: boolean;
      has_selection_criteria: boolean;
      has_decision_tree: boolean;
      has_faq: boolean;
      has_symptoms: boolean;
      conseil_sections: string[];
      conseil_count: number;
      has_rag_file: boolean;
      depth_score: number;
      seo_score: number;
      trust_score: number;
      coverage_score: number;
      priority: string;
      seo_title_ok: boolean;
      seo_desc_ok: boolean;
      seo_h1_ok: boolean;
      seo_title_length: number;
      seo_desc_length: number;
      seo_content_length: number;
      seo_content_ok: boolean;
      source_verified: boolean;
      pipeline_quality: number | null;
      last_updated_at: string | null;
      hard_gates_clean: boolean;
      faq_count: number;
      symptoms_count: number;
      how_to_choose_length: number;
      conseil_rich_count: number;
      thin_conseil_count: number;
      thin_conseil_sections: string[];
      rag_content_length: number;
      rag_content_ok: boolean;
    }>;
    summary: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      avgScore: number;
    };
  }> {
    const { data, error } = await this.client.rpc('get_coverage_map');

    if (error) {
      this.logger.error(`Coverage map query failed: ${error.message}`);
      return {
        gammes: [],
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          avgScore: 0,
        },
      };
    }

    const gammes = (data || []) as Array<{
      pg_id: number;
      pg_alias: string;
      pg_name: string;
      has_how_to_choose: boolean;
      has_anti_mistakes: boolean;
      has_selection_criteria: boolean;
      has_decision_tree: boolean;
      has_faq: boolean;
      has_symptoms: boolean;
      conseil_sections: string[];
      conseil_count: number;
      has_rag_file: boolean;
      depth_score: number;
      seo_score: number;
      trust_score: number;
      coverage_score: number;
      priority: string;
      seo_title_ok: boolean;
      seo_desc_ok: boolean;
      seo_h1_ok: boolean;
      seo_title_length: number;
      seo_desc_length: number;
      seo_content_length: number;
      seo_content_ok: boolean;
      source_verified: boolean;
      pipeline_quality: number | null;
      last_updated_at: string | null;
      hard_gates_clean: boolean;
      faq_count: number;
      symptoms_count: number;
      how_to_choose_length: number;
      conseil_rich_count: number;
      thin_conseil_count: number;
      thin_conseil_sections: string[];
      rag_content_length: number;
      rag_content_ok: boolean;
    }>;

    const summary = {
      total: gammes.length,
      critical: gammes.filter((g) => g.priority === 'CRITICAL').length,
      high: gammes.filter((g) => g.priority === 'HIGH').length,
      medium: gammes.filter((g) => g.priority === 'MEDIUM').length,
      low: gammes.filter((g) => g.priority === 'LOW').length,
      avgScore:
        gammes.length > 0
          ? Math.round(
              gammes.reduce((s, g) => s + g.coverage_score, 0) / gammes.length,
            )
          : 0,
    };

    return { gammes, summary };
  }

  /**
   * Activity Timeline: chronological feed of pipeline events.
   */
  async getActivityTimeline(limit = 30): Promise<
    Array<{
      id: number;
      pg_alias: string;
      page_type: string;
      status: string;
      trigger_source: string;
      quality_score: number | null;
      created_at: string;
      completed_at: string | null;
      published_at: string | null;
    }>
  > {
    const { data, error } = await this.client
      .from('__rag_content_refresh_log')
      .select(
        'id, pg_alias, page_type, status, trigger_source, quality_score, created_at, completed_at, published_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Activity timeline query failed: ${error.message}`);
      return [];
    }

    return (data || []) as Array<{
      id: number;
      pg_alias: string;
      page_type: string;
      status: string;
      trigger_source: string;
      quality_score: number | null;
      created_at: string;
      completed_at: string | null;
      published_at: string | null;
    }>;
  }

  // ── Quality Dashboard V2 ──

  /**
   * Quality Dashboard: reads pre-computed scores from
   * __quality_gamme_scores + __quality_page_scores.
   */
  async getQualityDashboard(): Promise<{
    gammes: Array<{
      pg_id: number;
      pg_alias: string;
      gamme_score: number;
      confidence_score: number;
      business_value: number;
      composite_score: number;
      family_name: string | null;
      product_count: number;
      priority: string;
      status: string;
      pages_expected: number;
      pages_scored: number;
      missing_page_types: string[];
      page_scores_summary: Record<string, { score: number; status: string }>;
      top_reasons: string[];
      top_actions: string[];
      page_scores: Array<{
        page_type: string;
        quality_score: number;
        confidence_score: number;
        subscores: Record<string, number>;
        penalties: Array<{ rule: string; points: number }>;
        status: string;
        priority: string;
        reasons: string[];
        next_actions: string[];
      }>;
    }>;
    summary: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      avgScore: number;
      avgComposite: number;
      avgConfidence: number;
      blockedPages: number;
      totalActions: number;
      families: Array<{ name: string; count: number; avgComposite: number }>;
    };
  }> {
    // 1. Fetch gamme scores — sort by composite_score (v2)
    const { data: gammeData, error: gErr } = await this.client
      .from('__quality_gamme_scores')
      .select('*')
      .order('composite_score', { ascending: true });

    if (gErr) {
      this.logger.error(
        `Quality dashboard gamme query failed: ${gErr.message}`,
      );
      return {
        gammes: [],
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          avgScore: 0,
          avgComposite: 0,
          avgConfidence: 0,
          blockedPages: 0,
          totalActions: 0,
          families: [],
        },
      };
    }

    const gammeRows = (gammeData || []) as Array<{
      pg_id: number;
      pg_alias: string;
      gamme_score: number;
      confidence_score: number;
      business_value: number;
      composite_score: number;
      family_name: string | null;
      product_count: number;
      priority: string;
      status: string;
      pages_expected: number;
      pages_scored: number;
      missing_page_types: string[];
      page_scores_summary: Record<string, { score: number; status: string }>;
      top_reasons: string[];
      top_actions: string[];
    }>;

    // 2. Fetch page scores
    const { data: pageData, error: pErr } = await this.client
      .from('__quality_page_scores')
      .select(
        'pg_id, page_type, quality_score, confidence_score, subscores, penalties, status, priority, reasons, next_actions, features',
      );

    if (pErr) {
      this.logger.error(`Quality dashboard page query failed: ${pErr.message}`);
    }

    const pageRows = (pageData || []) as Array<{
      pg_id: number;
      page_type: string;
      quality_score: number;
      confidence_score: number;
      subscores: Record<string, number>;
      penalties: Array<{ rule: string; points: number }>;
      status: string;
      priority: string;
      reasons: string[];
      next_actions: string[];
      features: Record<string, unknown>;
    }>;

    // Group page scores by pg_id
    const pagesByGamme = new Map<number, typeof pageRows>();
    for (const p of pageRows) {
      const arr = pagesByGamme.get(p.pg_id) || [];
      arr.push(p);
      pagesByGamme.set(p.pg_id, arr);
    }

    // 3. Assemble response
    const gammes = gammeRows.map((g) => ({
      ...g,
      page_scores: (pagesByGamme.get(g.pg_id) || []).map((p) => ({
        page_type: p.page_type,
        quality_score: p.quality_score,
        confidence_score: p.confidence_score,
        subscores: p.subscores,
        penalties: p.penalties,
        status: p.status,
        priority: p.priority,
        reasons: p.reasons,
        next_actions: p.next_actions,
        features: p.features || {},
      })),
    }));

    // 4. Family summary (v2)
    const familyMap = new Map<
      string,
      { count: number; totalComposite: number }
    >();
    for (const g of gammeRows) {
      const name = g.family_name || 'Autres';
      const entry = familyMap.get(name) || { count: 0, totalComposite: 0 };
      entry.count++;
      entry.totalComposite += g.composite_score;
      familyMap.set(name, entry);
    }
    const families = [...familyMap.entries()]
      .map(([name, { count, totalComposite }]) => ({
        name,
        count,
        avgComposite: parseFloat((totalComposite / count).toFixed(1)),
      }))
      .sort((a, b) => a.avgComposite - b.avgComposite);

    const summary = {
      total: gammes.length,
      critical: gammes.filter((g) => g.priority === 'CRITICAL').length,
      high: gammes.filter((g) => g.priority === 'HIGH').length,
      medium: gammes.filter((g) => g.priority === 'MEDIUM').length,
      low: gammes.filter((g) => g.priority === 'LOW').length,
      avgScore:
        gammes.length > 0
          ? parseFloat(
              (
                gammes.reduce((s, g) => s + g.gamme_score, 0) / gammes.length
              ).toFixed(1),
            )
          : 0,
      avgComposite:
        gammes.length > 0
          ? parseFloat(
              (
                gammes.reduce((s, g) => s + g.composite_score, 0) /
                gammes.length
              ).toFixed(1),
            )
          : 0,
      avgConfidence:
        gammes.length > 0
          ? parseFloat(
              (
                gammes.reduce((s, g) => s + g.confidence_score, 0) /
                gammes.length
              ).toFixed(1),
            )
          : 0,
      blockedPages: pageRows.filter((p) => p.status === 'BLOCKED').length,
      totalActions: gammes.reduce((s, g) => s + g.top_actions.length, 0),
      families,
    };

    return { gammes, summary };
  }

  /**
   * R1 keyword plans — list from __seo_r1_keyword_plan.
   */
  async getR1KeywordPlans(opts: { status?: string; limit: number }): Promise<
    Array<{
      rkp_pg_alias: string;
      rkp_status: string | null;
      rkp_pipeline_phase: string | null;
      rkp_quality_score: number | null;
      rkp_coverage_score: number | null;
      rkp_built_at: string | null;
    }>
  > {
    let query = this.supabase
      .from('__seo_r1_keyword_plan')
      .select(
        'rkp_pg_alias, rkp_status, rkp_pipeline_phase, rkp_quality_score, rkp_coverage_score, rkp_built_at',
      )
      .order('rkp_built_at', { ascending: false })
      .limit(opts.limit);

    if (opts.status) {
      query = query.eq('rkp_status', opts.status);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to get R1 keyword plans: ${error.message}`);
      return [];
    }
    return (data || []) as Array<{
      rkp_pg_alias: string;
      rkp_status: string | null;
      rkp_pipeline_phase: string | null;
      rkp_quality_score: number | null;
      rkp_coverage_score: number | null;
      rkp_built_at: string | null;
    }>;
  }

  /**
   * R1 content preview — returns all sgpg_* fields for a gamme.
   */
  async getR1Preview(pgAlias: string): Promise<Record<string, unknown> | null> {
    const { data: gamme } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_alias', pgAlias)
      .single();

    if (!gamme) return null;

    const { data } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select(
        [
          'sgpg_hero_subtitle',
          'sgpg_selector_microcopy',
          'sgpg_micro_seo_block',
          'sgpg_compatibilities_intro',
          'sgpg_equipementiers_line',
          'sgpg_family_cross_sell_intro',
          'sgpg_faq',
          'sgpg_safe_table_rows',
          'sgpg_arg1_title',
          'sgpg_arg2_title',
          'sgpg_arg3_title',
          'sgpg_arg4_title',
          'sgpg_anti_mistakes',
          'sgpg_gatekeeper_score',
          'sgpg_gatekeeper_flags',
          'sgpg_gatekeeper_checks',
          'sgpg_is_draft',
          'sgpg_h1_override',
          'sgpg_intent_lock',
          'sgpg_updated_at',
        ].join(', '),
      )
      .eq('sgpg_pg_id', String(gamme.pg_id))
      .single();

    return (data as unknown as Record<string, unknown>) ?? null;
  }

  /**
   * R1 pipeline coverage per section.
   * Returns how many gammes have pipeline content vs fallback for each R1 field.
   */
  async getR1PipelineCoverage(): Promise<{
    sections: Array<{
      section: string;
      pipeline: number;
      fallback: number;
      total: number;
    }>;
  }> {
    const { data, error } = await this.supabase.rpc('execute_sql', {
      query: `
        SELECT 'microSeoBlock' as section,
          COUNT(*) FILTER (WHERE sgpg_micro_seo_block IS NOT NULL AND sgpg_micro_seo_block != '') as pipeline,
          COUNT(*) as total
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'heroSubtitle',
          COUNT(*) FILTER (WHERE sgpg_hero_subtitle IS NOT NULL AND sgpg_hero_subtitle != ''), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'faq',
          COUNT(*) FILTER (WHERE sgpg_faq IS NOT NULL AND jsonb_array_length(sgpg_faq) > 0), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'safeTableRows',
          COUNT(*) FILTER (WHERE sgpg_safe_table_rows IS NOT NULL AND jsonb_array_length(sgpg_safe_table_rows) > 0), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'antiMistakes',
          COUNT(*) FILTER (WHERE sgpg_anti_mistakes IS NOT NULL AND array_length(sgpg_anti_mistakes, 1) > 0), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'compatibilitiesIntro',
          COUNT(*) FILTER (WHERE sgpg_compatibilities_intro IS NOT NULL AND sgpg_compatibilities_intro != ''), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
        UNION ALL
        SELECT 'equipementiersLine',
          COUNT(*) FILTER (WHERE sgpg_equipementiers_line IS NOT NULL AND sgpg_equipementiers_line != ''), COUNT(*)
        FROM __seo_gamme_purchase_guide WHERE sgpg_is_draft = false
      `,
    });

    if (error) {
      // Fallback: direct query approach
      this.logger.warn(
        `R1 coverage RPC failed, using direct query: ${error.message}`,
      );
      const sections = await this.getR1CoverageDirect();
      return { sections };
    }

    const rows =
      (data as Array<{ section: string; pipeline: number; total: number }>) ||
      [];
    return {
      sections: rows.map((r) => ({
        section: r.section,
        pipeline: Number(r.pipeline),
        fallback: Number(r.total) - Number(r.pipeline),
        total: Number(r.total),
      })),
    };
  }

  private async getR1CoverageDirect(): Promise<
    Array<{
      section: string;
      pipeline: number;
      fallback: number;
      total: number;
    }>
  > {
    const { count: total } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('*', { count: 'exact', head: true })
      .eq('sgpg_is_draft', false);

    const t = total ?? 0;

    // Text columns: non-null and non-empty
    const textChecks = [
      { section: 'microSeoBlock', col: 'sgpg_micro_seo_block' },
      { section: 'heroSubtitle', col: 'sgpg_hero_subtitle' },
      { section: 'compatibilitiesIntro', col: 'sgpg_compatibilities_intro' },
      { section: 'equipementiersLine', col: 'sgpg_equipementiers_line' },
    ];

    const results: Array<{
      section: string;
      pipeline: number;
      fallback: number;
      total: number;
    }> = [];

    for (const { section, col } of textChecks) {
      const { count } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('*', { count: 'exact', head: true })
        .eq('sgpg_is_draft', false)
        .neq(col, '')
        .not(col, 'is', null);
      const p = count ?? 0;
      results.push({ section, pipeline: p, fallback: t - p, total: t });
    }

    // JSONB columns: non-null and non-empty array (neq '[]')
    const jsonbChecks = [
      { section: 'faq', col: 'sgpg_faq' },
      { section: 'safeTableRows', col: 'sgpg_safe_table_rows' },
    ];

    for (const { section, col } of jsonbChecks) {
      const { count } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('*', { count: 'exact', head: true })
        .eq('sgpg_is_draft', false)
        .not(col, 'is', null)
        .neq(col, '[]');
      const p = count ?? 0;
      results.push({ section, pipeline: p, fallback: t - p, total: t });
    }

    // text[] column: non-null and non-empty (neq '{}')
    const { count: antiMistakesCount } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('*', { count: 'exact', head: true })
      .eq('sgpg_is_draft', false)
      .not('sgpg_anti_mistakes', 'is', null)
      .neq('sgpg_anti_mistakes', '{}');
    const am = antiMistakesCount ?? 0;
    results.push({
      section: 'antiMistakes',
      pipeline: am,
      fallback: t - am,
      total: t,
    });

    return results;
  }
}
