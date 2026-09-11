/**
 * Couverture JOURNALIÈRE des séries `__seo_*_daily` — fonctions PURES (no I/O).
 *
 * POURQUOI : une fenêtre (7 / 28 / 120 j) dont des jours manquent n'est ni un
 * total exhaustif ni comparable à une fenêtre complète. Constaté le 2026-09-10 :
 * 13 jours absents sur 28 dans `__seo_gsc_daily_*` (ingestion arrêtée, trous
 * jamais rattrapés) alors que les consommateurs sommaient et comparaient les
 * fenêtres comme si elles étaient complètes. Un jour absent n'est PAS un zéro.
 *
 * Consommateurs : planificateur d'ingestion GSC/GA4 (seo-monitoring),
 * timeseries GSC (seo-monitoring), snapshot seo-control (admin).
 *
 * Présent ≠ confirmé (2026-09-11) : une ligne du jour peut exister sans que le
 * jour soit certifié (ligne écrite par l'ancien ingesteur, qui posait le total
 * propriété EN PREMIER et à zéro quand GSC ne renvoyait rien ; ou réécriture
 * interrompue dont le marqueur de commit a été retiré). Les consommateurs qui
 * passent `confirmedDates` n'obtiennent `complete` que si chaque jour attendu
 * est présent ET confirmé.
 *
 * Dates = chaînes ISO `YYYY-MM-DD` (jour de reporting), arithmétique en UTC
 * pour ne jamais dépendre du fuseau du process.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** `true` si `value` est une date calendaire ISO valide (rejette 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

function assertIsoDate(value: string, label: string): void {
  if (!isIsoDate(value)) {
    throw new Error(`${label}: date ISO YYYY-MM-DD invalide (${value})`);
  }
}

/** `date` + `days` jours (négatif autorisé), en UTC. */
export function addDaysIso(date: string, days: number): string {
  assertIsoDate(date, "addDaysIso");
  if (!Number.isInteger(days)) {
    throw new Error(`addDaysIso: nombre de jours entier attendu (${days})`);
  }
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Jours de `from` à `to` INCLUS, ordre croissant ; `[]` si `from > to`. */
export function enumerateDatesIso(from: string, to: string): string[] {
  assertIsoDate(from, "enumerateDatesIso(from)");
  assertIsoDate(to, "enumerateDatesIso(to)");
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) out.push(d);
  return out;
}

export interface DayCoverage {
  from: string;
  to: string;
  daysExpected: number;
  /** Jours attendus ayant une ligne (confirmée ou non). */
  daysPresent: number;
  /** Jours attendus ayant une ligne confirmée (= `daysPresent` sans `confirmedDates`). */
  daysConfirmed: number;
  /** Jours attendus sans aucune ligne, ordre croissant. */
  missingDates: string[];
  /** Jours attendus présents mais non confirmés, ordre croissant. */
  unconfirmedDates: string[];
  /** Au moins un jour attendu, aucun manquant ET aucun non confirmé. */
  complete: boolean;
}

/**
 * Couverture d'une fenêtre `[from, to]` inclusive à partir des dates présentes.
 * Les dates hors fenêtre sont ignorées. Sans `confirmedDates`, tout jour présent
 * est tenu pour confirmé (comportement historique). Une date confirmée sans
 * ligne présente est une entrée incohérente → exception (jamais comptée).
 */
export function computeDayCoverage(input: {
  from: string;
  to: string;
  presentDates: Iterable<string>;
  confirmedDates?: Iterable<string>;
}): DayCoverage {
  const expected = enumerateDatesIso(input.from, input.to);
  const present = new Set(input.presentDates);
  const confirmed = input.confirmedDates
    ? new Set(input.confirmedDates)
    : present;
  const orphan = [...confirmed].filter((d) => !present.has(d));
  if (orphan.length > 0) {
    throw new Error(
      `computeDayCoverage: date(s) confirmée(s) sans ligne présente (${orphan.join(", ")})`,
    );
  }
  const missingDates = expected.filter((d) => !present.has(d));
  const unconfirmedDates = expected.filter(
    (d) => present.has(d) && !confirmed.has(d),
  );
  const daysPresent = expected.length - missingDates.length;
  return {
    from: input.from,
    to: input.to,
    daysExpected: expected.length,
    daysPresent,
    daysConfirmed: daysPresent - unconfirmedDates.length,
    missingDates,
    unconfirmedDates,
    complete:
      expected.length > 0 &&
      missingDates.length === 0 &&
      unconfirmedDates.length === 0,
  };
}

export type PeriodComparability =
  | { comparable: true }
  | {
      comparable: false;
      reason: "current_incomplete" | "previous_incomplete" | "length_mismatch";
    };

/**
 * Deux fenêtres ne se comparent (delta %, hausse/baisse, perdants) que si elles
 * ont la même longueur ET sont toutes deux complètes. Sinon la variation
 * mesure le trou d'ingestion, pas le trafic.
 */
export function assessPeriodComparability(
  current: DayCoverage,
  previous: DayCoverage,
): PeriodComparability {
  if (current.daysExpected !== previous.daysExpected) {
    return { comparable: false, reason: "length_mismatch" };
  }
  if (!current.complete) {
    return { comparable: false, reason: "current_incomplete" };
  }
  if (!previous.complete) {
    return { comparable: false, reason: "previous_incomplete" };
  }
  return { comparable: true };
}
