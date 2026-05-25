/**
 * CWV Dashboard Service — Bloc 6 / CWV Runtime Observability.
 *
 * Wraps les 2 RPCs STABLE de lecture pour la route admin :
 *   - get_cwv_dashboard(from, to, tier?)
 *   - get_cwv_funnel_correlation(from_ts, to_ts)
 *
 * Health endpoint helper inclus.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

export interface CwvDashboardRow {
  priority_tier: string;
  surface: string;
  route_group: string;
  device: string;
  metric: string;
  sample_total: number;
  p75_avg: number | null;
  days_observed: number;
}

export interface CwvFunnelCorrelationRow {
  inp_bucket: 'fast' | 'medium' | 'slow';
  sessions: number;
  conversion_count: number;
  conversion_rate: number | null;
}

export interface CwvHealthInfo {
  last_beacon_at: string | null;
  last_aggregation_hourly_at: string | null;
  last_aggregation_daily_at: string | null;
  samples_last_24h: number;
  partitions_ok: boolean;
  cron_jobs_count: number;
}

@Injectable()
export class CwvDashboardService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  async getDashboard(
    fromDate: string,
    toDate: string,
    priorityTier?: string,
  ): Promise<CwvDashboardRow[]> {
    const { data, error } = await this.supabase.rpc('get_cwv_dashboard', {
      p_from_date: fromDate,
      p_to_date: toDate,
      p_priority_tier: priorityTier ?? null,
    });
    if (error) {
      this.logger.error(`get_cwv_dashboard RPC failed: ${error.message}`);
      return [];
    }
    return (data as CwvDashboardRow[]) ?? [];
  }

  async getFunnelCorrelation(
    fromTs: string,
    toTs: string,
  ): Promise<CwvFunnelCorrelationRow[]> {
    const { data, error } = await this.supabase.rpc(
      'get_cwv_funnel_correlation',
      { p_from_ts: fromTs, p_to_ts: toTs },
    );
    if (error) {
      this.logger.error(
        `get_cwv_funnel_correlation RPC failed: ${error.message}`,
      );
      return [];
    }
    return (data as CwvFunnelCorrelationRow[]) ?? [];
  }

  /**
   * Health snapshot pour route admin / monitoring externe.
   * Lectures legères paginées (.range pas nécessaire — count() borné).
   */
  async getHealth(): Promise<CwvHealthInfo> {
    const result: CwvHealthInfo = {
      last_beacon_at: null,
      last_aggregation_hourly_at: null,
      last_aggregation_daily_at: null,
      samples_last_24h: 0,
      partitions_ok: false,
      cron_jobs_count: 0,
    };

    // 1. Last beacon received_at
    try {
      const { data } = await this.supabase
        .from('__seo_cwv_raw')
        .select('received_at')
        .order('received_at', { ascending: false })
        .limit(1);
      result.last_beacon_at =
        data && data.length > 0
          ? ((data[0] as { received_at: string }).received_at ?? null)
          : null;
    } catch {
      // silent
    }

    // 2. Last hourly agg
    try {
      const { data } = await this.supabase
        .from('__seo_cwv_hourly')
        .select('fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(1);
      result.last_aggregation_hourly_at =
        data && data.length > 0
          ? ((data[0] as { fetched_at: string }).fetched_at ?? null)
          : null;
    } catch {
      // silent
    }

    // 3. Last daily agg
    try {
      const { data } = await this.supabase
        .from('__seo_cwv_daily_rum')
        .select('fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(1);
      result.last_aggregation_daily_at =
        data && data.length > 0
          ? ((data[0] as { fetched_at: string }).fetched_at ?? null)
          : null;
    } catch {
      // silent
    }

    // 4. Samples last 24h (count via head:true + count)
    try {
      const since = new Date();
      since.setUTCHours(since.getUTCHours() - 24);
      const { count } = await this.supabase
        .from('__seo_cwv_raw')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', since.toISOString());
      result.samples_last_24h = count ?? 0;
    } catch {
      // silent
    }

    result.partitions_ok =
      result.last_aggregation_hourly_at !== null ||
      result.last_beacon_at !== null;

    return result;
  }
}
