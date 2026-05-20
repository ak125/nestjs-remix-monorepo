/**
 * SeoRecoveryMonitorService — observable recovery report after the
 * traffic-drop incident 2026-04-22 → 2026-05-13.
 *
 * Pourquoi ce service existe
 * --------------------------
 * PR #487 a restauré la régénération automatique du sitemap. Reste à
 * vérifier que Google re-crawl effectivement et que les impressions
 * `/pieces/*` reviennent à leur baseline pré-incident (~3666/sem en W17).
 * Sans automation, ce monitoring impose une requête SQL quotidienne
 * pendant 14 jours. Ce service automatise : il calcule le ratio de
 * recovery (impressions semaine en cours / baseline) et émet un verdict
 * qu'un workflow GitHub Actions probe daily.
 *
 * Configuration (tous tunables via env, défauts ciblés sur l'incident actuel)
 * --------------------------------------------------------------------------
 *   SEO_RECOVERY_URL_PATTERN          (default '/pieces/%')
 *   SEO_RECOVERY_BASELINE_FROM        (default '2026-04-13')
 *   SEO_RECOVERY_BASELINE_TO          (default '2026-04-20')
 *   SEO_RECOVERY_FIX_DATE             (default '2026-05-13' — PR #487 deploy)
 *   SEO_RECOVERY_TARGET_RATIO         (default '0.80' — 80% baseline = OK)
 *   SEO_RECOVERY_GRACE_DAYS           (default '3'  — fenêtre où on s'attend
 *                                       à voir le rebond commencer)
 *   SEO_RECOVERY_DEADLINE_DAYS        (default '14' — verdict définitif)
 *
 * Verdicts (`status` field)
 * -------------------------
 *   in_progress  — daysSinceFix < graceDays : trop tôt pour conclure
 *   recovering   — graceDays ≤ days < deadline ET ratio ≥ target : OK
 *   degraded     — graceDays ≤ days < deadline ET ratio < target : warn,
 *                  pas encore fail
 *   recovered    — ratio ≥ target ET days ≥ graceDays : succès clair
 *   failed       — days ≥ deadline ET ratio < target : échec, ouvrir
 *                  une nouvelle Phase −1 (cause différente du sitemap)
 *   insufficient_data — pas assez de rows dans la semaine en cours (cron
 *                       J-3 GSC pas encore arrivé, ou trop tôt après deploy)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { getErrorMessage } from '@common/utils/error.utils';

export type RecoveryStatus =
  | 'in_progress'
  | 'recovering'
  | 'degraded'
  | 'recovered'
  | 'failed'
  | 'insufficient_data';

export interface SeoRecoveryReport {
  fixDate: string;
  daysSinceFix: number;
  baselineWindow: { from: string; to: string };
  baseline: {
    weeklyImpressions: number;
    weeklyClicks: number;
    days: number;
  };
  current: {
    weekStart: string;
    weeklyImpressions: number;
    weeklyClicks: number;
    days: number;
  };
  recoveryRatio: number | null;
  targetRatio: number;
  graceDays: number;
  deadlineDays: number;
  status: RecoveryStatus;
  /** Human-readable explanation surfaced in CI logs. */
  message: string;
}

@Injectable()
export class SeoRecoveryMonitorService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    SeoRecoveryMonitorService.name,
  );

  constructor(configService: ConfigService) {
    super(configService);
  }

  async getReport(): Promise<SeoRecoveryReport> {
    const urlPattern = this.envStr('SEO_RECOVERY_URL_PATTERN', '/pieces/%');
    const baselineFrom = this.envStr(
      'SEO_RECOVERY_BASELINE_FROM',
      '2026-04-13',
    );
    const baselineTo = this.envStr('SEO_RECOVERY_BASELINE_TO', '2026-04-20');
    const fixDate = this.envStr('SEO_RECOVERY_FIX_DATE', '2026-05-13');
    const targetRatio = this.envFloat('SEO_RECOVERY_TARGET_RATIO', 0.8);
    const graceDays = this.envInt('SEO_RECOVERY_GRACE_DAYS', 3);
    const deadlineDays = this.envInt('SEO_RECOVERY_DEADLINE_DAYS', 14);

    const daysSinceFix = Math.floor(
      (Date.now() - new Date(fixDate).getTime()) / 86_400_000,
    );

    // 1. Baseline (pre-incident week)
    const baseline = await this.aggregateWindow(
      urlPattern,
      baselineFrom,
      baselineTo,
    );

    // 2. Current week — use ISO week start (Monday)
    const now = new Date();
    const dayOfWeek = (now.getUTCDay() + 6) % 7; // Mon=0, Sun=6
    const weekStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - dayOfWeek,
      ),
    );
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const current = await this.aggregateWindow(
      urlPattern,
      weekStartIso,
      today,
    );

    // 3. Verdict
    const baselineDaily =
      baseline.weeklyImpressions / Math.max(baseline.days, 1);
    const currentDaily = current.weeklyImpressions / Math.max(current.days, 1);
    const recoveryRatio =
      baselineDaily > 0
        ? Number((currentDaily / baselineDaily).toFixed(3))
        : null;

    let status: RecoveryStatus;
    let message: string;

    if (current.days === 0) {
      status = 'insufficient_data';
      message = `No GSC rows in the current week (since ${weekStartIso}). GSC has a J-3 latency — wait for the daily-fetch cron.`;
    } else if (daysSinceFix < graceDays) {
      status = 'in_progress';
      message = `D+${daysSinceFix} (grace ${graceDays}d) — too early to conclude. Ratio so far: ${recoveryRatio}.`;
    } else if (recoveryRatio !== null && recoveryRatio >= targetRatio) {
      status = 'recovered';
      message = `D+${daysSinceFix}, ratio ${recoveryRatio} ≥ target ${targetRatio}. Recovery successful.`;
    } else if (daysSinceFix >= deadlineDays) {
      status = 'failed';
      message = `D+${daysSinceFix} (deadline ${deadlineDays}d), ratio ${recoveryRatio} < target ${targetRatio}. Open a fresh Phase −1 — the cause is not (only) sitemap freshness.`;
    } else if (recoveryRatio !== null && recoveryRatio >= targetRatio * 0.6) {
      status = 'recovering';
      message = `D+${daysSinceFix}, ratio ${recoveryRatio} on track toward target ${targetRatio}.`;
    } else {
      status = 'degraded';
      message = `D+${daysSinceFix}, ratio ${recoveryRatio} stalled. Not yet a failure (deadline ${deadlineDays}d) but warrants attention.`;
    }

    return {
      fixDate,
      daysSinceFix,
      baselineWindow: { from: baselineFrom, to: baselineTo },
      baseline,
      current: {
        weekStart: weekStartIso,
        weeklyImpressions: current.weeklyImpressions,
        weeklyClicks: current.weeklyClicks,
        days: current.days,
      },
      recoveryRatio,
      targetRatio,
      graceDays,
      deadlineDays,
      status,
      message,
    };
  }

  protected async aggregateWindow(
    urlPattern: string,
    from: string,
    to: string,
  ): Promise<{ weeklyImpressions: number; weeklyClicks: number; days: number }> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_gsc_daily')
        .select('date,impressions,clicks')
        .like('page', `%${urlPattern.replace(/^\/|\/$/g, '')}%`)
        .gte('date', from)
        .lte('date', to);
      if (error) {
        this.logger.warn(`aggregateWindow query failed: ${error.message}`);
        return { weeklyImpressions: 0, weeklyClicks: 0, days: 0 };
      }
      const rows = data ?? [];
      const distinctDays = new Set(rows.map((r) => r.date as string)).size;
      return {
        weeklyImpressions: rows.reduce(
          (s, r) => s + (Number(r.impressions) || 0),
          0,
        ),
        weeklyClicks: rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0),
        days: distinctDays,
      };
    } catch (err) {
      this.logger.warn(
        `aggregateWindow threw: ${getErrorMessage(err)} — returning zeros`,
      );
      return { weeklyImpressions: 0, weeklyClicks: 0, days: 0 };
    }
  }

  private envStr(key: string, fallback: string): string {
    const v = this.configService.get<string>(key);
    return v && v.length > 0 ? v : fallback;
  }

  private envInt(key: string, fallback: number): number {
    const v = this.configService.get<string>(key);
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  private envFloat(key: string, fallback: number): number {
    const v = this.configService.get<string>(key);
    if (!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
}
