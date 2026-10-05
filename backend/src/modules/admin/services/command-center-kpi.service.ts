import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { OrderStatus } from '@repo/domain-commerce';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * Indicateurs MESURÉS en base pour le Command Center (`executive_kpis`, source `db`).
 *
 * Le snapshot committé ne porte que des indicateurs structurels (source `canon`) ;
 * CommandCenterReaderService ajoute ceux-ci à la requête, en mode `full` seulement
 * (même règle que CommandCenterActionsService : light/disabled n'exposent rien).
 *
 * Premier indicateur : `payments_kept`, KPI primaire du département Ventes
 * (.spec/00-canon/ai-registry/agent-operating-map.yaml, `sales.kpi_primary`).
 * Définition reprise de audit/sales-funnel-scorecard.md : commandes passées sur
 * 30 jours glissants, payées puis non annulées.
 *
 * Lecture seule de ___xtr_order, cinq colonnes d'état (ni montant, ni client).
 * Source indisponible → value null + status UNKNOWN + avertissement journalisé,
 * jamais un zéro fabriqué. En PREPROD le backend lit en anon (ADR-028) et
 * ___xtr_order n'a qu'une policy service_role : la lecture lève 42501 → UNKNOWN.
 */

/** Forme d'un indicateur exécutif — miroir de CcExecutiveKpiSchema (@repo/registry). */
export interface LiveExecutiveKpi {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  source: 'db';
  certified: boolean;
}

/**
 * Un indicateur mesuré + sa valeur sur la fenêtre précédente de même durée.
 * Alimente le rapport de département (Vue 5, champ « Évolution ») sans rien
 * persister : la fenêtre précédente est relue en base à chaque requête.
 * `previous_value` null = pas de comparaison possible (lecture en échec), jamais 0.
 */
export interface LiveKpiMeasure {
  kpi: LiveExecutiveKpi;
  window_days: number;
  previous_value: number | null;
  /** Sens d'amélioration : `higher` = une hausse de `value` est un progrès. */
  better: 'higher' | 'lower';
}

/** Les seules colonnes lues. */
export interface OrderPaymentRow {
  ord_ords_id: string | null;
  ord_is_pay: string | null;
  ord_date_pay: string | null;
  payment_confirmed: boolean | null;
  ord_cancel_date: string | null;
}

export type OrderPaymentOutcome = 'unpaid' | 'kept' | 'cancelled_after_payment';

export interface PaymentsKeptCounts {
  orders: number;
  paid: number;
  kept: number;
  cancelledAfterPayment: number;
}

/** Statuts que seul le paiement pose : '3' (mark_order_paid_atomic), '4' qui le suit, '5'. */
const PAID_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.AWAITING_SHIPPING_FEE,
  OrderStatus.SHIPPING_FEE_RECEIVED,
  OrderStatus.PAID,
]);

/**
 * '6' = annulation admin (order-actions.service.ts), hors canon @repo/domain-commerce
 * mais présent en base sur des commandes payées puis annulées (relevé du 2026-10-04).
 * L'ignorer les compterait comme gardées.
 */
const ADMIN_CANCELLED_STATUS = '6';

/**
 * « Payée » croise quatre signaux, aucun ne suffit seul (des commandes réellement
 * payées gardent ord_is_pay='0') : drapeau, date de paiement, payment_confirmed
 * (projection payment_truth de .spec/00-canon/commerce-runtime/authority-graph.yaml)
 * et statut posé par le paiement. « Annulée » : statut '2' ou '6', ou date d'annulation.
 */
export function classifyOrderPayment(
  row: OrderPaymentRow,
): OrderPaymentOutcome {
  const paid =
    row.ord_is_pay === '1' ||
    (row.ord_date_pay != null && row.ord_date_pay.trim() !== '') ||
    row.payment_confirmed === true ||
    (row.ord_ords_id != null && PAID_STATUSES.has(row.ord_ords_id));
  if (!paid) return 'unpaid';
  const cancelled =
    row.ord_ords_id === OrderStatus.CANCELLED ||
    row.ord_ords_id === ADMIN_CANCELLED_STATUS ||
    row.ord_cancel_date != null;
  return cancelled ? 'cancelled_after_payment' : 'kept';
}

export function countPaymentsKept(
  rows: readonly OrderPaymentRow[],
): PaymentsKeptCounts {
  const counts: PaymentsKeptCounts = {
    orders: rows.length,
    paid: 0,
    kept: 0,
    cancelledAfterPayment: 0,
  };
  for (const row of rows) {
    const outcome = classifyOrderPayment(row);
    if (outcome === 'unpaid') continue;
    counts.paid += 1;
    if (outcome === 'kept') counts.kept += 1;
    else counts.cancelledAfterPayment += 1;
  }
  return counts;
}

/**
 * Seuils repris du scorecard : aucune vente gardée = Critique ; une annulation
 * après paiement (argent encaissé puis rendu) = fuite → WARNING.
 */
export function toPaymentsKeptKpi(
  counts: PaymentsKeptCounts | null,
): LiveExecutiveKpi {
  const base = {
    id: 'payments_kept',
    label: `Ventes — paiements gardés / payés (${CommandCenterKpiService.WINDOW_DAYS} j)`,
    source: 'db' as const,
  };
  if (!counts) {
    return { ...base, value: null, status: 'UNKNOWN', certified: false };
  }
  const status =
    counts.kept === 0
      ? 'CRITICAL'
      : counts.cancelledAfterPayment > 0
        ? 'WARNING'
        : 'OK';
  return {
    ...base,
    value: counts.kept,
    unit: `/${counts.paid}`,
    status,
    certified: true,
  };
}

@Injectable()
export class CommandCenterKpiService extends SupabaseBaseService {
  protected readonly logger = new Logger(CommandCenterKpiService.name);

  static readonly WINDOW_DAYS = 30;
  /** Plafond PostgREST : au-delà, la lecture serait tronquée et la mesure fausse. */
  private static readonly MAX_ROWS = 1000;

  constructor(configService: ConfigService) {
    super(configService);
  }

  // `mode` typé string comme CommandCenterActionsService : importer
  // CommandCenterMode du reader créerait un cycle reader ↔ kpi.
  async computeLiveKpis(
    mode: string,
    now: Date = new Date(),
  ): Promise<LiveKpiMeasure[]> {
    if (mode !== 'full') return [];
    const windowMs = CommandCenterKpiService.WINDOW_DAYS * 86_400_000;
    const since = new Date(now.getTime() - windowMs).toISOString();
    const previousSince = new Date(now.getTime() - 2 * windowMs).toISOString();
    const [current, previous] = await Promise.all([
      this.readPaymentsKept(since),
      this.readPaymentsKept(previousSince, since),
    ]);
    const kpi = toPaymentsKeptKpi(current);
    return [
      {
        kpi,
        window_days: CommandCenterKpiService.WINDOW_DAYS,
        previous_value: kpi.value == null ? null : (previous?.kept ?? null),
        better: 'higher',
      },
    ];
  }

  /** Commandes passées dans [from, to) ; `to` absent = jusqu'à maintenant. */
  private async readPaymentsKept(
    from: string,
    to?: string,
  ): Promise<PaymentsKeptCounts | null> {
    // ord_date est un texte ISO-8601 UTC (100 % des lignes au 2026-10-04) : l'ordre
    // lexical est l'ordre chronologique.
    let query = this.supabase
      .from(TABLES.xtr_order)
      .select(
        'ord_ords_id, ord_is_pay, ord_date_pay, payment_confirmed, ord_cancel_date',
        { count: 'exact' },
      )
      .gte('ord_date', from);
    if (to) query = query.lt('ord_date', to);
    const { data, error, count } = await query.limit(
      CommandCenterKpiService.MAX_ROWS,
    );
    if (error) {
      this.logger.warn(
        `[command-center-kpi] payments_kept indisponible — lecture ___xtr_order en échec (${error.code ?? 'sans code'} : ${error.message})`,
      );
      return null;
    }
    const rows = (data ?? []) as OrderPaymentRow[];
    if (count !== rows.length) {
      this.logger.warn(
        `[command-center-kpi] payments_kept indisponible — lecture incomplète (${rows.length} lignes reçues sur ${count ?? 'un total inconnu'})`,
      );
      return null;
    }
    return countPaymentsKept(rows);
  }
}
