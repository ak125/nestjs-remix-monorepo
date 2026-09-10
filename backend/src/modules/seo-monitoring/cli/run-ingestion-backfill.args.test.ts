/**
 * Garde-fous du rattrapage CLI — plan seul par défaut, refus explicites.
 */
import { parseBackfillArgs } from './run-ingestion-backfill.args';

const ctx = {
  todayUtc: '2026-09-11',
  env: { SEO_MONITORING_ENABLED: 'true' } as Record<string, string | undefined>,
  floors: { gsc: '2026-06-01', ga4: '2026-04-01' },
};
const argv = (s: string) => s.split(' ').filter(Boolean);

describe('parseBackfillArgs', () => {
  it('plan seul par défaut (sans --apply)', () => {
    const r = parseBackfillArgs(
      argv('--source gsc --from 2026-08-14 --to 2026-08-25'),
      ctx,
    );
    expect(r).toEqual({
      ok: true,
      args: {
        source: 'gsc',
        from: '2026-08-14',
        to: '2026-08-25',
        apply: false,
        rangeDays: 12,
      },
    });
  });

  it('--apply explicite accepté hors READ_ONLY', () => {
    const r = parseBackfillArgs(
      argv('--source ga4 --from 2026-08-01 --to 2026-08-31 --apply'),
      ctx,
    );
    expect('args' in r && r.args.apply).toBe(true);
  });

  it.each([
    ['source absente', '--from 2026-08-01 --to 2026-08-02', ctx, '--source'],
    [
      'source invalide',
      '--source crux --from 2026-08-01 --to 2026-08-02',
      ctx,
      '--source',
    ],
    [
      'date invalide',
      '--source gsc --from 2026-08-32 --to 2026-09-01',
      ctx,
      'YYYY-MM-DD',
    ],
    [
      'from > to',
      '--source gsc --from 2026-08-10 --to 2026-08-01',
      ctx,
      'postérieur',
    ],
    [
      'sous le plancher',
      '--source gsc --from 2026-05-31 --to 2026-06-10',
      ctx,
      'plancher',
    ],
    [
      'GSC trop récent',
      '--source gsc --from 2026-09-01 --to 2026-09-11',
      ctx,
      'trop récent',
    ],
    [
      'GA4 après J-3',
      '--source ga4 --from 2026-09-01 --to 2026-09-09',
      ctx,
      'trop récent',
    ],
    [
      'plage > 31 j',
      '--source gsc --from 2026-07-01 --to 2026-08-01',
      ctx,
      'découper',
    ],
    [
      'option inconnue',
      '--source gsc --from 2026-08-01 --to 2026-08-02 --force',
      ctx,
      'inconnue',
    ],
    [
      'READ_ONLY + --apply',
      '--source gsc --from 2026-08-01 --to 2026-08-02 --apply',
      { ...ctx, env: { SEO_MONITORING_ENABLED: 'true', READ_ONLY: 'true' } },
      'READ_ONLY',
    ],
    [
      'monitoring désactivé',
      '--source gsc --from 2026-08-01 --to 2026-08-02',
      { ...ctx, env: {} },
      'SEO_MONITORING_ENABLED',
    ],
    [
      'plafond env invalide',
      '--source gsc --from 2026-08-01 --to 2026-08-02',
      {
        ...ctx,
        env: {
          SEO_MONITORING_ENABLED: 'true',
          SEO_INGEST_BACKFILL_CLI_MAX_DAYS: '0',
        },
      },
      'invalide',
    ],
  ])('refus : %s', (_label, args, context, expected) => {
    const r = parseBackfillArgs(argv(args), context);
    expect(r.ok).toBe(false);
    expect('refusal' in r && r.refusal).toContain(expected);
  });

  it('READ_ONLY sans --apply reste autorisé (plan seul, aucune écriture)', () => {
    const r = parseBackfillArgs(
      argv('--source gsc --from 2026-08-01 --to 2026-08-02'),
      {
        ...ctx,
        env: { SEO_MONITORING_ENABLED: 'true', READ_ONLY: 'true' },
      },
    );
    expect(r.ok).toBe(true);
  });
});
