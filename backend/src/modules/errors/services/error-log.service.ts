import { TABLES } from '@repo/database-types';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ErrorLog, ErrorMetrics } from '../entities/error-log.entity';

interface ErrorEntry {
  error_code?: string | number;
  error_message?: string;
  timestamp?: string | Date;
  [key: string]: unknown;
}

export interface ErrorLogEntry {
  code: number;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

type XtrMsgRow = {
  msg_id: string;
  msg_cst_id: string | null;
  msg_cnfa_id: string | null;
  msg_ord_id: string | null;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_parent_id: string | null;
  msg_open: string;
  msg_close: string;
};

type Pending = { row: XtrMsgRow; signature: string; metadata: unknown };

const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|mediapartners|bingpreview|duckduck|yandex|baiduspider|semrushbot|ahrefsbot|mj12bot|googlebot-image|imgproxy/i;

@Injectable()
export class ErrorLogService
  extends SupabaseBaseService
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly FLUSH_INTERVAL_MS = 5_000;
  private static readonly BATCH_MAX = 500;
  private static readonly BUFFER_MAX = 2_000;
  private static readonly DEDUP_TTL_MS = 60_000;
  private static readonly BREAKER_FAIL_LIMIT = 3;
  private static readonly BREAKER_SILENT_MS = 60_000;

  private buffer: Pending[] = [];
  private dedup = new Map<string, number>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private silentUntilMs = 0;
  private droppedSinceLastLog = 0;

  constructor(configService: ConfigService) {
    super(configService);
  }

  onModuleInit(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, ErrorLogService.FLUSH_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush().catch(() => {});
  }

  async logError(entry: ErrorLogEntry): Promise<void>;
  async logError(errorData: Partial<ErrorLog>): Promise<ErrorLog | null>;
  async logError(
    entryOrErrorData: ErrorLogEntry | Partial<ErrorLog>,
  ): Promise<void | ErrorLog | null> {
    const isLegacy = this.isErrorLogEntry(entryOrErrorData);
    const ua = this.extractUserAgent(entryOrErrorData);

    if (this.isBot(ua) && this.isClientErrorCode(entryOrErrorData)) {
      this.logger.debug(
        `Skipping bot 4xx log [${this.summarize(entryOrErrorData)}]`,
      );
      return isLegacy ? undefined : null;
    }

    const pending = this.build(entryOrErrorData);
    if (!pending) return isLegacy ? undefined : null;

    this.enqueue(pending);

    if (isLegacy) return;
    return {
      msg_id: pending.row.msg_id,
      msg_cst_id: pending.row.msg_cst_id ?? undefined,
      msg_cnfa_id: pending.row.msg_cnfa_id ?? undefined,
      msg_ord_id: pending.row.msg_ord_id ?? undefined,
      msg_date: new Date(pending.row.msg_date),
      msg_subject: pending.row.msg_subject,
      msg_content: pending.row.msg_content,
      msg_parent_id: pending.row.msg_parent_id ?? undefined,
      msg_open: pending.row.msg_open,
      msg_close: pending.row.msg_close,
      errorMetadata: pending.metadata as ErrorLog['errorMetadata'],
    };
  }

  private build(entry: ErrorLogEntry | Partial<ErrorLog>): Pending | null {
    if (this.isErrorLogEntry(entry)) {
      const content = {
        error_code: String(entry.code),
        error_message: `Erreur ${entry.code} sur ${entry.url}`,
        request_url: entry.url,
        user_agent: entry.userAgent,
        ip_address: entry.ipAddress,
        referrer: entry.referrer,
        session_id: entry.sessionId,
        severity: this.determineSeverityFromCode(entry.code),
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        correlation_id: this.generateCorrelationId(),
        additional_context: entry.metadata,
        user_id: entry.userId,
      };
      const row: XtrMsgRow = {
        msg_id: this.generateMessageId(),
        msg_cst_id: entry.userId ?? null,
        msg_cnfa_id: null,
        msg_ord_id: null,
        msg_date: new Date().toISOString(),
        msg_subject: `ERROR_${entry.code}`,
        msg_content: JSON.stringify(content),
        msg_parent_id: null,
        msg_open: '1',
        msg_close: '0',
      };
      return {
        row,
        signature: `${row.msg_subject}|${entry.url}|${entry.ipAddress ?? ''}`,
        metadata: content,
      };
    }

    const md: NonNullable<ErrorLog['errorMetadata']> =
      entry.errorMetadata ?? ({} as NonNullable<ErrorLog['errorMetadata']>);
    const content = {
      error_code: md.error_code || 'UnknownError',
      error_message: md.error_message || 'Erreur inconnue',
      stack_trace: md.stack_trace,
      user_agent: md.user_agent,
      ip_address: md.ip_address,
      request_url: md.request_url,
      request_method: md.request_method,
      request_body: md.request_body,
      request_headers: md.request_headers,
      response_status: md.response_status,
      severity: md.severity || 'low',
      environment: process.env.NODE_ENV || 'development',
      service_name: 'nestjs-remix-monorepo',
      correlation_id: md.correlation_id || this.generateCorrelationId(),
      session_id: md.session_id,
      additional_context: md.additional_context,
    };
    const row: XtrMsgRow = {
      msg_id: this.generateMessageId(),
      msg_cst_id: entry.msg_cst_id ?? null,
      msg_cnfa_id: entry.msg_cnfa_id ?? null,
      msg_ord_id: entry.msg_ord_id ?? null,
      msg_date: new Date().toISOString(),
      msg_subject: entry.msg_subject || String(content.error_code),
      msg_content: JSON.stringify(content),
      msg_parent_id: entry.msg_parent_id ?? null,
      msg_open: '1',
      msg_close: '0',
    };
    return {
      row,
      signature: `${row.msg_subject}|${content.request_url ?? ''}|${content.ip_address ?? ''}`,
      metadata: content,
    };
  }

  private enqueue(pending: Pending): void {
    const now = Date.now();
    const last = this.dedup.get(pending.signature);
    if (last && now - last < ErrorLogService.DEDUP_TTL_MS) {
      this.droppedSinceLastLog++;
      return;
    }
    this.dedup.set(pending.signature, now);

    if (this.buffer.length >= ErrorLogService.BUFFER_MAX) {
      this.buffer.shift();
      this.droppedSinceLastLog++;
    }
    this.buffer.push(pending);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    if (Date.now() < this.silentUntilMs) {
      const dropped = this.buffer.length;
      this.buffer.length = 0;
      this.droppedSinceLastLog += dropped;
      return;
    }

    const batch = this.buffer.splice(0, ErrorLogService.BATCH_MAX);
    const rows = batch.map((p) => p.row);

    try {
      const { error } = await this.supabase.from(TABLES.xtr_msg).insert(rows);
      if (error) throw new Error(error.message);
      this.consecutiveFailures = 0;
      this.pruneDedup();
      if (this.droppedSinceLastLog > 0) {
        this.logger.debug(
          `ErrorLog flush: ${rows.length} inserted, ${this.droppedSinceLastLog} deduped/dropped since last flush`,
        );
        this.droppedSinceLastLog = 0;
      }
    } catch (err) {
      this.consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `ErrorLog flush failed (${this.consecutiveFailures}/${ErrorLogService.BREAKER_FAIL_LIMIT}): ${msg}`,
      );
      if (this.consecutiveFailures >= ErrorLogService.BREAKER_FAIL_LIMIT) {
        this.silentUntilMs = Date.now() + ErrorLogService.BREAKER_SILENT_MS;
        this.consecutiveFailures = 0;
        this.logger.error(
          `ErrorLog circuit breaker tripped — dropping error logs for ${ErrorLogService.BREAKER_SILENT_MS / 1000}s`,
        );
      }
    }
  }

  private pruneDedup(): void {
    const cutoff = Date.now() - ErrorLogService.DEDUP_TTL_MS * 2;
    for (const [k, v] of this.dedup) {
      if (v < cutoff) this.dedup.delete(k);
    }
  }

  private isErrorLogEntry(
    entry: ErrorLogEntry | Partial<ErrorLog>,
  ): entry is ErrorLogEntry {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'code' in entry &&
      'url' in entry &&
      typeof (entry as ErrorLogEntry).code === 'number'
    );
  }

  private extractUserAgent(
    entry: ErrorLogEntry | Partial<ErrorLog>,
  ): string | undefined {
    if (this.isErrorLogEntry(entry)) return entry.userAgent;
    return entry.errorMetadata?.user_agent;
  }

  private isClientErrorCode(entry: ErrorLogEntry | Partial<ErrorLog>): boolean {
    if (this.isErrorLogEntry(entry)) {
      return entry.code >= 400 && entry.code < 500;
    }
    const code = entry.errorMetadata?.error_code;
    const n = typeof code === 'string' ? parseInt(code, 10) : Number(code);
    return Number.isFinite(n) && n >= 400 && n < 500;
  }

  private isBot(ua: string | undefined): boolean {
    return !!ua && BOT_UA_RE.test(ua);
  }

  private summarize(entry: ErrorLogEntry | Partial<ErrorLog>): string {
    if (this.isErrorLogEntry(entry)) return `${entry.code} ${entry.url}`;
    return `${entry.msg_subject ?? 'ERROR'} ${entry.errorMetadata?.request_url ?? ''}`;
  }

  private determineSeverityFromCode(
    code: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (code >= 500) return 'critical';
    if (code >= 400) return 'high';
    if (code >= 300) return 'medium';
    return 'low';
  }

  async getErrorStatistics(startDate: Date, endDate: Date) {
    try {
      const { data } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_subject', 'ERROR_STATISTICS')
        .gte('msg_date', startDate.toISOString())
        .lte('msg_date', endDate.toISOString())
        .order('msg_date', { ascending: false });

      return (data || [])
        .map((item) => {
          try {
            const stats = JSON.parse(item.msg_content || '{}');
            return {
              ...stats,
              id: item.msg_id,
              created_at: item.msg_date,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des statistiques:',
        error,
      );
      return [];
    }
  }

  async getRecentErrors(limit: number = 100) {
    try {
      const { data } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .like('msg_subject', 'ERROR_%')
        .neq('msg_subject', 'ERROR_STATISTICS')
        .order('msg_date', { ascending: false })
        .limit(limit);

      return (data || [])
        .map((item) => {
          try {
            const errorData = JSON.parse(item.msg_content || '{}');
            return {
              id: item.msg_id,
              error_code: errorData.error_code,
              url: errorData.request_url || errorData.url,
              user_agent: errorData.user_agent,
              ip_address: errorData.ip_address,
              referrer: errorData.referrer,
              user_id: errorData.user_id || item.msg_cst_id,
              session_id: errorData.session_id,
              metadata: errorData.additional_context || errorData.metadata,
              created_at: item.msg_date,
              severity: errorData.severity,
              error_message: errorData.error_message,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des erreurs récentes:',
        error,
      );
      return [];
    }
  }

  async getErrors(options: {
    page?: number;
    limit?: number;
    severity?: string;
    resolved?: boolean;
    service?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: ErrorLog[]; total: number }> {
    try {
      const { page = 1, limit = 50, resolved, startDate, endDate } = options;

      let query = this.supabase
        .from(TABLES.xtr_msg)
        .select('*', { count: 'exact' })
        .order('msg_date', { ascending: false });

      if (typeof resolved === 'boolean') {
        query = query.eq('msg_open', resolved ? '0' : '1');
      }

      if (startDate) {
        query = query.gte('msg_date', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('msg_date', endDate.toISOString());
      }

      const { data, error, count } = await query.range(
        (page - 1) * limit,
        page * limit - 1,
      );

      if (error) {
        this.logger.error('Erreur lors de la récupération des erreurs:', error);
        return { data: [], total: 0 };
      }

      return { data: data || [], total: count || 0 };
    } catch (error) {
      this.logger.error('Erreur dans getErrors:', error);
      return { data: [], total: 0 };
    }
  }

  async resolveError(errorId: string, resolvedBy: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', errorId);

      if (error) {
        this.logger.error("Erreur lors de la résolution de l'erreur:", error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Erreur dans resolveError:', error);
      return false;
    }
  }

  async getErrorMetrics(
    period: '24h' | '7d' | '30d' = '24h',
  ): Promise<ErrorMetrics> {
    try {
      const periodMs = this.getPeriodInMs(period);
      const startDate = new Date(Date.now() - periodMs);

      const { data: errors, error } = await this.supabase
        .from('error_logs')
        .select('error_code, error_message, severity, service_name, timestamp')
        .gte('timestamp', startDate.toISOString());

      if (error || !errors) {
        this.logger.error(
          'Erreur lors de la récupération des métriques:',
          error,
        );
        return this.getEmptyMetrics();
      }

      const totalErrors = errors.length;
      const errorsBySeverity = this.groupBy(errors, 'severity');
      const errorsByService = this.groupBy(errors, 'service_name');

      const errorCounts = this.countErrors(errors);
      const mostCommonErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, count]) => {
          const [code, message] = key.split('|');
          return { code, message, count };
        });

      const errorRate24h = this.calculateErrorRate(errors, '24h');

      return {
        total_errors: totalErrors,
        errors_by_severity: errorsBySeverity,
        errors_by_service: errorsByService,
        error_rate_24h: errorRate24h,
        most_common_errors: mostCommonErrors,
      };
    } catch (error) {
      this.logger.error('Erreur dans getErrorMetrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('error_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id');

      if (error) {
        this.logger.error('Erreur lors du nettoyage des logs:', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      this.logger.log(`${deletedCount} anciens logs supprimés`);

      return deletedCount;
    } catch (error) {
      this.logger.error('Erreur dans cleanupOldLogs:', error);
      return 0;
    }
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPeriodInMs(period: string): number {
    switch (period) {
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private groupBy(
    array: Record<string, unknown>[],
    key: string,
  ): Record<string, number> {
    return array.reduce<Record<string, number>>((acc, item) => {
      const value = String(item[key] || 'unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private countErrors(errors: ErrorEntry[]): Record<string, number> {
    return errors.reduce<Record<string, number>>((acc, error) => {
      const key = `${error.error_code}|${error.error_message}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateErrorRate(errors: ErrorEntry[], period: string): number {
    const periodMs = this.getPeriodInMs(period);
    const now = Date.now();
    const recentErrors = errors.filter(
      (error) => now - new Date(error.timestamp).getTime() < periodMs,
    );

    return recentErrors.length / (periodMs / (60 * 60 * 1000)) || 0;
  }

  private getEmptyMetrics(): ErrorMetrics {
    return {
      total_errors: 0,
      errors_by_severity: {},
      errors_by_service: {},
      error_rate_24h: 0,
      most_common_errors: [],
    };
  }
}
