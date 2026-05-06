/**
 * SEO Monitoring Runs Service
 *
 * Wrapper d'écriture dans la table unifiée `__seo_event_log`
 * pour les événements de type `ingestion_run_*` (started/completed/failed).
 *
 * Sert d'audit trail pour les fetchers GSC/GA4/CWV/Links.
 *
 * Refs:
 * - 20260425_seo_event_log.sql (migration)
 * - packages/seo-types/src/intelligence.ts (Zod schemas)
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export type IngestionSource =
  | 'gsc'
  | 'ga4'
  | 'cwv'
  | 'gsc_links'
  | 'indexation';

export interface RunStartContext {
  source: IngestionSource;
  scope: string;
  expectedPages?: number;
}

export interface RunCompleteContext {
  runId: string;
  source: IngestionSource;
  rowsInserted: number;
  rowsUpdated: number;
  durationSeconds: number;
  apiCalls: number;
  warnings?: string[];
}

export interface RunFailContext {
  runId: string;
  source: IngestionSource;
  errorClass:
    | 'quota_exceeded'
    | 'auth_failure'
    | 'network'
    | 'schema_drift'
    | 'db_constraint'
    | 'unknown';
  errorMessage: string;
  partialRowsInserted: number;
  retryScheduled: boolean;
}

@Injectable()
export class SeoMonitoringRunsService {
  private readonly logger = new Logger(SeoMonitoringRunsService.name);

  /**
   * Started event — appelé en début de fetch. Retourne un run_id à passer
   * aux completion/fail handlers.
   */
  async logStarted(
    supabase: SupabaseClient,
    ctx: RunStartContext,
  ): Promise<string> {
    const runId = randomUUID();
    const { error } = await supabase.from('__seo_event_log').insert({
      event_type: 'ingestion_run_started',
      severity: 'info',
      payload: {
        run_id: runId,
        source: ctx.source,
        scope: ctx.scope,
        expected_pages: ctx.expectedPages ?? null,
      },
    });
    if (error) {
      this.logger.error(`event_log insert failed (started): ${error.message}`);
    }
    return runId;
  }

  /**
   * Completed event — appelé en fin de fetch réussi (incl. partial OK).
   */
  async logCompleted(
    supabase: SupabaseClient,
    ctx: RunCompleteContext,
  ): Promise<void> {
    const { error } = await supabase.from('__seo_event_log').insert({
      event_type: 'ingestion_run_completed',
      severity: 'info',
      payload: {
        run_id: ctx.runId,
        source: ctx.source,
        rows_inserted: ctx.rowsInserted,
        rows_updated: ctx.rowsUpdated,
        duration_seconds: ctx.durationSeconds,
        api_calls: ctx.apiCalls,
        warnings: ctx.warnings ?? [],
      },
      resolved_at: new Date().toISOString(),
    });
    if (error) {
      this.logger.error(
        `event_log insert failed (completed): ${error.message}`,
      );
    }
  }

  /**
   * V0.A — Health snapshot par source.
   *
   * Retourne pour chaque source (`gsc`, `ga4`, `cwv`, `gsc_links`) :
   * - `last_success_at` : created_at du dernier `ingestion_run_completed`
   * - `last_failure_at` : created_at du dernier `ingestion_run_failed`
   * - `last_failure_class` / `last_failure_message`
   *
   * Source de vérité : `__seo_event_log` (table générique typée par event_type ENUM
   * + payload JSONB — index GIN existant). Cf. plan V0.A.
   */
  async getRunsHealth(
    supabase: SupabaseClient,
    sources: IngestionSource[] = ['gsc', 'ga4', 'cwv', 'gsc_links'],
  ): Promise<
    Array<{
      source: IngestionSource;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      lastFailureClass: string | null;
      lastFailureMessage: string | null;
    }>
  > {
    const out: Awaited<ReturnType<typeof this.getRunsHealth>> = [];

    for (const source of sources) {
      const [success, failure] = await Promise.all([
        supabase
          .from('__seo_event_log')
          .select('created_at')
          .eq('event_type', 'ingestion_run_completed')
          .eq('payload->>source', source)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('__seo_event_log')
          .select('created_at, payload')
          .eq('event_type', 'ingestion_run_failed')
          .eq('payload->>source', source)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const failurePayload = (failure.data?.payload ?? null) as {
        error_class?: string;
        error_message?: string;
      } | null;

      out.push({
        source,
        lastSuccessAt: success.data?.created_at ?? null,
        lastFailureAt: failure.data?.created_at ?? null,
        lastFailureClass: failurePayload?.error_class ?? null,
        lastFailureMessage: failurePayload?.error_message ?? null,
      });
    }

    return out;
  }

  /**
   * Failed event — appelé sur échec irréversible (après retry).
   * Ne lève pas l'exception : on veut éviter de cascader la failure.
   */
  async logFailed(
    supabase: SupabaseClient,
    ctx: RunFailContext,
  ): Promise<void> {
    const severity = ctx.errorClass === 'quota_exceeded' ? 'high' : 'critical';
    const { error } = await supabase.from('__seo_event_log').insert({
      event_type: 'ingestion_run_failed',
      severity,
      payload: {
        run_id: ctx.runId,
        source: ctx.source,
        error_class: ctx.errorClass,
        error_message: ctx.errorMessage,
        partial_rows_inserted: ctx.partialRowsInserted,
        retry_scheduled: ctx.retryScheduled,
      },
    });
    if (error) {
      this.logger.error(`event_log insert failed (failed): ${error.message}`);
    }
  }
}
