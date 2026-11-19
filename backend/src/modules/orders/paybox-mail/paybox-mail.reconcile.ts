/**
 * Mandat BT (2026-11-17) — rapprochement pur des mails Paybox lus avec les
 * commandes et l'état d'encaissement (`__order_capture_state`).
 *
 * Aucune I/O : rend un plan d'écritures et la liste des écarts. Le service
 * n'applique le plan qu'en mode `write`.
 *
 * Règles (mandat BT, §5) :
 * a) ticket accepté, commande payée trouvée, montant égal au montant payé ⇒
 *    `authorized` (source `paybox_mail`) s'il n'existe aucune ligne ; sinon écart.
 * b) télécollecte du jour T ⇔ tickets acceptés autorisés le jour T − 7 (heure
 *    de Paris). Achats (nombre et montant) égaux au groupe, Rembt et Annulées
 *    à 0 ⇒ chaque commande passe `captured` à son montant, `ocs_checked_at` =
 *    heure de la télécollecte ; sinon écart, aucune écriture.
 * c) une ligne qui n'est pas de source `paybox_mail` (saisie `manual`, ou
 *    `paybox_direct`) n'est jamais écrasée ; un désaccord avec elle est un écart.
 * d) écarts : capture en retard, ticket manquant, silence de tpeweb, format non
 *    reconnu, télécollecte non rapprochée.
 */
import { addDays, parisDate } from './paybox-mail.parse';

/**
 * Délai entre l'autorisation (ticket) et la télécollecte qui l'encaisse, en
 * jours calendaires de Paris. Observé sur une seule paire au 2026-11-17 :
 * ticket du 07/11 à 42,20 EUR, télécollecte du 14/11 « Achats 1 » à 42,20.
 * À confirmer par les télécollectes attendues les 23 et 24/11 (tickets des
 * 16 et 17/11). Toute exception devient un écart « télécollecte non
 * rapprochée », jamais une écriture.
 */
export const CAPTURE_DELAY_DAYS = 7;
/** Capture en retard : aucune capture lue au jour T + 8 de l'autorisation. */
export const LATE_CAPTURE_DAYS = CAPTURE_DELAY_DAYS + 1;
/** Ticket manquant : paiement Paybox en base sans ticket lu après 24 h. */
export const MISSING_TICKET_HOURS = 24;
/** Silence : aucun mail de tpeweb@paybox.com depuis 48 h. */
export const TPE_SILENCE_HOURS = 48;

export interface StoredTicket {
  messageId: string;
  accepted: boolean;
  orderRef: string | null;
  amountCents: number | null;
  authorizedAt: string;
}

export interface StoredTelecollecte {
  messageId: string;
  remiseNumber: string;
  purchaseCount: number;
  purchaseCents: number;
  refundCount: number;
  refundCents: number;
  cancelCount: number;
  cancelCents: number;
  collectedAt: string;
}

export interface OrderFact {
  orderId: string;
  paid: boolean;
  totalCents: number | null;
}

export interface CaptureFact {
  orderId: string;
  state: 'authorized' | 'captured' | 'cancelled' | 'refunded';
  amountCents: number | null;
  source: string;
}

export interface PaymentFact {
  orderId: string;
  paidAt: string;
}

export interface UnrecognizedMessage {
  messageId: string;
  reason: string;
}

export type DiscrepancyKind =
  | 'commande_introuvable'
  | 'montant_different'
  | 'ticket_en_double'
  | 'telecollecte_non_rapprochee'
  | 'desaccord_saisie'
  | 'capture_en_retard'
  | 'ticket_manquant'
  | 'silence_tpeweb'
  | 'format_non_reconnu';

/** Libellés du mail d'écarts. */
export const DISCREPANCY_LABELS: Record<DiscrepancyKind, string> = {
  commande_introuvable: 'Commande introuvable ou non payée',
  montant_different: 'Montant différent de la commande',
  ticket_en_double: 'Ticket en double',
  telecollecte_non_rapprochee: 'Télécollecte non rapprochée',
  desaccord_saisie: 'Désaccord avec la saisie',
  capture_en_retard: 'Capture en retard',
  ticket_manquant: 'Ticket manquant',
  silence_tpeweb: 'Aucun mail tpeweb',
  format_non_reconnu: 'Format non reconnu',
};

export interface Discrepancy {
  kind: DiscrepancyKind;
  orderRef?: string;
  amountCents?: number;
  detail: string;
}

export interface CaptureWrite {
  orderId: string;
  state: 'authorized' | 'captured';
  amountCents: number | null;
  checkedAt: string;
  updatedBy: string;
  /** insert : aucune ligne ; update : ligne `paybox_mail` `authorized` existante. */
  op: 'insert' | 'update';
}

export interface ReconcileInput {
  now: Date;
  tickets: StoredTicket[];
  telecollectes: StoredTelecollecte[];
  orders: Map<string, OrderFact>;
  captures: Map<string, CaptureFact>;
  /** Paiements Paybox en base, fenêtre [now − 48 h, now − 24 h] (un signalement par paiement). */
  payments: PaymentFact[];
  /** Dernier mail exact de tpeweb@paybox.com (télécollecte ou téléparamétrage). */
  lastTpeMailAt: string | null;
  unrecognized: UnrecognizedMessage[];
  /**
   * Messages lus pour la première fois par ce passage. Les écarts durables
   * d'un ticket ou d'une télécollecte (commande introuvable, montant, double,
   * non rapprochée, désaccord) ne sont signalés qu'à la première lecture ;
   * la capture en retard l'est chaque jour jusqu'à sa résolution.
   */
  fresh: Set<string>;
}

export interface ReconcilePlan {
  writes: CaptureWrite[];
  discrepancies: Discrepancy[];
}

const HOUR = 3600e3;

export function reconcile(input: ReconcileInput): ReconcilePlan {
  const writes: CaptureWrite[] = [];
  const discrepancies: Discrepancy[] = [];
  const planned = new Map<string, CaptureWrite>();

  // ── a) tickets acceptés : validité de chacun ─────────────────────────────
  const accepted = input.tickets.filter(
    (t) => t.accepted && t.orderRef && t.amountCents != null,
  );
  const byRef = new Map<string, StoredTicket[]>();
  for (const t of accepted) {
    byRef.set(t.orderRef!, [...(byRef.get(t.orderRef!) ?? []), t]);
  }
  /** Tickets dont la commande et le montant concordent : seuls candidats à une écriture. */
  const valid = new Map<string, StoredTicket>();
  for (const [ref, list] of byRef) {
    const amountCents = list[0].amountCents!;
    const report = (d: Discrepancy) => {
      if (list.some((t) => input.fresh.has(t.messageId))) discrepancies.push(d);
    };
    if (list.length > 1) {
      report({
        kind: 'ticket_en_double',
        orderRef: ref,
        amountCents,
        detail: `${list.length} tickets acceptés pour la même commande`,
      });
      continue;
    }
    const order = input.orders.get(ref);
    if (!order || !order.paid) {
      report({
        kind: 'commande_introuvable',
        orderRef: ref,
        amountCents,
        detail: order
          ? 'commande non payée en base'
          : 'commande absente de la base',
      });
      continue;
    }
    if (order.totalCents !== amountCents) {
      report({
        kind: 'montant_different',
        orderRef: ref,
        amountCents,
        detail: `ticket ${cents(amountCents)} €, payé en base ${order.totalCents == null ? 'illisible' : `${cents(order.totalCents)} €`}`,
      });
      continue;
    }
    valid.set(ref, list[0]);
    if (!input.captures.has(ref)) {
      const w: CaptureWrite = {
        orderId: ref,
        state: 'authorized',
        amountCents: null,
        checkedAt: list[0].authorizedAt,
        updatedBy: `paybox_mail:${list[0].messageId}`,
        op: 'insert',
      };
      planned.set(ref, w);
    }
  }

  // ── b) télécollectes : groupe des tickets du jour T − 7 ──────────────────
  const tcByDay = new Map<string, StoredTelecollecte[]>();
  for (const tc of input.telecollectes) {
    const day = parisDate(tc.collectedAt);
    tcByDay.set(day, [...(tcByDay.get(day) ?? []), tc]);
  }
  for (const [day, list] of tcByDay) {
    const authDay = addDays(day, -CAPTURE_DELAY_DAYS);
    // Vue de la banque : tous les tickets acceptés du jour, valides ou non.
    const group = accepted.filter((t) => parisDate(t.authorizedAt) === authDay);
    const groupCents = group.reduce((s, t) => s + t.amountCents!, 0);
    const refs = group.map((t) => t.orderRef!).join(', ') || 'aucun';
    const fresh = list.some((t) => input.fresh.has(t.messageId));
    if (list.length > 1) {
      if (fresh)
        discrepancies.push({
          kind: 'telecollecte_non_rapprochee',
          detail: `${list.length} télécollectes le ${day} (remises ${list.map((t) => t.remiseNumber).join(', ')}) : rapprochement non tenté`,
        });
      continue;
    }
    const tc = list[0];
    const ok =
      tc.purchaseCount === group.length &&
      tc.purchaseCents === groupCents &&
      tc.refundCount === 0 &&
      tc.refundCents === 0 &&
      tc.cancelCount === 0 &&
      tc.cancelCents === 0;
    if (!ok) {
      if (fresh)
        discrepancies.push({
          kind: 'telecollecte_non_rapprochee',
          amountCents: tc.purchaseCents,
          detail:
            `remise ${tc.remiseNumber} du ${day} : Achats ${tc.purchaseCount} / ${cents(tc.purchaseCents)} €, ` +
            `Rembt ${tc.refundCount} / ${cents(tc.refundCents)} €, Annulées ${tc.cancelCount} / ${cents(tc.cancelCents)} € ; ` +
            `tickets acceptés du ${authDay} : ${group.length} / ${cents(groupCents)} € (${refs})`,
        });
      continue;
    }
    for (const t of group) {
      const ref = t.orderRef!;
      if (valid.get(ref) !== t) continue; // écart déjà signalé en a)
      const existing = input.captures.get(ref);
      const capture: CaptureWrite = {
        orderId: ref,
        state: 'captured',
        amountCents: t.amountCents,
        checkedAt: tc.collectedAt,
        updatedBy: `paybox_mail:${tc.messageId}`,
        op: 'insert',
      };
      if (!existing) {
        planned.set(ref, capture);
        continue;
      }
      if (existing.source !== 'paybox_mail') {
        if (
          fresh &&
          (existing.state !== 'captured' ||
            existing.amountCents !== t.amountCents)
        ) {
          discrepancies.push({
            kind: 'desaccord_saisie',
            orderRef: ref,
            amountCents: t.amountCents!,
            detail: `télécollecte du ${day} : encaissée ${cents(t.amountCents!)} € ; saisie ${existing.source} : ${existing.state}${existing.amountCents != null ? ` ${cents(existing.amountCents)} €` : ''}`,
          });
        }
        continue;
      }
      if (existing.state === 'authorized')
        planned.set(ref, { ...capture, op: 'update' });
    }
  }
  writes.push(...planned.values());

  // ── d) capture en retard ─────────────────────────────────────────────────
  const today = parisDate(input.now);
  for (const [ref, t] of valid) {
    const state =
      planned.get(ref)?.state ?? input.captures.get(ref)?.state ?? null;
    if (state !== null && state !== 'authorized') continue;
    const authDay = parisDate(t.authorizedAt);
    if (today >= addDays(authDay, LATE_CAPTURE_DAYS)) {
      discrepancies.push({
        kind: 'capture_en_retard',
        orderRef: ref,
        amountCents: t.amountCents!,
        detail: `autorisée le ${authDay}, aucune capture lue au ${today}`,
      });
    }
  }

  // ── d) ticket manquant ───────────────────────────────────────────────────
  const ticketRefs = new Set(accepted.map((t) => t.orderRef!));
  const cutoff = input.now.getTime() - MISSING_TICKET_HOURS * HOUR;
  for (const p of input.payments) {
    if (ticketRefs.has(p.orderId)) continue;
    if (new Date(p.paidAt).getTime() > cutoff) continue;
    const order = input.orders.get(p.orderId);
    discrepancies.push({
      kind: 'ticket_manquant',
      orderRef: p.orderId,
      ...(order?.totalCents != null ? { amountCents: order.totalCents } : {}),
      detail: `paiement Paybox enregistré le ${p.paidAt.slice(0, 16).replace('T', ' ')} UTC, aucun ticket lu`,
    });
  }

  // ── d) silence de tpeweb ─────────────────────────────────────────────────
  const silent =
    !input.lastTpeMailAt ||
    input.now.getTime() - new Date(input.lastTpeMailAt).getTime() >
      TPE_SILENCE_HOURS * HOUR;
  if (silent) {
    discrepancies.push({
      kind: 'silence_tpeweb',
      detail: input.lastTpeMailAt
        ? `dernier mail de tpeweb@paybox.com le ${input.lastTpeMailAt.slice(0, 16).replace('T', ' ')} UTC`
        : 'aucun mail de tpeweb@paybox.com dans la fenêtre lue',
    });
  }

  // ── d) formats non reconnus ──────────────────────────────────────────────
  for (const u of input.unrecognized) {
    discrepancies.push({
      kind: 'format_non_reconnu',
      detail: `message ${u.messageId} : ${u.reason}`,
    });
  }

  return { writes, discrepancies };
}

function cents(c: number): string {
  return `${Math.trunc(c / 100)},${String(Math.abs(c) % 100).padStart(2, '0')}`;
}
