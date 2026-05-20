/**
 * Regression test : SeoRecoveryMonitorService.getReport()
 *
 * Pins the verdict matrix consumed by the daily watchdog
 * (.github/workflows/seo-recovery-watchdog.yml + scripts/ci/check-seo-recovery.sh).
 */

import { ConfigService } from '@nestjs/config';
import { SeoRecoveryMonitorService } from '../../src/modules/seo/services/seo-recovery-monitor.service';

type GscRow = { date: string; impressions: number; clicks: number };

function makeConfig(env: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

/**
 * Subclass the service so we can drive the Supabase query results in tests
 * without touching the real `SupabaseBaseService` constructor. Cleaner than
 * mocking the supabase client tree.
 */
class TestableRecoveryService extends SeoRecoveryMonitorService {
  baselineRows: GscRow[] = [];
  currentRows: GscRow[] = [];
  calls: Array<{ from: string; to: string }> = [];

  constructor(config: ConfigService) {
    // Bypass `super()` which reads SUPABASE_URL/KEY and would create a client.
    // We only need the typed shape; the protected `aggregateWindow` is what we override.
    super(config);
  }

  protected async aggregateWindow(
    _urlPattern: string,
    from: string,
    to: string,
  ): Promise<{ weeklyImpressions: number; weeklyClicks: number; days: number }> {
    this.calls.push({ from, to });
    const rows = this.calls.length === 1 ? this.baselineRows : this.currentRows;
    const days = new Set(rows.map((r) => r.date)).size;
    return {
      weeklyImpressions: rows.reduce((s, r) => s + r.impressions, 0),
      weeklyClicks: rows.reduce((s, r) => s + r.clicks, 0),
      days,
    };
  }
}

const ONE_DAY_MS = 86_400_000;

describe('SeoRecoveryMonitorService.getReport', () => {
  let dateNowSpy: jest.SpyInstance;

  afterEach(() => {
    if (dateNowSpy) dateNowSpy.mockRestore();
  });

  function freezeNow(iso: string): void {
    const t = new Date(iso).getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(t);
  }

  it('returns status=in_progress within graceDays of fix', async () => {
    freezeNow('2026-05-15T10:00:00Z'); // D+2 since fix 2026-05-13
    const svc = new TestableRecoveryService(makeConfig());
    svc.baselineRows = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${13 + i}`,
      impressions: 500,
      clicks: 2,
    })); // 3500 over 7d baseline
    svc.currentRows = [
      { date: '2026-05-11', impressions: 300, clicks: 1 },
      { date: '2026-05-12', impressions: 320, clicks: 1 },
    ];

    const report = await svc.getReport();

    expect(report.status).toBe('in_progress');
    expect(report.daysSinceFix).toBe(2);
    expect(report.message).toMatch(/too early/i);
  });

  it('returns status=recovered when daily ratio ≥ targetRatio past graceDays', async () => {
    freezeNow('2026-05-21T10:00:00Z'); // D+8 since fix
    const svc = new TestableRecoveryService(makeConfig());
    svc.baselineRows = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${13 + i}`,
      impressions: 500,
      clicks: 2,
    })); // baseline daily = 500
    svc.currentRows = [
      { date: '2026-05-18', impressions: 420, clicks: 2 },
      { date: '2026-05-19', impressions: 440, clicks: 2 },
      { date: '2026-05-20', impressions: 480, clicks: 3 },
    ]; // current daily ~ 446 → ratio 0.89

    const report = await svc.getReport();

    expect(report.status).toBe('recovered');
    expect(report.recoveryRatio).not.toBeNull();
    expect(report.recoveryRatio).toBeGreaterThanOrEqual(0.8);
  });

  it('returns status=degraded between graceDays and deadlineDays when ratio low', async () => {
    freezeNow('2026-05-20T10:00:00Z'); // D+7 since fix
    const svc = new TestableRecoveryService(makeConfig());
    svc.baselineRows = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${13 + i}`,
      impressions: 500,
      clicks: 2,
    }));
    svc.currentRows = [
      { date: '2026-05-18', impressions: 100, clicks: 0 },
      { date: '2026-05-19', impressions: 80, clicks: 0 },
    ]; // ratio ~ 0.18

    const report = await svc.getReport();

    expect(report.status).toBe('degraded');
    expect(report.recoveryRatio).toBeLessThan(report.targetRatio);
  });

  it('returns status=failed past deadlineDays when ratio still below target', async () => {
    freezeNow('2026-05-29T10:00:00Z'); // D+16 since fix
    const svc = new TestableRecoveryService(makeConfig());
    svc.baselineRows = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${13 + i}`,
      impressions: 500,
      clicks: 2,
    }));
    svc.currentRows = [
      { date: '2026-05-25', impressions: 150, clicks: 0 },
      { date: '2026-05-26', impressions: 200, clicks: 0 },
    ];

    const report = await svc.getReport();

    expect(report.status).toBe('failed');
    expect(report.daysSinceFix).toBeGreaterThanOrEqual(report.deadlineDays);
  });

  it('returns status=insufficient_data when current week has no rows', async () => {
    freezeNow('2026-05-25T10:00:00Z');
    const svc = new TestableRecoveryService(makeConfig());
    svc.baselineRows = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${13 + i}`,
      impressions: 500,
      clicks: 2,
    }));
    svc.currentRows = []; // GSC J-3 latency not caught up

    const report = await svc.getReport();

    expect(report.status).toBe('insufficient_data');
    expect(report.message).toMatch(/no gsc rows/i);
  });

  it('honors env overrides for target ratio and deadlines', async () => {
    freezeNow('2026-05-20T10:00:00Z'); // D+7
    const svc = new TestableRecoveryService(
      makeConfig({
        SEO_RECOVERY_TARGET_RATIO: '0.95',
        SEO_RECOVERY_GRACE_DAYS: '1',
        SEO_RECOVERY_DEADLINE_DAYS: '5',
      }),
    );
    svc.baselineRows = [{ date: '2026-04-13', impressions: 100, clicks: 1 }];
    svc.currentRows = [{ date: '2026-05-18', impressions: 90, clicks: 1 }]; // ratio 0.9

    const report = await svc.getReport();

    expect(report.targetRatio).toBe(0.95);
    expect(report.graceDays).toBe(1);
    expect(report.deadlineDays).toBe(5);
    // ratio 0.9 < 0.95 target AND days (7) >= deadline (5) → failed
    expect(report.status).toBe('failed');
  });
});
