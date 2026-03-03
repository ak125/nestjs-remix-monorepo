import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { ContentRefreshService } from './content-refresh.service';

/**
 * Catch-up service that runs at server startup to detect RAG gammes
 * that were ingested but never triggered a content refresh.
 *
 * This covers the gap where polling timers (setInterval in pollPdfAndEmit)
 * are lost on server crash/restart, leaving completed ingestion jobs
 * without downstream pipeline triggers.
 *
 * Gated by RAG_CATCHUP_ENABLED feature flag (default false).
 */
@Injectable()
export class RagCatchupService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected readonly logger = new Logger(RagCatchupService.name);

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly contentRefreshService: ContentRefreshService,
  ) {
    super(configService);
  }

  async onModuleInit(): Promise<void> {
    if (!this.flags.ragCatchupEnabled) {
      this.logger.log('RAG catch-up DISABLED (RAG_CATCHUP_ENABLED=false).');
      return;
    }

    // Non-blocking: don't delay server startup
    setTimeout(() => {
      this.runCatchup().catch((err) =>
        this.logger.error(`RAG catch-up failed: ${err?.message || err}`),
      );
    }, 5000);
  }

  /**
   * Scan __rag_knowledge for gammes that have no successful content refresh log entry.
   * Queue content refresh for each orphan.
   */
  async runCatchup(): Promise<{ queued: number; skipped: number }> {
    this.logger.log('Starting RAG catch-up scan...');

    // 1. Get all gamme aliases from __rag_knowledge (source prefix = 'gammes/')
    const { data: ragRows, error: ragErr } = await this.client
      .from('__rag_knowledge')
      .select('source, updated_at')
      .like('source', 'gammes/%')
      .eq('status', 'active');

    if (ragErr || !ragRows?.length) {
      this.logger.warn(
        `No active gamme RAG docs found${ragErr ? `: ${ragErr.message}` : ''}. Skipping.`,
      );
      return { queued: 0, skipped: 0 };
    }

    // 2. Get aliases that already have at least one successful refresh log entry
    const { data: refreshedRows } = await this.client
      .from('__rag_content_refresh_log')
      .select('pg_alias')
      .in('status', ['auto_published', 'draft', 'published']);

    const refreshedSet = new Set(
      (refreshedRows || []).map((r) => r.pg_alias as string),
    );

    // 3. Find gammes ingested but never refreshed
    const missed: string[] = [];
    for (const row of ragRows) {
      const source = row.source as string;
      const alias = source.replace('gammes/', '').replace('.md', '');
      if (!refreshedSet.has(alias)) {
        missed.push(alias);
      }
    }

    this.logger.log(
      `Catch-up: ${ragRows.length} RAG docs, ${refreshedSet.size} already refreshed, ` +
        `${missed.length} need catch-up${missed.length > 0 ? `: [${missed.join(', ')}]` : ''}`,
    );

    if (missed.length === 0) {
      return { queued: 0, skipped: 0 };
    }

    // 4. Queue refresh for each missed gamme (idempotent — dedup inside queueRefreshForGamme)
    let queued = 0;
    for (const pgAlias of missed) {
      try {
        const pageTypes = await this.contentRefreshService.queueRefreshForGamme(
          pgAlias,
          `catchup-${Date.now()}`,
          'rag_catchup',
          [],
          false, // force=false — only enrich if sections are thin
        );
        if (pageTypes.length > 0) {
          queued++;
          this.logger.log(
            `Catch-up queued ${pgAlias}: ${pageTypes.join(', ')}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Catch-up failed for ${pgAlias}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(
      `RAG catch-up complete: ${queued} gammes queued, ${missed.length - queued} skipped.`,
    );
    return { queued, skipped: missed.length - queued };
  }
}
