import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface WebhookAuditRecord {
  job_id: string;
  source: 'pdf' | 'web';
  status: 'done' | 'failed';
  files_created: string[];
  gammes_detected: string[];
  diagnostics_detected: string[];
  event_emitted: boolean;
  error_message?: string;
  processing_ms: number;
}

export interface WebhookStats {
  total: number;
  today: number;
  bySource: { pdf: number; web: number };
  successRate: number;
  gammesRefreshed: number;
  avgProcessingMs: number;
}

@Injectable()
export class WebhookAuditService extends SupabaseBaseService {
  protected override readonly logger = new Logger(WebhookAuditService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Insert a webhook audit record (fire-and-forget safe). */
  async recordWebhook(audit: WebhookAuditRecord): Promise<void> {
    const { error } = await this.supabase.from('__rag_webhook_audit').insert({
      job_id: audit.job_id,
      source: audit.source,
      status: audit.status,
      files_created: audit.files_created,
      gammes_detected: audit.gammes_detected,
      diagnostics_detected: audit.diagnostics_detected,
      event_emitted: audit.event_emitted,
      error_message: audit.error_message || null,
      processing_ms: audit.processing_ms,
    });

    if (error) {
      this.logger.warn(`Webhook audit insert failed: ${error.message}`);
    }
  }

  /** Get recent webhook calls with pagination. */
  async getRecentWebhooks(
    limit: number,
    offset: number,
  ): Promise<{ data: unknown[]; total: number }> {
    const { count } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true });

    const { data, error } = await this.supabase
      .from('__rag_webhook_audit')
      .select('*')
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Webhook audit query failed: ${error.message}`);
      return { data: [], total: 0 };
    }

    return { data: data || [], total: count || 0 };
  }

  /** Get aggregated webhook stats for the last N days. */
  async getWebhookStats(days: number): Promise<WebhookStats> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    // Total in period
    const { count: total } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', sinceIso);

    // Today count
    const { count: today } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', todayIso);

    // By source
    const { count: pdfCount } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', sinceIso)
      .eq('source', 'pdf');

    const { count: webCount } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', sinceIso)
      .eq('source', 'web');

    // Success rate
    const { count: successCount } = await this.supabase
      .from('__rag_webhook_audit')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', sinceIso)
      .eq('event_emitted', true);

    // Avg processing time + unique gammes refreshed
    const { data: aggData } = await this.supabase
      .from('__rag_webhook_audit')
      .select('processing_ms, gammes_detected')
      .gte('received_at', sinceIso)
      .eq('event_emitted', true);

    const processingTimes = (aggData || [])
      .map((r: { processing_ms: number | null }) => r.processing_ms)
      .filter((v: number | null): v is number => v !== null);
    const avgProcessingMs =
      processingTimes.length > 0
        ? Math.round(
            processingTimes.reduce((a: number, b: number) => a + b, 0) /
              processingTimes.length,
          )
        : 0;

    const allGammes = new Set<string>();
    (aggData || []).forEach((r: { gammes_detected: string[] | null }) =>
      (r.gammes_detected || []).forEach((g: string) => allGammes.add(g)),
    );

    const totalNum = total || 0;

    return {
      total: totalNum,
      today: today || 0,
      bySource: { pdf: pdfCount || 0, web: webCount || 0 },
      successRate:
        totalNum > 0 ? Math.round(((successCount || 0) / totalNum) * 100) : 0,
      gammesRefreshed: allGammes.size,
      avgProcessingMs,
    };
  }
}
