/**
 * CrUX Alerter Service — evaluates field metrics and emits state-machine alerts.
 *
 * Two detectors :
 *  - Detector A (absolute) : Google Web Vitals thresholds (LCP/INP/CLS WARN+CRIT)
 *  - Detector B (delta)    : Δ% current period vs median(trailing 4 periods)
 *                            V1 origin-level only (URL-level Δ% noisy)
 *
 * State machine : OPEN → STILL_OPEN (J+7 weekly digest) → RESOLVED, persisted in
 * `__seo_crux_alert_state`. Fire-once anti-spam.
 *
 * Sinks (PR-4 stubs, wired in PR-5) :
 *  - Slack webhook `#seo-alerts`
 *  - Sentry event
 *  - Prometheus counter `crux_alert_total{severity, metric, state}`
 *
 * Refs :
 *  - ADR-063 (Accepted 2026-05-14)
 *  - CRUX_ABSOLUTE_THRESHOLDS / CRUX_DELTA_THRESHOLDS (packages/seo-types/src/crux.ts)
 *  - 20260514_seo_crux_field_history.sql (__seo_crux_alert_state)
 *
 * NOTE : ce service est DORMANT en PR-4 (pas branché à un trigger). Le wiring
 * processor BullMQ arrive en PR-5.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import {
  CRUX_ABSOLUTE_THRESHOLDS,
  CRUX_DELTA_THRESHOLDS,
  CruxAlertDetector,
  CruxAlertSeverity,
  CruxAlertState,
  CruxFormFactor,
  CruxMetricKey,
} from '@repo/seo-types';

const STILL_OPEN_DAYS_THRESHOLD = 7;
const DELTA_BASELINE_PERIODS = 4;

export interface CruxObservation {
  origin: string;
  url: string | null;
  form_factor: CruxFormFactor;
  metric: CruxMetricKey;
  /** Current period p75 value (ms for LCP/INP/TTFB/FCP, unitless for CLS). */
  current: number | null;
}

export interface CruxAlertEvent {
  origin: string;
  url: string | null;
  form_factor: CruxFormFactor;
  metric: CruxMetricKey;
  detector: CruxAlertDetector;
  severity: CruxAlertSeverity;
  state: CruxAlertState;
  observedValue: number;
  baselineMedian: number | null;
  deltaPct: number | null;
}

export interface AlerterRunResult {
  evaluated: number;
  emittedOpen: number;
  emittedStillOpen: number;
  emittedResolved: number;
  errors: string[];
}

@Injectable()
export class CruxAlerterService {
  private readonly logger = new Logger(CruxAlerterService.name);
  private readonly supabase: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('SUPABASE_URL') ?? '';
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'CruxAlerterService: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ─── Detector A (absolute Google thresholds) ─────────────────────────────

  /**
   * Pure function : evaluate an observation against Google Web Vitals thresholds.
   * Returns severity to raise, or null if metric is within "good" range.
   */
  evaluateAbsolute(
    metric: CruxMetricKey,
    value: number,
  ): CruxAlertSeverity | null {
    if (metric === 'lcp') {
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.lcp.crit_ms) return 'CRIT';
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.lcp.warn_ms) return 'WARN';
      return null;
    }
    if (metric === 'inp') {
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.inp.crit_ms) return 'CRIT';
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.inp.warn_ms) return 'WARN';
      return null;
    }
    if (metric === 'cls') {
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.cls.crit) return 'CRIT';
      if (value >= CRUX_ABSOLUTE_THRESHOLDS.cls.warn) return 'WARN';
      return null;
    }
    // ttfb / fcp : no Google absolute threshold in V1 (informational only)
    return null;
  }

  // ─── Detector B (Δ% vs trailing-4 baseline, V1 origin-level only) ────────

  /**
   * Compute median of an array. Returns null if empty.
   */
  private median(values: number[]): number | null {
    const cleaned = values.filter((v) => Number.isFinite(v));
    if (cleaned.length === 0) return null;
    const sorted = [...cleaned].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Pure function : evaluate a Δ% drift. Returns severity if exceeds thresholds.
   *
   * V1 origin-level only — caller MUST guard by `url === null`.
   * Returns null if : value within thresholds, OR baseline too small to compute.
   */
  evaluateDelta(
    metric: CruxMetricKey,
    current: number,
    trailingBaseline: number[],
  ): {
    severity: CruxAlertSeverity | null;
    baselineMedian: number | null;
    deltaPct: number | null;
  } {
    if (trailingBaseline.length < DELTA_BASELINE_PERIODS) {
      return { severity: null, baselineMedian: null, deltaPct: null };
    }
    const baselineMedian = this.median(trailingBaseline);
    if (baselineMedian === null || baselineMedian <= 0) {
      return { severity: null, baselineMedian, deltaPct: null };
    }

    const absDelta = current - baselineMedian;
    const deltaPct = (absDelta / baselineMedian) * 100;

    if (metric === 'lcp') {
      const t = CRUX_DELTA_THRESHOLDS.lcp;
      if (deltaPct >= t.crit_pct && absDelta >= t.crit_min_ms) {
        return { severity: 'CRIT', baselineMedian, deltaPct };
      }
      if (deltaPct >= t.warn_pct && absDelta >= t.warn_min_ms) {
        return { severity: 'WARN', baselineMedian, deltaPct };
      }
    } else if (metric === 'inp') {
      const t = CRUX_DELTA_THRESHOLDS.inp;
      if (deltaPct >= t.crit_pct && absDelta >= t.crit_min_ms) {
        return { severity: 'CRIT', baselineMedian, deltaPct };
      }
      if (deltaPct >= t.warn_pct && absDelta >= t.warn_min_ms) {
        return { severity: 'WARN', baselineMedian, deltaPct };
      }
    } else if (metric === 'cls') {
      const t = CRUX_DELTA_THRESHOLDS.cls;
      if (deltaPct >= t.crit_pct && absDelta >= t.crit_min) {
        return { severity: 'CRIT', baselineMedian, deltaPct };
      }
      if (deltaPct >= t.warn_pct && absDelta >= t.warn_min) {
        return { severity: 'WARN', baselineMedian, deltaPct };
      }
    }

    return { severity: null, baselineMedian, deltaPct };
  }

  // ─── State machine ──────────────────────────────────────────────────────

  /**
   * Pure function : decide the next state given current persisted state and
   * the result of fresh detector evaluation.
   *
   * Logic :
   *  - new severity null AND existing state in (OPEN, STILL_OPEN) → RESOLVED
   *  - new severity null AND no existing state           → no-op (null)
   *  - new severity set AND no existing state            → OPEN
   *  - new severity set AND existing state OPEN/STILL_OPEN with same severity
   *    AND last_emitted_at > 7 days ago                  → STILL_OPEN (weekly)
   *  - new severity set AND existing state OPEN/STILL_OPEN within 7 days → null
   *    (anti-spam, already alerted)
   *  - new severity set AND severity escalated (WARN→CRIT) → OPEN (re-fire)
   *  - new severity set AND existing state RESOLVED      → OPEN (re-open)
   */
  transitionState(
    existing: {
      state: CruxAlertState;
      severity: CruxAlertSeverity;
      lastEmittedAt: Date;
    } | null,
    newSeverity: CruxAlertSeverity | null,
    now: Date = new Date(),
  ): CruxAlertState | null {
    if (newSeverity === null) {
      if (existing && existing.state !== 'RESOLVED') {
        return 'RESOLVED';
      }
      return null;
    }

    if (!existing || existing.state === 'RESOLVED') {
      return 'OPEN';
    }

    // Escalation : WARN → CRIT re-opens
    if (existing.severity === 'WARN' && newSeverity === 'CRIT') {
      return 'OPEN';
    }

    // Same severity, anti-spam check
    const daysSinceLastEmit =
      (now.getTime() - existing.lastEmittedAt.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSinceLastEmit >= STILL_OPEN_DAYS_THRESHOLD) {
      return 'STILL_OPEN';
    }

    // Already alerted within last 7 days, no new emission
    return null;
  }

  // ─── Multi-sink dispatch (stubs, wired in PR-5) ──────────────────────────

  /**
   * Emit a single alert across all sinks. PR-4 logs locally — PR-5 will wire
   * Slack webhook, Sentry SDK, and Prometheus registry. Each sink is fire-and-
   * forget to ensure one sink failure does not block the others.
   */
  async emitAlert(event: CruxAlertEvent): Promise<void> {
    const tag = event.url ? `url=${event.url}` : `origin=${event.origin}`;
    const deltaStr =
      event.deltaPct !== null ? `Δ${event.deltaPct.toFixed(1)}%` : '';
    this.logger.warn(
      `[${event.state}] ${event.severity} ${event.metric.toUpperCase()} ${tag} ${event.form_factor} value=${event.observedValue} ${deltaStr} (detector=${event.detector})`,
    );

    // PR-5 stubs : Slack / Sentry / Prom not yet wired.
    // Persist state machine row so anti-spam logic works between runs.
    await this.persistState(event);
  }

  /**
   * Daily orchestration entry point (PR-5).
   *
   * Queries the latest period from `__seo_crux_field_history`, applies
   * detectors A (absolute, all rows) + B (Δ%, origin-level rows only),
   * transitions state, and emits alerts.
   *
   * Returns a per-run summary. Errors caught per-row to avoid one bad row
   * blocking the rest.
   */
  async runDailyEvaluation(): Promise<AlerterRunResult> {
    const result: AlerterRunResult = {
      evaluated: 0,
      emittedOpen: 0,
      emittedStillOpen: 0,
      emittedResolved: 0,
      errors: [],
    };

    // Step 1 — Fetch latest collection period rows (origin + URLs)
    const { data: latestRows, error: latestErr } = await this.supabase
      .from('__seo_crux_field_history')
      .select(
        'origin, url, form_factor, collection_period_end_date, p75_lcp_ms, p75_inp_ms, p75_cls',
      )
      .order('collection_period_end_date', { ascending: false })
      .limit(1000);

    if (latestErr) {
      result.errors.push(`latest rows query failed: ${latestErr.message}`);
      return result;
    }
    if (!latestRows || latestRows.length === 0) {
      return result;
    }

    // Group by (origin, url, form_factor) and keep only the most recent period per group
    const latestByGroup = new Map<
      string,
      {
        origin: string;
        url: string | null;
        form_factor: CruxFormFactor;
        p75_lcp_ms: number | null;
        p75_inp_ms: number | null;
        p75_cls: number | null;
        end_date: string;
      }
    >();
    for (const row of latestRows as Array<{
      origin: string;
      url: string | null;
      form_factor: CruxFormFactor;
      collection_period_end_date: string;
      p75_lcp_ms: number | null;
      p75_inp_ms: number | null;
      p75_cls: number | null;
    }>) {
      const key = `${row.origin}|${row.url ?? ''}|${row.form_factor}`;
      if (!latestByGroup.has(key)) {
        latestByGroup.set(key, {
          origin: row.origin,
          url: row.url,
          form_factor: row.form_factor,
          p75_lcp_ms: row.p75_lcp_ms,
          p75_inp_ms: row.p75_inp_ms,
          p75_cls: row.p75_cls,
          end_date: row.collection_period_end_date,
        });
      }
    }

    // Step 2 — For each group, evaluate detectors
    const metricKeys: CruxMetricKey[] = ['lcp', 'inp', 'cls'];

    for (const group of latestByGroup.values()) {
      for (const metric of metricKeys) {
        const value = this.getMetricValue(group, metric);
        if (value === null) continue;
        result.evaluated++;

        try {
          // Detector A (absolute) — all rows
          const sevA = this.evaluateAbsolute(metric, value);

          // Detector B (delta) — origin-level only (V1)
          let sevB: CruxAlertSeverity | null = null;
          let baselineMedian: number | null = null;
          let deltaPct: number | null = null;
          if (group.url === null) {
            const baseline = await this.fetchBaseline(
              group.origin,
              group.form_factor,
              metric,
              group.end_date,
            );
            const eval2 = this.evaluateDelta(metric, value, baseline);
            sevB = eval2.severity;
            baselineMedian = eval2.baselineMedian;
            deltaPct = eval2.deltaPct;
          }

          // Pick the more severe of the two detectors (CRIT > WARN > null)
          const sev = this.pickWorseSeverity(sevA, sevB);
          const detector: CruxAlertDetector =
            sev !== null && sev === sevB ? 'delta' : 'absolute';

          // Load existing state for transition decision
          const existing = await this.loadExistingState(
            group.origin,
            group.url,
            group.form_factor,
            metric,
          );
          const newState = this.transitionState(existing, sev);
          if (newState === null) continue;

          await this.emitAlert({
            origin: group.origin,
            url: group.url,
            form_factor: group.form_factor,
            metric,
            detector,
            severity: sev ?? existing?.severity ?? 'WARN',
            state: newState,
            observedValue: value,
            baselineMedian,
            deltaPct,
          });

          if (newState === 'OPEN') result.emittedOpen++;
          else if (newState === 'STILL_OPEN') result.emittedStillOpen++;
          else if (newState === 'RESOLVED') result.emittedResolved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(
            `eval ${group.origin}|${group.url ?? ''}|${group.form_factor}|${metric}: ${msg}`,
          );
        }
      }
    }

    return result;
  }

  /** Extract the appropriate metric value from a row. */
  private getMetricValue(
    row: {
      p75_lcp_ms: number | null;
      p75_inp_ms: number | null;
      p75_cls: number | null;
    },
    metric: CruxMetricKey,
  ): number | null {
    if (metric === 'lcp') return row.p75_lcp_ms;
    if (metric === 'inp') return row.p75_inp_ms;
    if (metric === 'cls') return row.p75_cls;
    return null;
  }

  /** Pick the more severe of two severities (CRIT > WARN > null). */
  private pickWorseSeverity(
    a: CruxAlertSeverity | null,
    b: CruxAlertSeverity | null,
  ): CruxAlertSeverity | null {
    if (a === 'CRIT' || b === 'CRIT') return 'CRIT';
    if (a === 'WARN' || b === 'WARN') return 'WARN';
    return null;
  }

  /** Fetch trailing-4 baseline values for delta detector. */
  private async fetchBaseline(
    origin: string,
    form_factor: CruxFormFactor,
    metric: CruxMetricKey,
    excludeEndDate: string,
  ): Promise<number[]> {
    const column =
      metric === 'lcp'
        ? 'p75_lcp_ms'
        : metric === 'inp'
          ? 'p75_inp_ms'
          : 'p75_cls';
    const { data, error } = await this.supabase
      .from('__seo_crux_field_history')
      .select(`${column}, collection_period_end_date`)
      .eq('origin', origin)
      .is('url', null)
      .eq('form_factor', form_factor)
      .lt('collection_period_end_date', excludeEndDate)
      .order('collection_period_end_date', { ascending: false })
      .limit(DELTA_BASELINE_PERIODS);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>)
      .map((r) => r[column])
      .filter((v): v is number => typeof v === 'number');
  }

  /** Load existing alert state for a target. */
  private async loadExistingState(
    origin: string,
    url: string | null,
    form_factor: CruxFormFactor,
    metric: CruxMetricKey,
  ): Promise<{
    state: CruxAlertState;
    severity: CruxAlertSeverity;
    lastEmittedAt: Date;
  } | null> {
    const { data, error } = await this.supabase
      .from('__seo_crux_alert_state')
      .select('state, severity, last_emitted_at')
      .eq('origin', origin)
      .eq('url_key', url ?? '')
      .eq('form_factor', form_factor)
      .eq('metric', metric)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      state: CruxAlertState;
      severity: CruxAlertSeverity;
      last_emitted_at: string;
    };
    return {
      state: row.state,
      severity: row.severity,
      lastEmittedAt: new Date(row.last_emitted_at),
    };
  }

  /**
   * Upsert into `__seo_crux_alert_state`. PK conflict on
   * (origin, url_key, form_factor, metric) → UPDATE.
   * `url_key` generated server-side, omitted from payload.
   */
  private async persistState(event: CruxAlertEvent): Promise<void> {
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      origin: event.origin,
      url: event.url,
      form_factor: event.form_factor,
      metric: event.metric,
      state: event.state,
      severity: event.severity,
      detector: event.detector,
      last_emitted_at: now,
      last_observed_value: event.observedValue,
      last_baseline_median: event.baselineMedian,
      last_delta_pct: event.deltaPct,
    };
    if (event.state === 'OPEN') row.opened_at = now;
    if (event.state === 'RESOLVED') row.resolved_at = now;

    const { error } = await this.supabase
      .from('__seo_crux_alert_state')
      .upsert(row, {
        onConflict: 'origin,url_key,form_factor,metric',
        ignoreDuplicates: false,
      });
    if (error) {
      this.logger.error(`persistState upsert failed: ${error.message}`);
    }
  }
}
