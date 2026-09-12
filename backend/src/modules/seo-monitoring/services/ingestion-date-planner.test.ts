/**
 * Tests purs — planificateur d'ingestion + couverture journalière (@repo/seo-types).
 * Cas réels : arrêt d'ingestion de 18 jours (06-10→09-07), fenêtre 28 j à 13 jours absents.
 */
import {
  addDaysIso,
  assessPeriodComparability,
  computeDayCoverage,
  enumerateDatesIso,
  isIsoDate,
} from '@repo/seo-types';
import {
  ingestionWindow,
  planIngestionDates,
  resolveIngestionConfig,
} from './ingestion-date-planner';

const base = {
  anchorDate: '2026-09-08',
  rollingDays: 4,
  lookbackDays: 30,
  maxBackfillPerRun: 7,
  floorDate: '2026-06-01',
};

describe('day-coverage (@repo/seo-types)', () => {
  it('arithmétique ISO en UTC, bornes de mois et année bissextile', () => {
    expect(addDaysIso('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(enumerateDatesIso('2026-09-07', '2026-09-05')).toEqual([]);
    expect(enumerateDatesIso('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(() => addDaysIso('2026-9-1', 1)).toThrow();
  });

  it('couverture : jours manquants listés, dates hors fenêtre ignorées', () => {
    const cov = computeDayCoverage({
      from: '2026-09-01',
      to: '2026-09-05',
      presentDates: ['2026-09-01', '2026-09-03', '2026-09-05', '2026-08-31'],
    });
    expect(cov.daysExpected).toBe(5);
    expect(cov.daysPresent).toBe(3);
    expect(cov.missingDates).toEqual(['2026-09-02', '2026-09-04']);
    expect(cov.complete).toBe(false);
  });

  it('comparaison de périodes incomplètes : 28 j dont 13 absents vs 28 j complets → non comparable', () => {
    const current = computeDayCoverage({
      from: '2026-08-10',
      to: '2026-09-06',
      // 15 jours présents sur 28 (relevé 2026-09-09).
      presentDates: enumerateDatesIso('2026-08-10', '2026-09-06').filter(
        (d) => !(d >= '2026-08-14' && d <= '2026-08-25') && d !== '2026-09-02',
      ),
    });
    const previous = computeDayCoverage({
      from: '2026-07-13',
      to: '2026-08-09',
      presentDates: enumerateDatesIso('2026-07-13', '2026-08-09'),
    });
    expect(current.daysPresent).toBe(15);
    expect(current.missingDates).toHaveLength(13);
    expect(assessPeriodComparability(current, previous)).toEqual({
      comparable: false,
      reason: 'current_incomplete',
    });
    expect(assessPeriodComparability(previous, current)).toEqual({
      comparable: false,
      reason: 'previous_incomplete',
    });
    expect(assessPeriodComparability(previous, previous)).toEqual({
      comparable: true,
    });
  });

  it('comparaison refusée si les longueurs diffèrent', () => {
    const a = computeDayCoverage({
      from: '2026-09-01',
      to: '2026-09-07',
      presentDates: enumerateDatesIso('2026-09-01', '2026-09-07'),
    });
    const b = computeDayCoverage({
      from: '2026-08-01',
      to: '2026-08-28',
      presentDates: enumerateDatesIso('2026-08-01', '2026-08-28'),
    });
    expect(assessPeriodComparability(a, b)).toEqual({
      comparable: false,
      reason: 'length_mismatch',
    });
  });
});

describe('planIngestionDates', () => {
  it('trou historique : seuls les jours non commités hors refresh sont rattrapés, du plus ancien au plus récent', () => {
    const window = enumerateDatesIso('2026-08-10', '2026-09-04');
    const committed = new Set(
      window.filter(
        (d) =>
          !['2026-08-14', '2026-08-15', '2026-08-25', '2026-09-02'].includes(d),
      ),
    );
    const plan = planIngestionDates({ ...base, committedDates: committed });
    expect(plan.refresh).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ]);
    expect(plan.backfill).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-25',
      '2026-09-02',
    ]);
    expect(plan.deferred).toEqual([]);
    expect(plan.window).toEqual({ from: '2026-08-10', to: '2026-09-08' });
  });

  it('plafond par run : un arrêt de 18 jours est résorbé en 3 runs (7 + 7 + 4)', () => {
    const missing = enumerateDatesIso('2026-08-14', '2026-08-31');
    const all = enumerateDatesIso('2026-08-10', '2026-09-04');
    let committed = new Set(all.filter((d) => !missing.includes(d)));
    const runs: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const plan = planIngestionDates({ ...base, committedDates: committed });
      runs.push(plan.backfill);
      committed = new Set([...committed, ...plan.backfill]);
    }
    expect(runs.map((r) => r.length)).toEqual([7, 7, 4]);
    expect(runs[0][0]).toBe('2026-08-14');
    expect(
      planIngestionDates({ ...base, committedDates: committed }).backfill,
    ).toEqual([]);
  });

  it('refresh et backfill disjoints ; le refresh reste re-traité même commité', () => {
    const committed = new Set(enumerateDatesIso('2026-08-10', '2026-09-08'));
    const plan = planIngestionDates({ ...base, committedDates: committed });
    expect(plan.refresh).toHaveLength(4);
    expect(plan.backfill).toEqual([]);
    const overlap = plan.refresh.filter((d) => plan.backfill.includes(d));
    expect(overlap).toEqual([]);
  });

  it('plancher : rien sous le plancher, ancre sous le plancher → plan vide', () => {
    const plan = planIngestionDates({
      ...base,
      floorDate: '2026-09-03',
      committedDates: new Set(),
    });
    expect(plan.window).toEqual({ from: '2026-09-03', to: '2026-09-08' });
    expect(plan.backfill).toEqual(['2026-09-03', '2026-09-04']);
    expect(
      planIngestionDates({
        ...base,
        floorDate: '2026-09-09',
        committedDates: new Set(),
      }),
    ).toEqual({ refresh: [], backfill: [], deferred: [], window: null });
  });

  it('mode CLI (rolling 0) : toute la fenêtre est candidate, aucun refresh forcé', () => {
    const plan = planIngestionDates({
      anchorDate: '2026-06-30',
      rollingDays: 0,
      lookbackDays: 30,
      maxBackfillPerRun: 30,
      floorDate: '2026-06-01',
      committedDates: new Set(['2026-06-15']),
    });
    expect(plan.refresh).toEqual([]);
    expect(plan.backfill).toHaveLength(29);
    expect(plan.backfill).not.toContain('2026-06-15');
    expect(plan.backfill[29 - 1]).toBe('2026-06-30');
  });

  it("déterministe quel que soit l'ordre du Set, paramètres invalides refusés", () => {
    const a = planIngestionDates({
      ...base,
      committedDates: new Set(['2026-09-01', '2026-08-20']),
    });
    const b = planIngestionDates({
      ...base,
      committedDates: new Set(['2026-08-20', '2026-09-01']),
    });
    expect(a).toEqual(b);
    expect(() =>
      planIngestionDates({
        ...base,
        lookbackDays: 2,
        committedDates: new Set(),
      }),
    ).toThrow();
    expect(() =>
      planIngestionDates({
        ...base,
        anchorDate: '2026-13-01',
        committedDates: new Set(),
      }),
    ).toThrow();
    expect(ingestionWindow('2026-09-08', 1, '2026-06-01')).toEqual({
      from: '2026-09-08',
      to: '2026-09-08',
    });
  });
});

describe('resolveIngestionConfig', () => {
  it('défauts documentés sans variable', () => {
    expect(resolveIngestionConfig('gsc', () => undefined)).toEqual({
      config: {
        rollingDays: 4,
        lookbackDays: 120,
        maxBackfillPerRun: 7,
        floorDate: '2026-06-01',
      },
      invalidKeys: [],
    });
    expect(resolveIngestionConfig('ga4', () => undefined).config).toEqual({
      rollingDays: 1,
      lookbackDays: 120,
      maxBackfillPerRun: 7,
      floorDate: '2026-04-01',
    });
  });

  it('valeurs valides appliquées, invalides signalées (pas de repli muet)', () => {
    const env: Record<string, string> = {
      SEO_GSC_ROLLING_DAYS: '5',
      SEO_GSC_BACKFILL_LOOKBACK_DAYS: '9999',
      SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN: '-1',
      SEO_GSC_BACKFILL_FLOOR_DATE: '2026-02-30',
    };
    const r = resolveIngestionConfig('gsc', (k) => env[k]);
    expect(r.config).toEqual({
      rollingDays: 5,
      lookbackDays: 120,
      maxBackfillPerRun: 7,
      floorDate: '2026-06-01',
    });
    expect(r.invalidKeys.sort()).toEqual(
      [
        'SEO_GSC_BACKFILL_FLOOR_DATE',
        'SEO_GSC_BACKFILL_LOOKBACK_DAYS',
        'SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN',
      ].sort(),
    );
  });
});
