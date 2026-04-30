import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
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

type ErrorLogRow = {
  err_created_at: string;
  err_code: string;
  err_subject: string;
  err_severity: 'low' | 'medium' | 'high' | 'critical';
  err_url: string | null;
  err_method: string | null;
  err_status: number | null;
  err_user_agent: string | null;
  err_ip: string | null;
  err_user_id: string | null;
  err_session_id: string | null;
  err_correlation: string | null;
  err_message: string | null;
  err_stack: string | null;
  err_context: Record<string, unknown> | null;
  err_env: string;
};

type Pending = { row: ErrorLogRow; signature: string };

const TABLE = '__error_logs';

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
    // INIT_TRACE: diagnostic — remove once perf-gates exit-124 is resolved

    console.warn('INIT_TRACE: error-log');
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

    // Legacy compat: synthesize an ErrorLog (msg_* shape) from our row
    return {
      msg_date: new Date(pending.row.err_created_at),
      msg_subject: pending.row.err_subject,
      msg_content: JSON.stringify(pending.row.err_context ?? {}),
      msg_open: '1',
      msg_close: '0',
      errorMetadata: this.toLegacyMetadata(pending.row),
    };
  }

  private build(entry: ErrorLogEntry | Partial<ErrorLog>): Pending | null {
    const correlation = this.generateCorrelationId();
    const now = new Date().toISOString();

    if (this.isErrorLogEntry(entry)) {
      const severity = this.determineSeverityFromCode(entry.code);
      const row: ErrorLogRow = {
        err_created_at: now,
        err_code: String(entry.code),
        err_subject: `ERROR_${entry.code}`,
        err_severity: severity,
        err_url: entry.url || null,
        err_method: null,
        err_status: entry.code,
        err_user_agent: entry.userAgent ?? null,
        err_ip: this.sanitizeIp(entry.ipAddress),
        err_user_id: entry.userId ?? null,
        err_session_id: entry.sessionId ?? null,
        err_correlation: correlation,
        err_message: `Erreur ${entry.code} sur ${entry.url}`,
        err_stack: null,
        err_context:
          (entry.metadata as Record<string, unknown> | undefined) ?? null,
        err_env: process.env.NODE_ENV || 'development',
      };
      return {
        row,
        signature: `${row.err_subject}|${row.err_url ?? ''}|${row.err_ip ?? ''}`,
      };
    }

    const md: NonNullable<ErrorLog['errorMetadata']> =
      entry.errorMetadata ?? ({} as NonNullable<ErrorLog['errorMetadata']>);

    const row: ErrorLogRow = {
      err_created_at: now,
      err_code: String(md.error_code || 'UnknownError'),
      err_subject: entry.msg_subject || `ERROR_${md.error_code || 'UNKNOWN'}`,
      err_severity: (md.severity || 'low') as ErrorLogRow['err_severity'],
      err_url: md.request_url ?? null,
      err_method: md.request_method ?? null,
      err_status: md.response_status ?? null,
      err_user_agent: md.user_agent ?? null,
      err_ip: this.sanitizeIp(md.ip_address),
      err_user_id: entry.msg_cst_id ?? null,
      err_session_id: md.session_id ?? null,
      err_correlation: md.correlation_id || correlation,
      err_message: md.error_message ?? null,
      err_stack: md.stack_trace ?? null,
      err_context: md.additional_context ?? null,
      err_env: md.environment || process.env.NODE_ENV || 'development',
    };
    return {
      row,
      signature: `${row.err_subject}|${row.err_url ?? ''}|${row.err_ip ?? ''}`,
    };
  }

  private toLegacyMetadata(row: ErrorLogRow): ErrorLog['errorMetadata'] {
    return {
      error_code: row.err_code,
      error_message: row.err_message ?? '',
      stack_trace: row.err_stack ?? undefined,
      user_agent: row.err_user_agent ?? undefined,
      ip_address: row.err_ip ?? undefined,
      request_url: row.err_url ?? undefined,
      request_method: row.err_method ?? undefined,
      response_status: row.err_status ?? undefined,
      severity: row.err_severity,
      environment: row.err_env,
      service_name: 'nestjs-remix-monorepo',
      correlation_id: row.err_correlation ?? undefined,
      session_id: row.err_session_id ?? undefined,
      additional_context: row.err_context ?? undefined,
    };
  }

  private sanitizeIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    // Postgres `inet` is picky; reject obviously invalid values
    const trimmed = ip.trim();
    if (!trimmed || trimmed === 'unknown') return null;
    return trimmed;
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
      const { error } = await this.supabase.from(TABLE).insert(rows);
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

  // ── Read paths ──

  async getErrorStatistics(_startDate: Date, _endDate: Date) {
    // Statistics are now aggregated at read-time via getErrorMetrics().
    // The legacy ERROR_STATISTICS stream (a second insert per error) has been retired.
    return [];
  }

  async getRecentErrors(limit: number = 100) {
    try {
      const { data } = await this.supabase
        .from(TABLE)
        .select('*')
        .order('err_created_at', { ascending: false })
        .limit(limit);

      return (data || []).map((row: ErrorLogRow & { err_id: number }) => ({
        id: String(row.err_id),
        error_code: row.err_code,
        url: row.err_url,
        user_agent: row.err_user_agent,
        ip_address: row.err_ip,
        referrer: null,
        user_id: row.err_user_id,
        session_id: row.err_session_id,
        metadata: row.err_context,
        created_at: row.err_created_at,
        severity: row.err_severity,
        error_message: row.err_message,
      }));
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
      const {
        page = 1,
        limit = 50,
        severity,
        resolved,
        startDate,
        endDate,
      } = options;

      let query = this.supabase
        .from(TABLE)
        .select('*', { count: 'exact' })
        .order('err_created_at', { ascending: false });

      if (severity) query = query.eq('err_severity', severity);
      if (typeof resolved === 'boolean') {
        query = resolved
          ? query.not('err_resolved_at', 'is', null)
          : query.is('err_resolved_at', null);
      }
      if (startDate)
        query = query.gte('err_created_at', startDate.toISOString());
      if (endDate) query = query.lte('err_created_at', endDate.toISOString());

      const { data, error, count } = await query.range(
        (page - 1) * limit,
        page * limit - 1,
      );

      if (error) {
        this.logger.error('Erreur lors de la récupération des erreurs:', error);
        return { data: [], total: 0 };
      }

      const rows = (data || []).map(
        (r: ErrorLogRow & { err_id: number; err_resolved_at: string | null }) =>
          ({
            msg_id: String(r.err_id),
            msg_cst_id: r.err_user_id ?? undefined,
            msg_date: new Date(r.err_created_at),
            msg_subject: r.err_subject,
            msg_content: JSON.stringify(r.err_context ?? {}),
            msg_open: r.err_resolved_at ? '0' : '1',
            msg_close: r.err_resolved_at ? '1' : '0',
            errorMetadata: this.toLegacyMetadata(r),
          }) satisfies ErrorLog,
      );

      return { data: rows, total: count || 0 };
    } catch (error) {
      this.logger.error('Erreur dans getErrors:', error);
      return { data: [], total: 0 };
    }
  }

  async resolveError(errorId: string, resolvedBy: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(TABLE)
        .update({
          err_resolved_at: new Date().toISOString(),
          err_resolved_by: resolvedBy,
        })
        .eq('err_id', Number(errorId));

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

      const { data, error } = await this.supabase
        .from(TABLE)
        .select('err_code, err_message, err_severity, err_env, err_created_at')
        .gte('err_created_at', startDate.toISOString());

      if (error || !data) {
        this.logger.error(
          'Erreur lors de la récupération des métriques:',
          error,
        );
        return this.getEmptyMetrics();
      }

      const errors: ErrorEntry[] = data.map(
        (r: {
          err_code: string;
          err_message: string | null;
          err_severity: string;
          err_env: string;
          err_created_at: string;
        }) => ({
          error_code: r.err_code,
          error_message: r.err_message ?? '',
          severity: r.err_severity,
          service_name: r.err_env,
          timestamp: r.err_created_at,
        }),
      );

      const totalErrors = errors.length;
      const errorsBySeverity = this.groupBy(
        errors as Record<string, unknown>[],
        'severity',
      );
      const errorsByService = this.groupBy(
        errors as Record<string, unknown>[],
        'service_name',
      );

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

  /**
   * Manual cleanup hook. In normal operation the pg_cron job
   * `error-logs-retention` handles 30-day retention automatically.
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from(TABLE)
        .delete()
        .lt('err_created_at', cutoff.toISOString())
        .select('err_id');

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
      (error) => now - new Date(error.timestamp!).getTime() < periodMs,
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
