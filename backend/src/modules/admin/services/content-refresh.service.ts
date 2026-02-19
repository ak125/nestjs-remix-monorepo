import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from '../../rag-proxy/events/rag-ingestion.events';
import type { ContentRefreshJobData } from '../../../workers/types/content-refresh.types';

type PageType = 'R1_pieces' | 'R3_conseils' | 'R3_guide_achat' | 'R4_reference';

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

    for (const pgAlias of gammes) {
      await this.queueRefreshForGamme(
        pgAlias,
        event.jobId,
        `rag_${event.source}_ingest`,
      );
    }
  }

  /**
   * Queue content refresh jobs for a single gamme across all applicable page types.
   */
  async queueRefreshForGamme(
    pgAlias: string,
    triggerJobId: string,
    triggerSource: string,
  ): Promise<PageType[]> {
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
    const queued: PageType[] = [];
    for (const pageType of pageTypes) {
      const created = await this.createAndQueueJob(
        pgId,
        pgAlias,
        pageType,
        triggerJobId,
        triggerSource,
      );
      if (created) queued.push(pageType);
    }

    this.logger.log(
      `Queued ${queued.length} refresh jobs for ${pgAlias}: [${queued.join(', ')}]`,
    );
    return queued;
  }

  /**
   * Manual trigger: queue refresh for one or more gammes.
   */
  async triggerManualRefresh(
    pgAliases: string[],
  ): Promise<{ queued: Array<{ pgAlias: string; pageTypes: PageType[] }> }> {
    const results: Array<{ pgAlias: string; pageTypes: PageType[] }> = [];

    for (const pgAlias of pgAliases) {
      const pageTypes = await this.queueRefreshForGamme(
        pgAlias,
        'manual',
        'manual',
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
    // Counts by status
    const { data: statusCounts } = await this.client
      .from('__rag_content_refresh_log')
      .select('status')
      .limit(5000);

    const counts: Record<string, number> = {};
    for (const row of statusCounts || []) {
      const s = row.status as string;
      counts[s] = (counts[s] || 0) + 1;
    }

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
    if (filters.pg_alias) query = query.eq('pg_alias', filters.pg_alias);

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

  // ── Private helpers ──

  private async determinePageTypes(
    pgId: number,
    pgAlias: string,
  ): Promise<PageType[]> {
    const types: PageType[] = [];

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
    pageType: PageType,
    triggerJobId: string,
    triggerSource: string,
  ): Promise<boolean> {
    // Insert tracking row (partial unique index prevents duplicates)
    const { data: row, error } = await this.client
      .from('__rag_content_refresh_log')
      .insert({
        pg_id: pgId,
        pg_alias: pgAlias,
        page_type: pageType,
        status: 'pending',
        trigger_source: triggerSource,
        trigger_job_id: triggerJobId,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.warn(
        `Skipping duplicate refresh: ${pgAlias}/${pageType} (${error.message})`,
      );
      return false;
    }

    // Queue BullMQ job
    const jobData: ContentRefreshJobData = {
      refreshLogId: row.id as number,
      pgId,
      pgAlias,
      pageType,
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
}
