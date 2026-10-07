import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { OrderStatus } from '@repo/domain-commerce';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  TrackingIntegrityService,
  TrackingIntegrityVerdictV1Schema,
  type TrackingIntegrityVerdictV1,
} from '../../analytics';
import {
  countDiagnosticToProduct,
  countPagesGeneratingAtc,
  firstVisitBySession,
  toDiagnosticToProductKpi,
  toMetricReliabilityKpi,
  toPagesGeneratingAtcKpi,
  type DiagnosticToProductCounts,
  type SessionEventRow,
} from './command-center-action-rules/department-kpi.rules';
import type {
  LiveExecutiveKpi,
  LiveKpiMeasure,
} from './command-center-action-rules/live-kpi';

/**
 * Indicateurs MESURÉS en base pour le Command Center (`executive_kpis`, source `db`).
 *
 * Le snapshot committé ne porte que des indicateurs structurels (source `canon`) ;
 * CommandCenterReaderService ajoute ceux-ci à la requête, en mode `full` seulement
 * (même règle que CommandCenterActionsService : light/disabled n'exposent rien).
 *
 * KPI primaires de département (.spec/00-canon/ai-registry/agent-operating-map.yaml,
 * `kpi_primary`), chacun sur 30 jours glissants + la fenêtre précédente :
 *   - `payments_kept` (Ventes) : définition reprise de audit/sales-funnel-scorecard.md,
 *     commandes passées, payées puis non annulées. Lecture seule de ___xtr_order,
 *     cinq colonnes d'état (ni montant, ni client) ;
 *   - `metric_reliability` (Data), `pages_generating_atc` (Pages & SEO),
 *     `diagnostic_to_product` (Diagnostic) : règles et définitions dans
 *     command-center-action-rules/department-kpi.rules.ts. Lecture seule du verdict
 *     TrackingIntegrityService et de __seo_event_log (session, date, page source).
 *
 * Source indisponible → value null + status UNKNOWN + avertissement journalisé,
 * jamais un zéro fabriqué. En PREPROD le backend lit en anon (ADR-028) et
 * ___xtr_order n'a qu'une policy service_role : la lecture lève 42501 → UNKNOWN.
 */

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

/** Réponse PostgREST réduite à ce que readAll contrôle. */
interface ReadResponse {
  data: unknown;
  error: { code?: string; message: string } | null;
  count: number | null;
}

function measure(
  kpi: LiveExecutiveKpi,
  previous: number | null,
  windowDays: number,
): LiveKpiMeasure {
  return {
    kpi,
    window_days: windowDays,
    previous_value: kpi.value == null ? null : previous,
    better: 'higher',
  };
}

@Injectable()
export class CommandCenterKpiService extends SupabaseBaseService {
  protected readonly logger = new Logger(CommandCenterKpiService.name);

  static readonly WINDOW_DAYS = 30;
  /** Plafond PostgREST : au-delà, la lecture serait tronquée et la mesure fausse. */
  private static readonly MAX_ROWS = 1000;
  /** Lots `in(session_id, …)` : un UUID ≈ 37 caractères, l'URL PostgREST est bornée. */
  private static readonly SESSION_CHUNK = 100;
  private static readonly SESSION_COLUMNS =
    'session_id:payload->>session_id, created_at';

  constructor(
    configService: ConfigService,
    private readonly trackingIntegrity: TrackingIntegrityService,
  ) {
    super(configService);
  }

  // `mode` typé string comme CommandCenterActionsService : importer
  // CommandCenterMode du reader créerait un cycle reader ↔ kpi.
  async computeLiveKpis(
    mode: string,
    now: Date = new Date(),
  ): Promise<LiveKpiMeasure[]> {
    if (mode !== 'full') return [];
    const days = CommandCenterKpiService.WINDOW_DAYS;
    const windowMs = days * 86_400_000;
    const sinceDate = new Date(now.getTime() - windowMs);
    const since = sinceDate.toISOString();
    const previousSince = new Date(now.getTime() - 2 * windowMs).toISOString();
    const [
      payments,
      paymentsBefore,
      verdict,
      verdictBefore,
      pages,
      pagesBefore,
      diagnostic,
      diagnosticBefore,
    ] = await Promise.all([
      this.readPaymentsKept(since),
      this.readPaymentsKept(previousSince, since),
      this.readTrackingVerdict(now),
      this.readTrackingVerdict(sinceDate),
      this.readPagesGeneratingAtc(since),
      this.readPagesGeneratingAtc(previousSince, since),
      this.readDiagnosticToProduct(since),
      this.readDiagnosticToProduct(previousSince, since),
    ]);

    // Le verdict porte sa propre fenêtre : la comparaison n'a de sens que si la
    // précédente s'arrête exactement où commence la courante.
    const verdictDays = verdict?.window.days ?? days;
    const verdictsContiguous =
      verdict != null && verdictBefore?.window.to === verdict.window.from;

    return [
      measure(toPaymentsKeptKpi(payments), paymentsBefore?.kept ?? null, days),
      measure(
        toMetricReliabilityKpi(verdict, verdictDays),
        verdictsContiguous
          ? toMetricReliabilityKpi(verdictBefore, verdictDays).value
          : null,
        verdictDays,
      ),
      measure(toPagesGeneratingAtcKpi(pages, days), pagesBefore, days),
      measure(
        toDiagnosticToProductKpi(diagnostic, days),
        diagnosticBefore?.reachedProduct ?? null,
        days,
      ),
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
    const rows = await this.readAll<OrderPaymentRow>(
      'payments_kept',
      TABLES.xtr_order,
      query.limit(CommandCenterKpiService.MAX_ROWS),
    );
    return rows && countPaymentsKept(rows);
  }

  /** Verdict Data → Ventes à la date `at` ; hors contrat ou en échec → null. */
  private async readTrackingVerdict(
    at: Date,
  ): Promise<TrackingIntegrityVerdictV1 | null> {
    try {
      const parsed = TrackingIntegrityVerdictV1Schema.safeParse(
        await this.trackingIntegrity.evaluate(at),
      );
      if (parsed.success) return parsed.data;
      this.logger.warn(
        `[command-center-kpi] metric_reliability indisponible — verdict hors contrat (${parsed.error.issues.map((i) => i.message).join(' ; ')})`,
      );
    } catch (e) {
      this.logger.warn(
        `[command-center-kpi] metric_reliability indisponible — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return null;
  }

  private async readPagesGeneratingAtc(
    from: string,
    to?: string,
  ): Promise<number | null> {
    const rows = await this.readEvents<{ source_url: string | null }>(
      'pages_generating_atc',
      'r2_add_to_cart',
      'source_url:payload->>source_url',
      from,
      to,
    );
    return rows && countPagesGeneratingAtc(rows);
  }

  private async readDiagnosticToProduct(
    from: string,
    to?: string,
  ): Promise<DiagnosticToProductCounts | null> {
    const visits = await this.readEvents<SessionEventRow>(
      'diagnostic_to_product',
      'diag_hub_view',
      CommandCenterKpiService.SESSION_COLUMNS,
      from,
      to,
    );
    if (!visits) return null;
    const { firstVisit, malformedSessions } = firstVisitBySession(visits);
    if (malformedSessions > 0) {
      this.logger.warn(
        `[command-center-kpi] diagnostic_to_product — ${malformedSessions} session(s) écartée(s) : identifiant hors du format de l'émetteur`,
      );
    }
    const sessions = [...firstVisit.keys()];
    const views: SessionEventRow[] = [];
    const chunk = CommandCenterKpiService.SESSION_CHUNK;
    // Budget cumulé, pas par lot : chaque lecture n'a droit qu'aux lignes
    // restantes ; au-delà elle est incomplète, donc UNKNOWN (readAll). Les
    // sessions viennent d'une lecture bornée à MAX_ROWS : au plus
    // MAX_ROWS / SESSION_CHUNK lectures.
    for (let i = 0; i < sessions.length; i += chunk) {
      const rows = await this.readEvents<SessionEventRow>(
        'diagnostic_to_product',
        'r2_view',
        CommandCenterKpiService.SESSION_COLUMNS,
        from,
        to,
        {
          sessions: sessions.slice(i, i + chunk),
          budget: CommandCenterKpiService.MAX_ROWS - views.length,
        },
      );
      if (!rows) return null;
      views.push(...rows);
    }
    return countDiagnosticToProduct(firstVisit, views);
  }

  /**
   * Événements `eventType` créés dans [from, to). `bySession` restreint aux
   * sessions données, dans la limite du budget de lignes restant.
   */
  private readEvents<T>(
    kpi: string,
    eventType: string,
    columns: string,
    from: string,
    to?: string,
    bySession?: { sessions: string[]; budget: number },
  ): Promise<T[] | null> {
    let query = this.supabase
      // Nom littéral : l'inventaire db-usage (build-db-usage-map.js) le rattache à ce service.
      .from('__seo_event_log')
      .select(columns, { count: 'exact' })
      .eq('event_type', eventType)
      .gte('created_at', from);
    if (to) query = query.lt('created_at', to);
    if (bySession) query = query.in('payload->>session_id', bySession.sessions);
    return this.readAll<T>(
      kpi,
      `__seo_event_log (${eventType})`,
      query.limit(bySession?.budget ?? CommandCenterKpiService.MAX_ROWS),
    );
  }

  /**
   * Lecture complète ou rien : erreur, ou `count` exact ≠ lignes reçues (plafond
   * PostgREST) → null et avertissement. Jamais de mesure sur une lecture partielle.
   */
  private async readAll<T>(
    kpi: string,
    source: string,
    query: PromiseLike<ReadResponse>,
  ): Promise<T[] | null> {
    const { data, error, count } = await query;
    if (error) {
      this.logger.warn(
        `[command-center-kpi] ${kpi} indisponible — lecture ${source} en échec (${error.code ?? 'sans code'} : ${error.message})`,
      );
      return null;
    }
    const rows = (data ?? []) as T[];
    if (count !== rows.length) {
      this.logger.warn(
        `[command-center-kpi] ${kpi} indisponible — lecture ${source} incomplète (${rows.length} lignes reçues sur ${count ?? 'un total inconnu'})`,
      );
      return null;
    }
    return rows;
  }
}
