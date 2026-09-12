/**
 * Planificateur de dates d'ingestion GSC / GA4 — fonction PURE (no I/O).
 *
 * POURQUOI : le job quotidien ne re-traitait qu'une fenêtre fixe ancrée sur J-3
 * (GSC J-3..J-6, GA4 J-3 seul). Toute interruption plus longue que la fenêtre
 * laissait des jours absents À JAMAIS, alors que Google sert encore la donnée
 * (relevé 2026-09-11 : 19 dates absentes du 06-11 au 09-07, identiques sur les
 * 4 grains GSC ; 08-20 toujours servie live). Chaque run planifie désormais :
 *
 *   refresh  = fenêtre glissante [ancre-(rolling-1) .. ancre], toujours re-traitée
 *              (Google révise les jours récents) ;
 *   backfill = jours NON commités de [plancher|ancre-(lookback-1) .. refresh-1],
 *              les plus anciens d'abord (ce sont les prochains à sortir de la
 *              fenêtre de rattrapage), plafonnés par run ;
 *   deferred = le reste des jours manquants (repris aux runs suivants).
 *
 * Idempotent : un jour commité n'est jamais replanifié hors refresh.
 * Paramètres gouvernés (env + défauts documentés, cf. `backend/.env.example`) —
 * une valeur invalide est signalée (`invalidKeys`) puis remplacée par le défaut.
 */
import {
  addDaysIso,
  enumerateDatesIso,
  GSC_BACKFILL_FLOOR_DATE_DEFAULT,
  isIsoDate,
} from '@repo/seo-types';

/**
 * Plafond de lookback : la Search Console conserve 16 mois ; 480 j reste en deçà
 * et sous le plafond de 1000 lignes supabase-js de la lecture des jours commités.
 */
export const INGESTION_MAX_LOOKBACK_DAYS = 480;

export type IngestionSourceKey = 'gsc' | 'ga4';

export interface IngestionConfig {
  rollingDays: number;
  lookbackDays: number;
  maxBackfillPerRun: number;
  floorDate: string;
}

interface ConfigSpec {
  env: Record<keyof IngestionConfig, string>;
  defaults: IngestionConfig;
}

/**
 * Défauts documentés :
 *  - GSC rolling 4 = comportement antérieur (ancre J-3 + 3 jours révisables) ;
 *    GA4 rolling 1 = comportement antérieur (1 date/run).
 *  - lookback 120 = plus large fenêtre GSC consommée (Command Center, 120 j) :
 *    tout trou visible par un consommateur peut être rattrapé.
 *  - backfill 7/run : ~10 s/jour GSC (5 grains) → 4+7 jours ≈ 110 s, sous le
 *    timeout Bull de 300 s partagé avec GA4/liens/CrUX/indexation ; un arrêt de
 *    18 jours est résorbé en 3 runs. À ajuster sur `duration_seconds` du journal.
 *  - plancher GSC 2026-06-01 = premier mois partitionné des grains multi-niveaux
 *    (20260613) ; plancher GA4 2026-04-01 = première partition `__seo_ga4_daily`.
 */
const SPECS: Record<IngestionSourceKey, ConfigSpec> = {
  gsc: {
    env: {
      rollingDays: 'SEO_GSC_ROLLING_DAYS',
      lookbackDays: 'SEO_GSC_BACKFILL_LOOKBACK_DAYS',
      maxBackfillPerRun: 'SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN',
      floorDate: 'SEO_GSC_BACKFILL_FLOOR_DATE',
    },
    defaults: {
      rollingDays: 4,
      lookbackDays: 120,
      maxBackfillPerRun: 7,
      floorDate: GSC_BACKFILL_FLOOR_DATE_DEFAULT,
    },
  },
  ga4: {
    env: {
      rollingDays: 'SEO_GA4_ROLLING_DAYS',
      lookbackDays: 'SEO_GA4_BACKFILL_LOOKBACK_DAYS',
      maxBackfillPerRun: 'SEO_GA4_BACKFILL_MAX_DAYS_PER_RUN',
      floorDate: 'SEO_GA4_BACKFILL_FLOOR_DATE',
    },
    defaults: {
      rollingDays: 1,
      lookbackDays: 120,
      maxBackfillPerRun: 7,
      floorDate: '2026-04-01',
    },
  },
};

function parseIntInRange(
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw == null || raw.trim() === '') return null;
  if (!/^\d+$/.test(raw.trim())) return Number.NaN;
  const n = Number(raw.trim());
  return n >= min && n <= max ? n : Number.NaN;
}

/**
 * Résout la config gouvernée d'une source. `invalidKeys` liste les variables
 * présentes mais invalides (l'appelant les journalise — pas de repli muet).
 */
export function resolveIngestionConfig(
  source: IngestionSourceKey,
  get: (key: string) => string | undefined,
): { config: IngestionConfig; invalidKeys: string[] } {
  const { env, defaults } = SPECS[source];
  const invalidKeys: string[] = [];
  const pickInt = (
    field: 'rollingDays' | 'lookbackDays' | 'maxBackfillPerRun',
    min: number,
    max: number,
  ): number => {
    const v = parseIntInRange(get(env[field]), min, max);
    if (v === null) return defaults[field];
    if (Number.isNaN(v)) {
      invalidKeys.push(env[field]);
      return defaults[field];
    }
    return v;
  };

  const rollingDays = pickInt('rollingDays', 1, INGESTION_MAX_LOOKBACK_DAYS);
  let lookbackDays = pickInt('lookbackDays', 1, INGESTION_MAX_LOOKBACK_DAYS);
  if (lookbackDays < rollingDays) {
    invalidKeys.push(env.lookbackDays);
    lookbackDays = Math.max(defaults.lookbackDays, rollingDays);
  }
  const maxBackfillPerRun = pickInt(
    'maxBackfillPerRun',
    0,
    INGESTION_MAX_LOOKBACK_DAYS,
  );

  const rawFloor = get(env.floorDate);
  let floorDate = defaults.floorDate;
  if (rawFloor != null && rawFloor.trim() !== '') {
    if (isIsoDate(rawFloor.trim())) floorDate = rawFloor.trim();
    else invalidKeys.push(env.floorDate);
  }

  return {
    config: { rollingDays, lookbackDays, maxBackfillPerRun, floorDate },
    invalidKeys,
  };
}

export interface IngestionPlanInput extends IngestionConfig {
  /** Dernier jour éligible (processor : J-3 ; CLI : --to). */
  anchorDate: string;
  /** Jours déjà commités dans la fenêtre (ordre indifférent). */
  committedDates: ReadonlySet<string>;
}

export interface IngestionPlan {
  refresh: string[];
  backfill: string[];
  deferred: string[];
  /** Fenêtre de rattrapage effective ; null si l'ancre est sous le plancher. */
  window: { from: string; to: string } | null;
}

/** Fenêtre de rattrapage [max(ancre-(lookback-1), plancher) .. ancre]. */
export function ingestionWindow(
  anchorDate: string,
  lookbackDays: number,
  floorDate: string,
): { from: string; to: string } | null {
  if (!isIsoDate(anchorDate) || !isIsoDate(floorDate)) {
    throw new Error(
      `ingestionWindow: dates ISO invalides (anchor=${anchorDate}, floor=${floorDate})`,
    );
  }
  if (anchorDate < floorDate) return null;
  const from = addDaysIso(anchorDate, -(lookbackDays - 1));
  return { from: from < floorDate ? floorDate : from, to: anchorDate };
}

export function planIngestionDates(input: IngestionPlanInput): IngestionPlan {
  const { anchorDate, rollingDays, lookbackDays, maxBackfillPerRun } = input;
  if (
    !Number.isInteger(rollingDays) ||
    rollingDays < 0 ||
    !Number.isInteger(lookbackDays) ||
    lookbackDays < Math.max(1, rollingDays) ||
    lookbackDays > INGESTION_MAX_LOOKBACK_DAYS ||
    !Number.isInteger(maxBackfillPerRun) ||
    maxBackfillPerRun < 0
  ) {
    throw new Error(
      `planIngestionDates: paramètres invalides (rolling=${rollingDays}, lookback=${lookbackDays}, maxBackfill=${maxBackfillPerRun})`,
    );
  }
  const window = ingestionWindow(anchorDate, lookbackDays, input.floorDate);
  if (!window) return { refresh: [], backfill: [], deferred: [], window: null };

  // rolling 0 (mode CLI) : refreshFrom = ancre+1 → aucun refresh forcé, toute
  // la fenêtre est candidate au rattrapage (seuls les jours non commités).
  const refreshFrom = addDaysIso(anchorDate, -(rollingDays - 1));
  const effectiveRefreshFrom =
    refreshFrom < window.from ? window.from : refreshFrom;
  const refresh = enumerateDatesIso(effectiveRefreshFrom, anchorDate);
  const missing = enumerateDatesIso(
    window.from,
    addDaysIso(effectiveRefreshFrom, -1),
  ).filter((d) => !input.committedDates.has(d));

  return {
    refresh,
    backfill: missing.slice(0, maxBackfillPerRun),
    deferred: missing.slice(maxBackfillPerRun),
    window,
  };
}
