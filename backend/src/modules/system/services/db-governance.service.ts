import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { DatabaseMonitorService } from './database-monitor.service';
import {
  MetricId,
  GovernanceMetricResult,
  GovernanceReport,
  GovernanceAlert,
  GovernanceSnapshot,
  GovernanceTrend,
  M3StaleRow,
  M4DeadRow,
  M5SeqRow,
  M6UnusedRow,
  M2IndexRow,
  MetricRow,
} from '../types/db-governance.types';

const RPC_MAP: Record<MetricId, string> = {
  M1: '__gov_m1_table_sizes',
  M2: '__gov_m2_index_sizes',
  M3: '__gov_m3_stale_stats',
  M4: '__gov_m4_dead_tuples',
  M5: '__gov_m5_seq_scans',
  M6: '__gov_m6_unused_indexes',
};

const METRIC_IDS: MetricId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

@Injectable()
export class DbGovernanceService extends SupabaseBaseService {
  protected readonly logger = new Logger(DbGovernanceService.name);

  constructor(
    configService: ConfigService,
    private readonly monitorService: DatabaseMonitorService,
  ) {
    super(configService);
  }

  async runMetric(metricId: MetricId): Promise<GovernanceMetricResult> {
    const startTime = Date.now();
    const rpcName = RPC_MAP[metricId];

    const { data, error } = await this.callRpc<MetricRow[]>(rpcName, {});

    if (error) {
      this.logger.error(
        `Failed to run ${metricId} (${rpcName}): ${error.message}`,
      );
      return {
        metric_id: metricId,
        rows: [],
        alerts: [],
        duration_ms: Date.now() - startTime,
      };
    }

    const rows = (data ?? []) as MetricRow[];
    const alerts = this.evaluateAlerts(metricId, rows);

    return {
      metric_id: metricId,
      rows,
      alerts,
      duration_ms: Date.now() - startTime,
    };
  }

  async runAllMetrics(): Promise<GovernanceReport> {
    const metrics: GovernanceMetricResult[] = [];

    for (const id of METRIC_IDS) {
      const result = await this.runMetric(id);
      metrics.push(result);
    }

    const totalAlerts = metrics.reduce((sum, m) => sum + m.alerts.length, 0);

    return {
      metrics,
      total_alerts: totalAlerts,
      collected_at: new Date().toISOString(),
    };
  }

  async collectAndStore(): Promise<GovernanceReport> {
    const report = await this.runAllMetrics();

    // Store each metric as a snapshot
    for (const metric of report.metrics) {
      const { error } = await this.supabase
        .from('__db_governance_snapshots')
        .insert({
          metric_id: metric.metric_id,
          payload: metric.rows,
          alerts: metric.alerts,
        });

      if (error) {
        this.logger.error(
          `Failed to store snapshot for ${metric.metric_id}: ${error.message}`,
        );
      }

      // Publish alerts to the existing alert system
      for (const alert of metric.alerts) {
        await this.monitorService.createAlert(
          alert.level,
          `[${alert.metric_id}] ${alert.object_name}`,
          alert.message,
          { metric_id: alert.metric_id, object_name: alert.object_name },
        );
      }
    }

    this.logger.log(
      `Governance snapshot stored: ${report.metrics.length} metrics, ${report.total_alerts} alerts`,
    );

    return report;
  }

  async getHistory(
    metricId?: MetricId,
    limit = 20,
  ): Promise<GovernanceSnapshot[]> {
    let query = this.supabase
      .from('__db_governance_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (metricId) {
      query = query.eq('metric_id', metricId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch history: ${error.message}`);
      return [];
    }

    return (data ?? []) as GovernanceSnapshot[];
  }

  async getTrend(metricId: MetricId): Promise<GovernanceTrend> {
    const { data, error } = await this.supabase
      .from('__db_governance_snapshots')
      .select('*')
      .eq('metric_id', metricId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (error || !data || data.length === 0) {
      return {
        metric_id: metricId,
        current: null,
        previous: null,
        delta_summary: 'No snapshots available',
      };
    }

    const current = data[0] as GovernanceSnapshot;
    const previous = data.length > 1 ? (data[1] as GovernanceSnapshot) : null;

    const deltaSummary = previous
      ? `Current: ${current.payload.length} rows, ${current.alerts.length} alerts. ` +
        `Previous: ${previous.payload.length} rows, ${previous.alerts.length} alerts.`
      : 'Only 1 snapshot available, no trend comparison possible.';

    return {
      metric_id: metricId,
      current,
      previous,
      delta_summary: deltaSummary,
    };
  }

  async getQuarterlyReview(): Promise<{
    collected_at: string;
    unused_indexes: GovernanceMetricResult;
    seq_scan_anomalies: GovernanceMetricResult;
    stale_stats: GovernanceMetricResult;
    dead_tuples: GovernanceMetricResult;
  }> {
    const [m3, m4, m5, m6] = await Promise.all([
      this.runMetric('M3'),
      this.runMetric('M4'),
      this.runMetric('M5'),
      this.runMetric('M6'),
    ]);

    return {
      collected_at: new Date().toISOString(),
      stale_stats: m3,
      dead_tuples: m4,
      seq_scan_anomalies: m5,
      unused_indexes: m6,
    };
  }

  // --- Alert threshold evaluation ---

  private evaluateAlerts(
    metricId: MetricId,
    rows: MetricRow[],
  ): GovernanceAlert[] {
    switch (metricId) {
      case 'M2':
        return this.evaluateM2Alerts(rows as M2IndexRow[]);
      case 'M3':
        return this.evaluateM3Alerts(rows as M3StaleRow[]);
      case 'M4':
        return this.evaluateM4Alerts(rows as M4DeadRow[]);
      case 'M5':
        return this.evaluateM5Alerts(rows as M5SeqRow[]);
      case 'M6':
        return this.evaluateM6Alerts(rows as M6UnusedRow[]);
      default:
        return [];
    }
  }

  private evaluateM2Alerts(rows: M2IndexRow[]): GovernanceAlert[] {
    return rows
      .filter((r) => r.idx_scan === 0 && this.parseSizeToMB(r.index_size) > 500)
      .map((r) => ({
        metric_id: 'M2' as MetricId,
        level: 'warning' as const,
        message: `Index 0-scan > 500MB: ${r.index_size}`,
        object_name: r.index_name,
      }));
  }

  private evaluateM3Alerts(rows: M3StaleRow[]): GovernanceAlert[] {
    return rows
      .filter((r) => this.parseSizeToMB(r.size) > 100)
      .map((r) => ({
        metric_id: 'M3' as MetricId,
        level: 'warning' as const,
        message: `Table > 100MB without ANALYZE in 3+ months (size: ${r.size})`,
        object_name: r.relname,
      }));
  }

  private evaluateM4Alerts(rows: M4DeadRow[]): GovernanceAlert[] {
    return rows
      .filter((r) => r.dead_pct > 20 || r.n_dead_tup > 1_000_000)
      .map((r) => ({
        metric_id: 'M4' as MetricId,
        level: r.dead_pct > 50 ? ('critical' as const) : ('warning' as const),
        message: `Dead tuples: ${r.n_dead_tup} (${r.dead_pct}%), size: ${r.size}`,
        object_name: r.relname,
      }));
  }

  private evaluateM5Alerts(rows: M5SeqRow[]): GovernanceAlert[] {
    return rows
      .filter((r) => r.n_live_tup > 0 && r.avg_rows_per_scan >= r.n_live_tup)
      .map((r) => ({
        metric_id: 'M5' as MetricId,
        level: 'warning' as const,
        message: `Full table scan pattern: avg ${r.avg_rows_per_scan} rows/scan vs ${r.n_live_tup} live rows`,
        object_name: r.relname,
      }));
  }

  private evaluateM6Alerts(rows: M6UnusedRow[]): GovernanceAlert[] {
    return rows
      .filter((r) => this.parseSizeToMB(r.index_size) > 100)
      .map((r) => ({
        metric_id: 'M6' as MetricId,
        level: 'warning' as const,
        message: `Unused index > 100MB: ${r.index_size}`,
        object_name: r.index_name,
      }));
  }

  private parseSizeToMB(sizeStr: string): number {
    const match = sizeStr.match(/([\d.]+)\s*(bytes|kB|MB|GB|TB)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'tb':
        return value * 1024 * 1024;
      case 'gb':
        return value * 1024;
      case 'mb':
        return value;
      case 'kb':
        return value / 1024;
      case 'bytes':
        return value / (1024 * 1024);
      default:
        return 0;
    }
  }
}
