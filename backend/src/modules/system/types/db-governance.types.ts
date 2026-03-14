export type MetricId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6';

// Row types for each M-query result
export interface M1TableRow {
  schemaname: string;
  table_name: string;
  total_size: string;
  data_size: string;
  index_size: string;
  n_live_tup: number;
}

export interface M2IndexRow {
  schemaname: string;
  table_name: string;
  index_name: string;
  index_size: string;
  idx_scan: number;
}

export interface M3StaleRow {
  schemaname: string;
  relname: string;
  last_autoanalyze: string | null;
  last_autovacuum: string | null;
  n_live_tup: number;
  size: string;
}

export interface M4DeadRow {
  schemaname: string;
  relname: string;
  n_dead_tup: number;
  n_live_tup: number;
  dead_pct: number;
  last_autovacuum: string | null;
  size: string;
}

export interface M5SeqRow {
  schemaname: string;
  relname: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  avg_rows_per_scan: number;
  n_live_tup: number;
}

export interface M6UnusedRow {
  schemaname: string;
  table_name: string;
  index_name: string;
  index_size: string;
  idx_scan: number;
  idx_tup_read: number;
}

export type MetricRow =
  | M1TableRow
  | M2IndexRow
  | M3StaleRow
  | M4DeadRow
  | M5SeqRow
  | M6UnusedRow;

export interface GovernanceAlert {
  metric_id: MetricId;
  level: 'warning' | 'critical';
  message: string;
  object_name: string;
}

export interface GovernanceMetricResult {
  metric_id: MetricId;
  rows: MetricRow[];
  alerts: GovernanceAlert[];
  duration_ms: number;
}

export interface GovernanceReport {
  metrics: GovernanceMetricResult[];
  total_alerts: number;
  collected_at: string;
}

export interface GovernanceSnapshot {
  id: string;
  metric_id: MetricId;
  payload: MetricRow[];
  alerts: GovernanceAlert[];
  created_at: string;
}

export interface GovernanceTrend {
  metric_id: MetricId;
  current: GovernanceSnapshot | null;
  previous: GovernanceSnapshot | null;
  delta_summary: string;
}
