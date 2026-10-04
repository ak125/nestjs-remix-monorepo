/**
 * TrackingIntegrityService — producteur du verdict `tracking-integrity-verdict.v1`
 * (département Data → département Ventes).
 *
 * Question posée : la mesure « commande passée » (`r2_order_placed` dans
 * `__seo_event_log`) relie-t-elle réellement les commandes ? Deux contrôles sur
 * 30 jours glissants, en lecture seule :
 *
 *   - `order_event_key` : l'identifiant porté par chaque événement existe dans
 *     `___xtr_order.ord_id`. L'émetteur serveur (`OrderFunnelListener`) écrit
 *     `ord_id` ; un autre identifiant (n° de transaction bancaire…) ne se relie à
 *     aucune commande, et l'index unique partiel sur `payload->>'order_id'`
 *     écarterait alors comme « doublon » l'événement serveur d'une autre vente.
 *   - `order_event_coverage` : chaque commande au paiement confirmé
 *     (`payment_confirmed`, le déclencheur exact de `ORDER_EVENTS.PAID`) a son
 *     événement. L'événement suit le paiement (page de retour, émetteur
 *     asynchrone) : une commande payée depuis moins de `SETTLE_MINUTES` n'est pas
 *     encore jugée, sinon une simple course ferait échouer le contrôle.
 *
 * Pas de repli silencieux : erreur de lecture ou lecture tronquée (`count`
 * exact ≠ lignes reçues) → UNKNOWN avec la raison, et un avertissement journalisé.
 * Jamais un zéro, jamais une certification sur une absence de données.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  TRACKING_INTEGRITY_CONTRACT,
  type TrackingIntegrityCheck,
  type TrackingIntegrityVerdictV1,
} from './tracking-integrity-verdict.schema';

export const TRACKING_INTEGRITY_WINDOW_DAYS = 30;
/** Plafond PostgREST : au-delà, la lecture serait tronquée → UNKNOWN. */
const READ_LIMIT = 1000;
/** Taille des lots `in('ord_id', …)` (longueur d'URL PostgREST). */
const KEY_LOOKUP_CHUNK = 200;
const SAMPLE_SIZE = 5;
export const SETTLE_MINUTES = 60;
/** Format écrit par `Date#toISOString` — le seul dont l'ordre lexical est chronologique. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface OrderPlacedEventRow {
  id: string;
  order_id: string | null;
}

export interface ConfirmedOrderRow {
  ord_id: string;
}

interface ConfirmedOrderReadRow extends ConfirmedOrderRow {
  ord_date_pay: string | null;
}

const DAY_MS = 86_400_000;

type Window = TrackingIntegrityVerdictV1['window'];

export function trackingWindow(now: Date): Window {
  const from = new Date(
    now.getTime() - TRACKING_INTEGRITY_WINDOW_DAYS * DAY_MS,
  );
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    days: TRACKING_INTEGRITY_WINDOW_DAYS,
  };
}

function check(
  id: TrackingIntegrityCheck['id'],
  observed: number,
  expected: number,
  detail: string,
  samples: string[],
): TrackingIntegrityCheck {
  const status =
    expected === 0 ? 'NO_DATA' : observed === expected ? 'PASS' : 'FAIL';
  return {
    id,
    status,
    observed,
    expected,
    detail,
    samples: samples.slice(0, SAMPLE_SIZE),
  };
}

function verdict(
  window: Window,
  status: TrackingIntegrityVerdictV1['status'],
  checks: TrackingIntegrityCheck[],
  reason: string | null,
): TrackingIntegrityVerdictV1 {
  return {
    contract: TRACKING_INTEGRITY_CONTRACT,
    producer: 'data',
    consumer: 'sales',
    status,
    window,
    checks,
    reason,
  };
}

export function unknownVerdict(
  window: Window,
  reason: string,
): TrackingIntegrityVerdictV1 {
  return verdict(window, 'UNKNOWN', [], reason);
}

/**
 * Règle pure. `knownOrderIds` = identifiants d'événement trouvés dans
 * `___xtr_order.ord_id` (toute la table, pas seulement la fenêtre).
 */
export function evaluateTrackingIntegrity(input: {
  window: Window;
  events: OrderPlacedEventRow[];
  confirmedOrders: ConfirmedOrderRow[];
  knownOrderIds: ReadonlySet<string>;
}): TrackingIntegrityVerdictV1 {
  const { window, events, confirmedOrders, knownOrderIds } = input;

  const unkeyed = events.filter(
    (e) => !e.order_id || !knownOrderIds.has(e.order_id),
  );
  const keyCheck = check(
    'order_event_key',
    events.length - unkeyed.length,
    events.length,
    `${events.length - unkeyed.length}/${events.length} événement(s) « commande passée » désignent une commande existante (ord_id)`,
    unkeyed.map((e) => e.id),
  );

  const eventKeys = new Set(
    events.map((e) => e.order_id).filter((k): k is string => !!k),
  );
  const orderIds = [...new Set(confirmedOrders.map((o) => o.ord_id))];
  const uncovered = orderIds.filter((id) => !eventKeys.has(id));
  const coverageCheck = check(
    'order_event_coverage',
    orderIds.length - uncovered.length,
    orderIds.length,
    `${orderIds.length - uncovered.length}/${orderIds.length} commande(s) au paiement confirmé depuis plus de ${SETTLE_MINUTES} min ont leur événement « commande passée »`,
    uncovered,
  );

  const checks = [keyCheck, coverageCheck];
  if (checks.some((c) => c.status === 'FAIL')) {
    return verdict(window, 'NOT_CERTIFIED', checks, null);
  }
  if (checks.every((c) => c.status === 'PASS')) {
    return verdict(window, 'CERTIFIED', checks, null);
  }
  const empty = checks.filter((c) => c.status === 'NO_DATA').map((c) => c.id);
  return verdict(
    window,
    'UNKNOWN',
    checks,
    `Données insuffisantes sur ${window.days} j (${empty.join(', ')}) — aucune certification sans mesure`,
  );
}

@Injectable()
export class TrackingIntegrityService extends SupabaseBaseService {
  protected readonly logger = new Logger(TrackingIntegrityService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async evaluate(now: Date = new Date()): Promise<TrackingIntegrityVerdictV1> {
    const window = trackingWindow(now);
    try {
      const events = await this.readOrderPlacedEvents(window);
      const confirmedOrders = await this.readConfirmedOrders(window);
      const knownOrderIds = await this.lookupOrderIds(events);
      return evaluateTrackingIntegrity({
        window,
        events,
        confirmedOrders,
        knownOrderIds,
      });
    } catch (e) {
      const reason = `Lecture impossible : ${e instanceof Error ? e.message : String(e)}`;
      this.logger.warn(`[tracking-integrity] ${reason}`);
      return unknownVerdict(window, reason);
    }
  }

  private async readOrderPlacedEvents(
    window: Window,
  ): Promise<OrderPlacedEventRow[]> {
    const { data, count, error } = await this.supabase
      .from('__seo_event_log')
      .select('id, order_id:payload->>order_id', { count: 'exact' })
      .eq('event_type', 'r2_order_placed')
      .gte('created_at', window.from)
      .lte('created_at', window.to)
      .limit(READ_LIMIT);
    if (error) {
      throw new Error(
        `__seo_event_log (${error.code ?? 'sans code'}) ${error.message}`,
      );
    }
    const rows = (data ?? []) as OrderPlacedEventRow[];
    if (count !== rows.length) {
      throw new Error(
        `__seo_event_log tronquée (${rows.length} ligne(s) reçue(s) sur ${count ?? 'inconnu'})`,
      );
    }
    return rows;
  }

  /**
   * `ord_date_pay` est du texte. Le filtre SQL, lexical, ne borne qu'un
   * sur-ensemble par préfixe de jour (vrai quel que soit le format) ; la fenêtre
   * exacte est appliquée ici sur la date lue, et une date hors format ISO UTC
   * rend le verdict UNKNOWN au lieu d'être classée au hasard.
   */
  private async readConfirmedOrders(
    window: Window,
  ): Promise<ConfirmedOrderRow[]> {
    const from = Date.parse(window.from);
    const settledBefore = Date.parse(window.to) - SETTLE_MINUTES * 60_000;
    const dayAfterCutoff = new Date(settledBefore + DAY_MS)
      .toISOString()
      .slice(0, 10);
    const { data, count, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_date_pay', { count: 'exact' })
      .eq('payment_confirmed', true)
      .gte('ord_date_pay', window.from.slice(0, 10))
      .lt('ord_date_pay', dayAfterCutoff)
      .limit(READ_LIMIT);
    if (error) {
      throw new Error(
        `${TABLES.xtr_order} (${error.code ?? 'sans code'}) ${error.message}`,
      );
    }
    const rows = (data ?? []) as ConfirmedOrderReadRow[];
    if (count !== rows.length) {
      throw new Error(
        `${TABLES.xtr_order} tronquée (${rows.length} ligne(s) reçue(s) sur ${count ?? 'inconnu'})`,
      );
    }
    const settled: ConfirmedOrderRow[] = [];
    for (const r of rows) {
      if (!r.ord_date_pay || !ISO_UTC.test(r.ord_date_pay)) {
        throw new Error(
          `${TABLES.xtr_order}.ord_date_pay hors format ISO UTC (ord_id ${r.ord_id})`,
        );
      }
      const paidAt = Date.parse(r.ord_date_pay);
      if (paidAt >= from && paidAt <= settledBefore) {
        settled.push({ ord_id: r.ord_id });
      }
    }
    return settled;
  }

  private async lookupOrderIds(
    events: OrderPlacedEventRow[],
  ): Promise<Set<string>> {
    const keys = [
      ...new Set(events.map((e) => e.order_id).filter((k): k is string => !!k)),
    ];
    const known = new Set<string>();
    for (let i = 0; i < keys.length; i += KEY_LOOKUP_CHUNK) {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id')
        .in('ord_id', keys.slice(i, i + KEY_LOOKUP_CHUNK));
      if (error) {
        throw new Error(
          `${TABLES.xtr_order} (${error.code ?? 'sans code'}) ${error.message}`,
        );
      }
      for (const r of (data ?? []) as ConfirmedOrderRow[]) known.add(r.ord_id);
    }
    return known;
  }
}
