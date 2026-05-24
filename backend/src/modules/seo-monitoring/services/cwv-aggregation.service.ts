/**
 * CWV Aggregation Service — Bloc 4 / CWV Runtime Observability.
 *
 * Wraps les 2 RPCs VOLATILE :
 *   - aggregate_cwv_hourly(target_hour)     → __seo_cwv_hourly
 *   - aggregate_cwv_daily_rum(target_date)  → __seo_cwv_daily_rum
 *
 * Discipline :
 *   - Fenêtres explicites (pas de "now()" implicite côté RPC — testabilité +
 *     idempotence replay)
 *   - Skip silencieux si READ_ONLY (canon ADR-028 Option D, parité avec
 *     SeoDailyFetchProcessor)
 *   - Logs structurés rows_upserted pour observabilité
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

export interface AggregationResult {
  ok: boolean;
  rows_upserted: number;
  target: string;
  skipped?: 'read_only' | 'rpc_error';
  errorMessage?: string;
}

@Injectable()
export class CwvAggregationService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Aggregate one hour of __seo_cwv_raw → __seo_cwv_hourly.
   *
   * @param targetHour ISO timestamp truncated to hour (UTC) — e.g. '2026-05-24T13:00:00Z'.
   *                   Pass the previous full hour at run time.
   */
  async aggregateHour(targetHour: Date): Promise<AggregationResult> {
    const isoHour = this.truncToHourISO(targetHour);

    const { data, error } = await this.supabase.rpc('aggregate_cwv_hourly', {
      p_target_hour: isoHour,
    });

    if (error) {
      this.logger.error(
        `aggregate_cwv_hourly RPC failed (hour=${isoHour}): ${error.message}`,
      );
      return {
        ok: false,
        rows_upserted: 0,
        target: isoHour,
        skipped: 'rpc_error',
        errorMessage: error.message,
      };
    }

    const rows = this.extractRowsUpserted(data);
    this.logger.log(
      `✅ aggregate_cwv_hourly hour=${isoHour} rows_upserted=${rows}`,
    );
    return { ok: true, rows_upserted: rows, target: isoHour };
  }

  /**
   * Aggregate one UTC day of __seo_cwv_hourly → __seo_cwv_daily_rum.
   *
   * @param targetDate ISO date (YYYY-MM-DD UTC). Typically J-1 at run time.
   */
  async aggregateDay(targetDate: Date): Promise<AggregationResult> {
    const isoDate = this.toDateISO(targetDate);

    const { data, error } = await this.supabase.rpc('aggregate_cwv_daily_rum', {
      p_target_date: isoDate,
    });

    if (error) {
      this.logger.error(
        `aggregate_cwv_daily_rum RPC failed (date=${isoDate}): ${error.message}`,
      );
      return {
        ok: false,
        rows_upserted: 0,
        target: isoDate,
        skipped: 'rpc_error',
        errorMessage: error.message,
      };
    }

    const rows = this.extractRowsUpserted(data);
    this.logger.log(
      `✅ aggregate_cwv_daily_rum date=${isoDate} rows_upserted=${rows}`,
    );
    return { ok: true, rows_upserted: rows, target: isoDate };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private truncToHourISO(d: Date): string {
    const t = new Date(d);
    t.setUTCMinutes(0, 0, 0);
    return t.toISOString();
  }

  private toDateISO(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private extractRowsUpserted(data: unknown): number {
    // RPC retourne `RETURNS TABLE(rows_upserted INT)` → array of {rows_upserted}.
    if (!Array.isArray(data) || data.length === 0) return 0;
    const first = data[0] as Record<string, unknown>;
    const value = first?.rows_upserted;
    return typeof value === 'number' ? value : 0;
  }
}
