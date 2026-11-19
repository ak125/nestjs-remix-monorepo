/**
 * Mandat BT (2026-11-17) — lecture quotidienne des mails Paybox de automecanik.seo@gmail.com
 * vers `__order_capture_state` (source `paybox_mail`).
 *
 * Mode `PAYBOX_MAIL_IMPORT_MODE` :
 * - `off` (défaut, et forcé sans `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN` ou sans
 *   client OAuth) : aucune lecture, aucune écriture, aucun envoi ;
 * - `dry-run` : lit, rapproche et rend le rapport ; n'écrit rien, n'envoie rien ;
 * - `write` : enregistre les messages lus, écrit les états d'encaissement,
 *   envoie un mail d'écarts à `ADMIN_ORDER_EMAIL` s'il y en a.
 *
 * Aucune donnée client : ni corps de message, ni adresse du client, ni carte.
 * Seuls la référence de commande, le montant, le numéro d'autorisation, la
 * date, l'acceptation et les totaux de remise sont gardés.
 *
 * Une indisponibilité (Gmail, base) est levée, jamais masquée par un rapport
 * vide. Paybox n'est pas touché (D97) : rien ici n'appelle le module payments.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { MailService, type MailDelivery } from '../../../services/mail.service';
import { centimesDuTexte } from '../services/orders.service';
import { OrderBillingService } from '../services/order-billing.service';
import {
  GmailPayboxMailbox,
  PayboxMailScopeError,
  type PayboxMailbox,
} from './paybox-mail-gmail.client';
import {
  PAYBOX_SENDERS,
  PAYBOX_TICKET_SENDER,
  PAYBOX_TPE_SENDER,
  classifyMessage,
  isPayboxAuthenticated,
  parisDate,
  parseTelecollecte,
  parseTicket,
  senderAddress,
  type ParsedTelecollecte,
  type ParsedTicket,
} from './paybox-mail.parse';
import {
  DISCREPANCY_LABELS,
  MISSING_TICKET_HOURS,
  reconcile,
  type CaptureFact,
  type CaptureWrite,
  type Discrepancy,
  type OrderFact,
  type PaymentFact,
  type StoredTelecollecte,
  type StoredTicket,
  type UnrecognizedMessage,
} from './paybox-mail.reconcile';

export type ImportMode = 'off' | 'dry-run' | 'write';

export const PAYBOX_MAIL_MODE_ENV = 'PAYBOX_MAIL_IMPORT_MODE';
export const PAYBOX_MAIL_TOKEN_ENV = 'PAYBOX_MAIL_GMAIL_REFRESH_TOKEN';

const T_MESSAGE = '__paybox_mail_message';
const T_CAPTURE = '__order_capture_state';
const T_POSTBACK = 'ic_postback';

/** Fenêtre de la recherche Gmail : couvre plusieurs jours de passage manqué. */
export const MAIL_LOOKBACK_DAYS = 10;
/** Tickets relus en base : couvre T + 8 (retard) avec marge. */
const TICKET_WINDOW_DAYS = 30;
/** Télécollectes relues en base : un ticket arrivé en retard se rapproche encore. */
const TELECOLLECTE_WINDOW_DAYS = 10;
const MAX_MESSAGES = 500;
/** Plafond PostgREST : une fenêtre qui l'atteint est une erreur, pas une troncature. */
const ROW_CAP = 1000;
const CHUNK = 100;
const DAY = 864e5;

const MESSAGE_COLUMNS =
  'pmm_message_id, pmm_kind, pmm_received_at, pmm_ticket_accepted, pmm_ord_ref, pmm_amount_cents, pmm_authorized_at, pmm_remise_number, pmm_purchase_count, pmm_purchase_cents, pmm_refund_count, pmm_refund_cents, pmm_cancel_count, pmm_cancel_cents, pmm_collected_at';

interface MessageRow {
  pmm_message_id: string;
  pmm_kind: 'ticket' | 'telecollecte' | 'unrecognized';
  pmm_received_at: string;
  pmm_unrecognized_reason?: string | null;
  pmm_ticket_accepted?: boolean | null;
  pmm_ord_ref?: string | null;
  pmm_amount_cents?: number | null;
  pmm_auth_number?: string | null;
  pmm_authorized_at?: string | null;
  pmm_remise_number?: string | null;
  pmm_file_number?: string | null;
  pmm_purchase_count?: number | null;
  pmm_purchase_cents?: number | null;
  pmm_refund_count?: number | null;
  pmm_refund_cents?: number | null;
  pmm_cancel_count?: number | null;
  pmm_cancel_cents?: number | null;
  pmm_collected_at?: string | null;
}

export interface ImportReport {
  mode: ImportMode;
  status: 'off' | 'refused' | 'done';
  reason?: string;
  read?: {
    listed: number;
    alreadyRead: number;
    tickets: number;
    telecollectes: number;
    heartbeats: number;
    unrecognized: number;
    otherSenders: number;
    truncated: boolean;
  };
  writes?: Array<
    Pick<CaptureWrite, 'orderId' | 'state' | 'amountCents' | 'op'>
  >;
  applied?: number;
  discrepancies?: Discrepancy[];
  mail?: MailDelivery | 'skipped' | 'none' | 'failed';
}

function ticketRow(
  id: string,
  receivedAt: string,
  t: ParsedTicket,
): MessageRow {
  return {
    pmm_message_id: id,
    pmm_kind: 'ticket',
    pmm_received_at: receivedAt,
    pmm_ticket_accepted: t.accepted,
    pmm_ord_ref: t.orderRef,
    pmm_amount_cents: t.amountCents,
    pmm_auth_number: t.authNumber,
    pmm_authorized_at: t.authorizedAt,
  };
}

function telecollecteRow(
  id: string,
  receivedAt: string,
  t: ParsedTelecollecte,
): MessageRow {
  return {
    pmm_message_id: id,
    pmm_kind: 'telecollecte',
    pmm_received_at: receivedAt,
    pmm_remise_number: t.remiseNumber,
    pmm_file_number: t.fileNumber,
    pmm_purchase_count: t.purchaseCount,
    pmm_purchase_cents: t.purchaseCents,
    pmm_refund_count: t.refundCount,
    pmm_refund_cents: t.refundCents,
    pmm_cancel_count: t.cancelCount,
    pmm_cancel_cents: t.cancelCents,
    pmm_collected_at: t.collectedAt,
  };
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK)
    out.push(list.slice(i, i + CHUNK));
  return out;
}

@Injectable()
export class PayboxMailImportService extends SupabaseBaseService {
  protected readonly logger = new Logger(PayboxMailImportService.name);

  constructor(
    configService: ConfigService,
    private readonly mailService: MailService,
    private readonly billing: OrderBillingService,
  ) {
    super(configService);
  }

  /** Mode effectif : `off` sans jeton dédié ou sans client OAuth, ou si la valeur est inconnue. */
  mode(): ImportMode {
    const raw = (
      this.configService?.get<string>(PAYBOX_MAIL_MODE_ENV) ?? 'off'
    ).trim();
    if (!this.credentials()) return 'off';
    return raw === 'dry-run' || raw === 'write' ? raw : 'off';
  }

  private credentials() {
    const refreshToken = this.configService?.get<string>(PAYBOX_MAIL_TOKEN_ENV);
    const clientId = this.configService?.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService?.get<string>('GMAIL_CLIENT_SECRET');
    if (!refreshToken || !clientId || !clientSecret) return null;
    return { refreshToken, clientId, clientSecret };
  }

  /** Remplaçable en test ; ne lit jamais `GMAIL_REFRESH_TOKEN`. */
  protected createMailbox(): PayboxMailbox {
    const c = this.credentials();
    if (!c) throw new Error(`${PAYBOX_MAIL_TOKEN_ENV} absent`);
    return new GmailPayboxMailbox(c);
  }

  /** Contrôle de portée au démarrage : false si le jeton est refusé. */
  async checkToken(): Promise<boolean> {
    try {
      await this.createMailbox().assertReadonly();
      this.logger.log(
        'Jeton de lecture Paybox : portée gmail.readonly seule, accepté',
      );
      return true;
    } catch (e) {
      this.logger.error(
        `Lecture des mails Paybox refusée : ${(e as Error).message}`,
      );
      return false;
    }
  }

  /** Passage quotidien : mode lu dans la configuration. */
  async runScheduled(now = new Date()): Promise<ImportReport> {
    return this.run(this.mode(), now);
  }

  /** Relevé à blanc à la demande de l'admin : jamais d'écriture ni d'envoi. */
  async runDryRun(now = new Date()): Promise<ImportReport> {
    if (this.mode() === 'off') {
      return {
        mode: 'off',
        status: 'off',
        reason: `${PAYBOX_MAIL_MODE_ENV} vaut off, ou jeton ${PAYBOX_MAIL_TOKEN_ENV} absent`,
      };
    }
    return this.run('dry-run', now);
  }

  private async run(mode: ImportMode, now: Date): Promise<ImportReport> {
    if (mode === 'off') return { mode, status: 'off' };
    const mailbox = this.createMailbox();
    try {
      await mailbox.assertReadonly();
    } catch (e) {
      if (e instanceof PayboxMailScopeError) {
        this.logger.error(`Passage refusé : ${e.message}`);
        return { mode, status: 'refused', reason: e.message };
      }
      throw e;
    }

    // ── 1. Lecture des messages nouveaux ────────────────────────────────────
    const after = Math.floor((now.getTime() - MAIL_LOOKBACK_DAYS * DAY) / 1000);
    const ids = await mailbox.listIds(
      `from:(${PAYBOX_TICKET_SENDER} OR ${PAYBOX_TPE_SENDER}) after:${after}`,
      MAX_MESSAGES,
    );
    const known = await this.knownMessageIds(ids);
    const fresh: MessageRow[] = [];
    const unrecognized: UnrecognizedMessage[] = [];
    const read = {
      listed: ids.length,
      alreadyRead: known.size,
      tickets: 0,
      telecollectes: 0,
      heartbeats: 0,
      unrecognized: 0,
      otherSenders: 0,
      truncated: ids.length >= MAX_MESSAGES,
    };
    let lastTpeMailAt: string | null = null;
    const noteTpe = (at: string) => {
      if (!lastTpeMailAt || at > lastTpeMailAt) lastTpeMailAt = at;
    };
    const reject = (id: string, receivedAt: string, reason: string) => {
      unrecognized.push({ messageId: id, reason });
      fresh.push({
        pmm_message_id: id,
        pmm_kind: 'unrecognized',
        pmm_received_at: receivedAt,
        pmm_unrecognized_reason: reason,
      });
      read.unrecognized++;
    };

    for (const id of ids) {
      if (known.has(id)) continue;
      const h = await mailbox.headers(id);
      const from = senderAddress(h.from);
      if (!from || !PAYBOX_SENDERS.includes(from)) {
        read.otherSenders++;
        continue;
      }
      if (!isPayboxAuthenticated(h.authenticationResults)) {
        reject(
          id,
          h.internalDate,
          'authentification paybox.com absente (DKIM/DMARC)',
        );
        continue;
      }
      if (from === PAYBOX_TPE_SENDER) noteTpe(h.internalDate);
      const kind = classifyMessage(h.from, h.subject);
      if (kind === 'heartbeat') {
        read.heartbeats++;
        continue;
      }
      if (kind === null) {
        reject(id, h.internalDate, 'sujet inattendu');
        continue;
      }
      const body = await mailbox.body(id);
      if (kind === 'ticket') {
        const r = parseTicket(body);
        if ('reason' in r) reject(id, h.internalDate, `ticket : ${r.reason}`);
        else {
          fresh.push(ticketRow(id, h.internalDate, r.value));
          read.tickets++;
        }
      } else {
        const r = parseTelecollecte(body);
        if ('reason' in r)
          reject(id, h.internalDate, `télécollecte : ${r.reason}`);
        else {
          fresh.push(telecollecteRow(id, h.internalDate, r.value));
          read.telecollectes++;
        }
      }
    }

    if (mode === 'write' && fresh.length > 0) {
      const { error } = await this.supabase.from(T_MESSAGE).upsert(fresh, {
        onConflict: 'pmm_message_id',
        ignoreDuplicates: true,
      });
      if (error)
        throw new Error(`Messages Paybox non enregistrés : ${error.message}`);
    }

    // ── 2. Faits en base (fenêtres bornées) + messages de ce passage ────────
    const stored = await this.loadStoredMessages(now);
    const all = new Map<string, MessageRow>();
    for (const r of [...stored, ...fresh]) all.set(r.pmm_message_id, r);
    const tickets: StoredTicket[] = [];
    const telecollectes: StoredTelecollecte[] = [];
    for (const r of all.values()) {
      if (r.pmm_kind === 'ticket' && r.pmm_authorized_at) {
        tickets.push({
          messageId: r.pmm_message_id,
          accepted: r.pmm_ticket_accepted === true,
          orderRef: r.pmm_ord_ref ?? null,
          amountCents:
            r.pmm_amount_cents == null ? null : Number(r.pmm_amount_cents),
          authorizedAt: r.pmm_authorized_at,
        });
      } else if (r.pmm_kind === 'telecollecte' && r.pmm_collected_at) {
        noteTpe(r.pmm_received_at);
        telecollectes.push({
          messageId: r.pmm_message_id,
          remiseNumber: r.pmm_remise_number ?? '',
          purchaseCount: Number(r.pmm_purchase_count),
          purchaseCents: Number(r.pmm_purchase_cents),
          refundCount: Number(r.pmm_refund_count),
          refundCents: Number(r.pmm_refund_cents),
          cancelCount: Number(r.pmm_cancel_count),
          cancelCents: Number(r.pmm_cancel_cents),
          collectedAt: r.pmm_collected_at,
        });
      }
    }
    const payments = await this.loadRecentPayments(now);
    const refs = [
      ...new Set([
        ...tickets
          .filter((t) => t.accepted && t.orderRef)
          .map((t) => t.orderRef!),
        ...payments.map((p) => p.orderId),
      ]),
    ];
    const [orders, captures] = await Promise.all([
      this.loadOrders(refs),
      this.loadCaptures(refs),
    ]);

    const plan = reconcile({
      now,
      tickets,
      telecollectes,
      orders,
      captures,
      payments,
      lastTpeMailAt,
      unrecognized,
      fresh: new Set(fresh.map((r) => r.pmm_message_id)),
    });

    const report: ImportReport = {
      mode,
      status: 'done',
      read,
      writes: plan.writes.map(({ orderId, state, amountCents, op }) => ({
        orderId,
        state,
        amountCents,
        op,
      })),
      applied: 0,
      discrepancies: plan.discrepancies,
      mail: 'none',
    };
    this.logger.log(
      `Mails Paybox (${mode}) : ${read.listed} listés, ${read.tickets} tickets, ${read.telecollectes} télécollectes, ${read.unrecognized} non reconnus ; ${plan.writes.length} écritures prévues, ${plan.discrepancies.length} écarts`,
    );
    if (mode !== 'write') return report;

    // ── 3. Écritures et mail d'écarts (mode write seulement) ───────────────
    report.applied = await this.applyWrites(plan.writes, orders);
    if (plan.discrepancies.length > 0) {
      try {
        report.mail = await this.mailService.sendPayboxCaptureDiscrepancies(
          parisDate(now),
          plan.discrepancies.map((d) => ({
            label: DISCREPANCY_LABELS[d.kind],
            orderRef: d.orderRef,
            amountCents: d.amountCents,
            detail: d.detail,
          })),
        );
      } catch (e) {
        this.logger.error(
          `Mail d'écarts Paybox non envoyé : ${(e as Error).message}`,
        );
        report.mail = 'failed';
      }
    }
    return report;
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  private async knownMessageIds(ids: string[]): Promise<Set<string>> {
    const known = new Set<string>();
    for (const part of chunks(ids)) {
      const { data, error } = await this.supabase
        .from(T_MESSAGE)
        .select('pmm_message_id')
        .in('pmm_message_id', part);
      if (error)
        throw new Error(
          `Lecture des messages Paybox impossible : ${error.message}`,
        );
      for (const r of (data ?? []) as Array<{ pmm_message_id: string }>)
        known.add(r.pmm_message_id);
    }
    return known;
  }

  private async loadStoredMessages(now: Date): Promise<MessageRow[]> {
    const since = (days: number) =>
      new Date(now.getTime() - days * DAY).toISOString();
    const [tickets, tcs] = await Promise.all([
      this.supabase
        .from(T_MESSAGE)
        .select(MESSAGE_COLUMNS)
        .eq('pmm_kind', 'ticket')
        .gte('pmm_authorized_at', since(TICKET_WINDOW_DAYS))
        .limit(ROW_CAP),
      this.supabase
        .from(T_MESSAGE)
        .select(MESSAGE_COLUMNS)
        .eq('pmm_kind', 'telecollecte')
        .gte('pmm_collected_at', since(TELECOLLECTE_WINDOW_DAYS))
        .limit(ROW_CAP),
    ]);
    for (const r of [tickets, tcs]) {
      if (r.error)
        throw new Error(
          `Lecture des messages Paybox impossible : ${r.error.message}`,
        );
      if ((r.data ?? []).length >= ROW_CAP) {
        throw new Error(
          'Fenêtre de messages Paybox au plafond de lecture : rapprochement non tenté',
        );
      }
    }
    return [
      ...((tickets.data ?? []) as MessageRow[]),
      ...((tcs.data ?? []) as MessageRow[]),
    ];
  }

  /** Paiements Paybox enregistrés entre now − 48 h et now − 24 h (chacun vu une fois par jour). */
  private async loadRecentPayments(now: Date): Promise<PaymentFact[]> {
    const to = new Date(
      now.getTime() - MISSING_TICKET_HOURS * 3600e3,
    ).toISOString();
    const from = new Date(
      now.getTime() - 2 * MISSING_TICKET_HOURS * 3600e3,
    ).toISOString();
    const { data, error } = await this.supabase
      .from(T_POSTBACK)
      .select('orderid, datepayment')
      .eq('status', 'completed')
      .gte('datepayment', from)
      .lte('datepayment', to)
      .limit(ROW_CAP);
    if (error)
      throw new Error(`Lecture des paiements impossible : ${error.message}`);
    return (
      (data ?? []) as Array<{
        orderid: string | null;
        datepayment: string | null;
      }>
    )
      .filter((r) => r.orderid && r.datepayment)
      .map((r) => ({ orderId: r.orderid!, paidAt: r.datepayment! }));
  }

  private async loadOrders(
    refs: string[],
  ): Promise<Map<string, OrderFact & { parent: string | null }>> {
    const out = new Map<string, OrderFact & { parent: string | null }>();
    for (const part of chunks(refs)) {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id, ord_is_pay, ord_total_ttc, ord_parent')
        .in('ord_id', part);
      if (error)
        throw new Error(`Lecture des commandes impossible : ${error.message}`);
      for (const o of (data ?? []) as Array<{
        ord_id: string;
        ord_is_pay: string | null;
        ord_total_ttc: string | number | null;
        ord_parent: string | null;
      }>) {
        out.set(o.ord_id, {
          orderId: o.ord_id,
          paid: o.ord_is_pay === '1',
          totalCents:
            o.ord_total_ttc == null ? null : centimesDuTexte(o.ord_total_ttc),
          parent: o.ord_parent && o.ord_parent !== '0' ? o.ord_parent : null,
        });
      }
    }
    return out;
  }

  private async loadCaptures(
    refs: string[],
  ): Promise<Map<string, CaptureFact>> {
    const out = new Map<string, CaptureFact>();
    for (const part of chunks(refs)) {
      const { data, error } = await this.supabase
        .from(T_CAPTURE)
        .select('ocs_ord_id, ocs_state, ocs_captured_amount_cents, ocs_source')
        .in('ocs_ord_id', part);
      if (error)
        throw new Error(
          `Lecture des encaissements impossible : ${error.message}`,
        );
      for (const c of (data ?? []) as Array<{
        ocs_ord_id: string;
        ocs_state: CaptureFact['state'];
        ocs_captured_amount_cents: number | string | null;
        ocs_source: string;
      }>) {
        out.set(c.ocs_ord_id, {
          orderId: c.ocs_ord_id,
          state: c.ocs_state,
          amountCents:
            c.ocs_captured_amount_cents == null
              ? null
              : Number(c.ocs_captured_amount_cents),
          source: c.ocs_source,
        });
      }
    }
    return out;
  }

  // ── Écritures ─────────────────────────────────────────────────────────────

  /**
   * insert : seulement s'il n'existe toujours aucune ligne (conflit = une
   * saisie est passée entre-temps : rien n'est écrasé). update : seulement une
   * ligne `paybox_mail` encore `authorized`. Une capture écrite tente la
   * facture si la facturation est activée (même règle que la saisie BM).
   */
  private async applyWrites(
    writes: CaptureWrite[],
    orders: Map<string, OrderFact & { parent: string | null }>,
  ): Promise<number> {
    let applied = 0;
    for (const w of writes) {
      const row = {
        ocs_ord_id: w.orderId,
        ocs_state: w.state,
        ocs_captured_amount_cents: w.amountCents,
        ocs_source: 'paybox_mail' as const,
        ocs_checked_at: w.checkedAt,
        ocs_updated_by: w.updatedBy,
      };
      let done = false;
      if (w.op === 'insert') {
        const { error } = await this.supabase.from(T_CAPTURE).insert(row);
        if (error && (error as { code?: string }).code === '23505') {
          this.logger.warn(
            `Encaissement ${w.orderId} : ligne apparue entre-temps, rien écrasé`,
          );
        } else if (error) {
          throw new Error(
            `Encaissement ${w.orderId} non enregistré : ${error.message}`,
          );
        } else done = true;
      } else {
        const { data, error } = await this.supabase
          .from(T_CAPTURE)
          .update(row)
          .eq('ocs_ord_id', w.orderId)
          .eq('ocs_source', 'paybox_mail')
          .eq('ocs_state', 'authorized')
          .select('ocs_ord_id');
        if (error)
          throw new Error(
            `Encaissement ${w.orderId} non enregistré : ${error.message}`,
          );
        done = ((data ?? []) as unknown[]).length === 1;
      }
      if (!done) continue;
      applied++;
      this.logger.log(
        `Encaissement ${w.orderId} = ${w.state} (lu dans les mails Paybox)`,
      );
      if (w.state === 'captured' && this.billing.isEnabled()) {
        const target = orders.get(w.orderId)?.parent ?? w.orderId;
        try {
          const outcome = await this.billing.tryIssueInvoice(target);
          this.logger.log(
            'reason' in outcome
              ? `Facture de ${target} en attente : ${outcome.reason}`
              : `Facture ${outcome.invoiceNumber} émise pour ${target} (mail : ${outcome.mail})`,
          );
        } catch (e) {
          this.logger.error(
            `Facture de ${target} non émise : ${(e as Error).message}`,
          );
        }
      }
    }
    return applied;
  }
}
