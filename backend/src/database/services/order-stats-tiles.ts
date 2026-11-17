/**
 * Tuiles de la page /commercial/orders — calcul sur TOUTE la base.
 *
 * Décisions de Marwane du 17/11/2026 (complément n° 1 au mandat BN) :
 * - les tuiles portent sur toute la base, pas sur la page affichée ;
 * - une commande non payée, non annulée, de plus de 30 jours n'est plus
 *   « impayée » mais « abandonnée » ;
 * - un montant aberrant (au-delà du seuil de configuration) est exclu de
 *   toutes les sommes et relevé, sans correction en base ;
 * - une commande annulée n'est pas une vente (décision du 17/11 21:45) :
 *   une commande payée puis annulée sort du chiffre d'affaires et apparaît
 *   dans la tuile « Annulées » avec son montant ;
 * - le département 13 ne s'appuie que sur ce que le site enregistre de
 *   lui-même : la commande (`ord_date`, `ord_total_ttc`), le paiement
 *   (`ord_is_pay`) et l'annulation. L'annulation se lit dans
 *   `ord_cancel_date` ou, pour l'historique, dans le statut 2 : réponse de
 *   Marwane du 18/11/2026 à 00:27 (« Oui, 2 = annulée »), l'ancien site ne
 *   gardait d'une annulation que ce statut. Aucun autre statut n'est lu.
 *
 * Module pur : aucune lecture réseau ici, la lecture paginée vit dans
 * `fetchAllOrderStatsRows` et le service.
 */

/** Ligne lue pour les tuiles : aucune donnée client. */
export interface OrderStatsRow {
  ord_id: string;
  ord_date: string | null;
  ord_is_pay: string | null;
  ord_total_ttc: string | null;
  ord_cancel_date: string | null;
  /** Lu pour le seul statut 2 (« Commande annulée »), trace historique. */
  ord_ords_id: string | null;
}

/** Colonnes lues, dans l'ordre de `OrderStatsRow`. */
export const ORDER_STATS_COLUMNS =
  'ord_id, ord_date, ord_is_pay, ord_total_ttc, ord_cancel_date, ord_ords_id';

/** Statut 2 « Commande annulée » : seule trace d'annulation de l'ancien site. */
const LEGACY_CANCELLED_STATUS = '2';

export const ORDER_STATS_PERIODS = ['all', 'year', 'month'] as const;
export type OrderStatsPeriod = (typeof ORDER_STATS_PERIODS)[number];

export function isOrderStatsPeriod(value: unknown): value is OrderStatsPeriod {
  return (
    typeof value === 'string' &&
    (ORDER_STATS_PERIODS as readonly string[]).includes(value)
  );
}

/** Décision de Marwane du 17/11/2026 : au-delà, « abandonnée ». */
export const ABANDONED_AFTER_DAYS = 30;

/** Variable de configuration du seuil d'aberration (euros TTC). */
export const IMPLAUSIBLE_TTC_ENV = 'ORDERS_STATS_IMPLAUSIBLE_TTC_EUR';
/**
 * Valeur par défaut du seuil : 1 500 € TTC, décision de Marwane du
 * 17/11/2026 21:44 (remplace 1 000 € donné à 21:41 ; 10 000 et 2 000
 * refusés). Relevé du même jour : 99 % des commandes payées sont sous 655 € ;
 * la plus grosse payée (1 212,13 €) reste donc comptée. Au-delà du seuil, une
 * commande est exclue des sommes ET affichée dans la liste des exclusions,
 * comme 15114950 (99 999 999 999 999,99 €). Aucune commande n'est écartée
 * sans être signalée.
 */
export const DEFAULT_IMPLAUSIBLE_TTC_EUR = 1500;

/** Fuseau des périodes « ce mois » / « cette année ». */
const STATS_TIME_ZONE = 'Europe/Paris';

const DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT_RE = /^-?\d+(\.\d+)?$/;

/**
 * Lit le seuil depuis la configuration. Absent = défaut documenté ; présent
 * mais illisible ou ≤ 0 = erreur (pas de repli silencieux).
 */
export function resolveImplausibleThreshold(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_IMPLAUSIBLE_TTC_EUR;
  }
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${IMPLAUSIBLE_TTC_ENV} invalide : un nombre d'euros strictement positif est attendu`,
    );
  }
  return value;
}

type ExcludedReason =
  | 'amount_above_threshold'
  | 'amount_unreadable'
  | 'date_unreadable';

interface ExcludedOrder {
  ordId: string;
  ordDate: string | null;
  totalTtc: string | null;
  isPaid: boolean;
  reason: ExcludedReason;
}

export interface OrderTiles {
  period: OrderStatsPeriod;
  /** Début de période (ISO UTC), null pour « toute la base ». */
  periodStart: string | null;
  computedAt: string;
  /** Nombre de lignes lues en base (avant tout filtre). */
  rowsRead: number;
  paid: { orders: number; revenue: number; averageBasket: number };
  /** CA payé du mois civil en cours (Europe/Paris), quelle que soit la période. */
  monthRevenue: number;
  /** Non payées, non annulées, de moins de 30 jours. */
  unpaid: { orders: number; amount: number };
  /** Non payées, non annulées, de 30 jours ou plus. */
  abandoned: { orders: number; amount: number; afterDays: number };
  /**
   * Annulations enregistrées (`ord_cancel_date` ou statut 2). Aucune n'entre dans le CA,
   * le panier ni les impayées ; les payées puis annulées sont chiffrées.
   */
  cancelled: { orders: number; paidOrders: number; paidAmount: number };
  /** Lignes exclues de toutes les sommes, relevées sans correction. */
  excluded: { thresholdTtc: number; orders: ExcludedOrder[] };
}

/** Décalage (ms) du fuseau à l'instant donné : heure locale − UTC. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant UTC de minuit local (fuseau) au jour donné. */
function zonedMidnight(
  year: number,
  monthIndex: number,
  day: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, monthIndex, day);
  // Deux passes : l'offset au minuit local peut différer de celui de l'estimation.
  let instant = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  instant = guess - timeZoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** Année et mois (0-11) de l'instant dans le fuseau. */
function zonedYearMonth(
  instant: Date,
  timeZone: string,
): { year: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    monthIndex: Number(parts.find((p) => p.type === 'month')?.value) - 1,
  };
}

export function periodStart(
  period: OrderStatsPeriod,
  now: Date,
  timeZone: string = STATS_TIME_ZONE,
): Date | null {
  if (period === 'all') return null;
  const { year, monthIndex } = zonedYearMonth(now, timeZone);
  return period === 'year'
    ? zonedMidnight(year, 0, 1, timeZone)
    : zonedMidnight(year, monthIndex, 1, timeZone);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeOrderTiles(
  rows: readonly OrderStatsRow[],
  options: {
    now: Date;
    period: OrderStatsPeriod;
    implausibleThresholdTtc: number;
    timeZone?: string;
  },
): OrderTiles {
  const { now, period, implausibleThresholdTtc } = options;
  const timeZone = options.timeZone ?? STATS_TIME_ZONE;
  const start = periodStart(period, now, timeZone);
  const monthStart = periodStart('month', now, timeZone) as Date;
  const abandonBefore = now.getTime() - ABANDONED_AFTER_DAYS * DAY_MS;

  let paidOrders = 0;
  let revenue = 0;
  let monthRevenue = 0;
  let unpaidOrders = 0;
  let unpaidAmount = 0;
  let abandonedOrders = 0;
  let abandonedAmount = 0;
  let cancelledOrders = 0;
  let cancelledPaidOrders = 0;
  let cancelledPaidAmount = 0;
  const excluded: ExcludedOrder[] = [];

  for (const row of rows) {
    const isPaid = row.ord_is_pay === '1';
    const isCancelled =
      (row.ord_cancel_date !== null && row.ord_cancel_date !== '') ||
      (row.ord_ords_id ?? '').trim() === LEGACY_CANCELLED_STATUS;
    const dateMs = row.ord_date ? Date.parse(row.ord_date) : NaN;
    const rawAmount = (row.ord_total_ttc ?? '').trim();
    const amount = AMOUNT_RE.test(rawAmount) ? Number(rawAmount) : NaN;

    const exclude = (reason: ExcludedReason) =>
      excluded.push({
        ordId: row.ord_id,
        ordDate: row.ord_date,
        totalTtc: row.ord_total_ttc,
        isPaid,
        reason,
      });

    if (Number.isNaN(dateMs)) {
      exclude('date_unreadable');
      continue;
    }
    if (start && dateMs < start.getTime()) continue;
    if (!Number.isFinite(amount)) {
      exclude('amount_unreadable');
      continue;
    }
    if (amount > implausibleThresholdTtc) {
      exclude('amount_above_threshold');
      continue;
    }

    // Une commande annulée n'est pas une vente, même payée : hors CA.
    if (isCancelled) {
      cancelledOrders += 1;
      if (isPaid) {
        cancelledPaidOrders += 1;
        cancelledPaidAmount += amount;
      }
      continue;
    }

    if (isPaid) {
      paidOrders += 1;
      revenue += amount;
      if (dateMs >= monthStart.getTime()) monthRevenue += amount;
      continue;
    }

    if (dateMs >= abandonBefore) {
      unpaidOrders += 1;
      unpaidAmount += amount;
    } else {
      abandonedOrders += 1;
      abandonedAmount += amount;
    }
  }

  return {
    period,
    periodStart: start ? start.toISOString() : null,
    computedAt: now.toISOString(),
    rowsRead: rows.length,
    paid: {
      orders: paidOrders,
      revenue: round2(revenue),
      averageBasket: paidOrders > 0 ? round2(revenue / paidOrders) : 0,
    },
    monthRevenue: round2(monthRevenue),
    unpaid: { orders: unpaidOrders, amount: round2(unpaidAmount) },
    abandoned: {
      orders: abandonedOrders,
      amount: round2(abandonedAmount),
      afterDays: ABANDONED_AFTER_DAYS,
    },
    cancelled: {
      orders: cancelledOrders,
      paidOrders: cancelledPaidOrders,
      paidAmount: round2(cancelledPaidAmount),
    },
    excluded: { thresholdTtc: implausibleThresholdTtc, orders: excluded },
  };
}

/** Taille de page : supabase-js plafonne une lecture à 1 000 lignes. */
const STATS_PAGE_SIZE = 1000;

/**
 * Lit toutes les lignes page par page (ordre stable fourni par l'appelant).
 * Une erreur sur une page fait échouer le tout : jamais de total partiel.
 */
export async function fetchAllOrderStatsRows(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: OrderStatsRow[] | null; error: unknown }>,
  pageSize: number = STATS_PAGE_SIZE,
): Promise<OrderStatsRow[]> {
  const rows: OrderStatsRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
