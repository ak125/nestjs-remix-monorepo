/**
 * Arguments + garde-fous du rattrapage GSC / GA4 — module PUR (testable sans DI).
 *
 * Par défaut : PLAN SEUL (0 écriture, journal compris). `--apply` = écriture
 * réelle sur la base partagée → décision owner (GO explicite), refusée si
 * READ_ONLY=true ou si le monitoring est désactivé.
 *
 *   --source gsc|ga4  --from YYYY-MM-DD  --to YYYY-MM-DD  [--apply]
 */
import { addDaysIso, enumerateDatesIso, isIsoDate } from '@repo/seo-types';

/** Nb max de jours par exécution (1 mois = 1 partition à vérifier). */
export const BACKFILL_CLI_MAX_DAYS_ENV = 'SEO_INGEST_BACKFILL_CLI_MAX_DAYS';
export const BACKFILL_CLI_MAX_DAYS_DEFAULT = 31;

export interface BackfillArgs {
  source: 'gsc' | 'ga4';
  from: string;
  to: string;
  apply: boolean;
  rangeDays: number;
}

export interface BackfillGuardContext {
  /** Aujourd'hui UTC, YYYY-MM-DD. */
  todayUtc: string;
  env: Record<string, string | undefined>;
  /** Planchers gouvernés résolus (SEO_GSC/GA4_BACKFILL_FLOOR_DATE). */
  floors: { gsc: string; ga4: string };
}

export type BackfillParseResult =
  | { ok: true; args: BackfillArgs }
  | { ok: false; refusal: string };

function readFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function parseBackfillArgs(
  argv: string[],
  ctx: BackfillGuardContext,
): BackfillParseResult {
  const refuse = (refusal: string): BackfillParseResult => ({
    ok: false,
    refusal,
  });
  const known = new Set(['--source', '--from', '--to', '--apply']);
  const unknown = argv.filter((a) => a.startsWith('--') && !known.has(a));
  if (unknown.length > 0)
    return refuse(`option(s) inconnue(s) : ${unknown.join(', ')}`);

  const source = readFlag(argv, '--source');
  if (source !== 'gsc' && source !== 'ga4') {
    return refuse('--source gsc|ga4 obligatoire');
  }
  const from = readFlag(argv, '--from');
  const to = readFlag(argv, '--to');
  if (!from || !to || !isIsoDate(from) || !isIsoDate(to)) {
    return refuse('--from et --to obligatoires au format YYYY-MM-DD');
  }
  if (from > to) return refuse(`--from ${from} postérieur à --to ${to}`);

  const floor = ctx.floors[source];
  if (from < floor) {
    return refuse(
      `--from ${from} antérieur au plancher gouverné ${source} ${floor}`,
    );
  }
  // GSC : la finalité est prouvée par sonde, la veille UTC est la borne haute.
  // GA4 : pas de preuve de finalité → même ancre que le job quotidien (J-3).
  const maxTo = addDaysIso(ctx.todayUtc, source === 'gsc' ? -1 : -3);
  if (to > maxTo) {
    return refuse(`--to ${to} trop récent pour ${source} (max ${maxTo})`);
  }

  const rawMax = ctx.env[BACKFILL_CLI_MAX_DAYS_ENV];
  let maxDays = BACKFILL_CLI_MAX_DAYS_DEFAULT;
  if (rawMax != null && rawMax.trim() !== '') {
    if (!/^\d+$/.test(rawMax.trim()) || Number(rawMax) < 1) {
      return refuse(
        `${BACKFILL_CLI_MAX_DAYS_ENV}=${rawMax} invalide (entier ≥ 1)`,
      );
    }
    maxDays = Number(rawMax);
  }
  const rangeDays = enumerateDatesIso(from, to).length;
  if (rangeDays > maxDays) {
    return refuse(
      `plage de ${rangeDays} jours > ${maxDays} (${BACKFILL_CLI_MAX_DAYS_ENV}) — découper par mois`,
    );
  }

  const apply = argv.includes('--apply');
  if (ctx.env.SEO_MONITORING_ENABLED !== 'true') {
    return refuse(
      'SEO_MONITORING_ENABLED != true — aucun appel Google possible',
    );
  }
  if (apply && ctx.env.READ_ONLY === 'true') {
    return refuse('--apply refusé : READ_ONLY=true');
  }

  return { ok: true, args: { source, from, to, apply, rangeDays } };
}
