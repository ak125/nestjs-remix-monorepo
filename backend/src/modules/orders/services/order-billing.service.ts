/**
 * Mandat BM (2026-11-17) — ajustements de paiement, état d'encaissement et
 * facture à l'expédition.
 *
 * Décisions : D26 (le site produit les factures), D64 amendée (facture à
 * l'expédition, une fois l'encaissement Verifone réel confirmé), Marwane
 * 2026-11-17 (moins cher : seul le montant réel est encaissé ; plus cher :
 * lien de supplément, sinon annulation avant encaissement ; ajustement et
 * motif sur la commande et la facture).
 *
 * Drapeau `ORDER_BILLING_ENABLED` (défaut : absent = désactivé). Désactivé :
 * aucune lecture ni écriture des tables du mandat (migration
 * 20261117_order_billing_capture_invoice.sql préparée, non appliquée), routes
 * en 403, aucune facture à l'expédition.
 *
 * L'état d'encaissement est SAISI par l'admin depuis le back-office Verifone
 * (`source = 'manual'`). La lecture automatique quotidienne (Paybox Direct,
 * type 00017) n'est pas branchée : il manque l'identifiant CLÉ, peut-être
 * l'option Paybox Direct, et NUMTRANS/NUMAPPEL ne sont pas enregistrés. La
 * question exacte est dans le rapport du mandat BM.
 *
 * Aucun encaissement ni remboursement n'est déclenché par ce service : il
 * enregistre des faits, calcule le montant à encaisser et émet la facture.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { TABLES } from '@repo/database-types';
import { OrderStatus, orderFulfilment } from '@repo/domain-commerce';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { MailService, type MailDelivery } from '../../../services/mail.service';
import { ORDER_EVENTS, type OrderShippedEvent } from '../events/order.events';
import { OrdersService } from './orders.service';
import {
  BillingCalcError,
  buildInvoiceDraft,
  expectedCaptureCents,
  paymentVoidOf,
  textFromCents,
  type PaymentVoid,
  type BillingAdjustmentRow,
  type BillingLineRow,
  type BillingOrderRow,
  type InvoiceLineDraft,
  type PaidSupplement,
} from './order-billing.calc';
import { renderInvoicePdf } from './invoice-pdf';

const ORDER_BILLING_FLAG = 'ORDER_BILLING_ENABLED';

const T_ADJUSTMENT = '__order_payment_adjustment';
const T_CAPTURE = '__order_capture_state';
const CANCELLED: string = OrderStatus.CANCELLED;

export type CaptureState = 'authorized' | 'captured' | 'cancelled' | 'refunded';

export interface CaptureStateRow {
  ocs_ord_id: string;
  ocs_state: CaptureState;
  ocs_captured_amount_cents: number | null;
  /** `paybox_mail` : lu dans les mails Paybox de automecanik.seo@gmail.com (mandat BT). */
  ocs_source: 'manual' | 'paybox_direct' | 'paybox_mail';
  ocs_checked_at: string;
  ocs_updated_by: string | null;
}

export type IssueOutcome =
  | { issued: true; invoiceNumber: string; mail: MailDelivery | 'failed' }
  | { issued: false; reason: string };

const ORDER_COLUMNS =
  'ord_id, ord_cst_id, ord_cba_id, ord_cda_id, ord_is_pay, ord_date_pay, ord_date, ord_date_ship, ord_date_deliv, ord_ords_id, ord_parent, ord_amount_ttc, ord_deposit_ttc, ord_shipping_fee_ttc, ord_total_ttc, ord_billing_snapshot';
const LINE_COLUMNS =
  'orl_id, orl_ord_id, orl_pg_id, orl_pg_name, orl_pm_name, orl_art_ref, orl_art_quantity, orl_art_price_sell_unit_ttc, orl_art_price_sell_ttc, orl_art_deposit_unit_ttc, orl_art_deposit_ttc';

type OrderRow = BillingOrderRow & {
  ord_is_pay: string | null;
  ord_date_pay: string | null;
  ord_date: string | null;
  ord_date_ship: string | null;
  ord_date_deliv: string | null;
  ord_ords_id: string | null;
  ord_parent: string | null;
  ord_billing_snapshot: Record<string, unknown> | null;
};

function readError(what: string, error: { message: string }): Error {
  return new Error(`Lecture ${what} impossible : ${error.message}`);
}

@Injectable()
export class OrderBillingService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderBillingService.name);

  constructor(
    configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly mailService: MailService,
  ) {
    super(configService);
  }

  isEnabled(): boolean {
    return this.configService?.get<string>(ORDER_BILLING_FLAG) === 'true';
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException(
        `Facturation à l'expédition désactivée (${ORDER_BILLING_FLAG})`,
      );
    }
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  private async loadOrder(orderId: string): Promise<OrderRow> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select(ORDER_COLUMNS)
      .eq('ord_id', orderId)
      .maybeSingle();
    if (error) throw readError('de la commande', error);
    if (!data) throw new NotFoundException(`Commande ${orderId} introuvable`);
    return data as unknown as OrderRow;
  }

  private async loadLines(orderId: string): Promise<BillingLineRow[]> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select(LINE_COLUMNS)
      .eq('orl_ord_id', orderId)
      .order('orl_id', { ascending: true });
    if (error) throw readError('des lignes', error);
    return (data ?? []) as unknown as BillingLineRow[];
  }

  private async loadAdjustments(
    orderId: string,
  ): Promise<BillingAdjustmentRow[]> {
    const { data, error } = await this.supabase
      .from(T_ADJUSTMENT)
      .select(
        'opa_id, opa_kind, opa_amount_ttc_cents, opa_reason, opa_supplement_ord_id, opa_created_by, opa_created_at',
      )
      .eq('opa_ord_id', orderId)
      .order('opa_id', { ascending: true });
    if (error) throw readError('des ajustements', error);
    return (data ?? []) as BillingAdjustmentRow[];
  }

  private async loadCapture(orderId: string): Promise<CaptureStateRow | null> {
    const { data, error } = await this.supabase
      .from(T_CAPTURE)
      .select('*')
      .eq('ocs_ord_id', orderId)
      .maybeSingle();
    if (error) throw readError("de l'état d'encaissement", error);
    return (data as CaptureStateRow | null) ?? null;
  }

  private async loadChildren(orderId: string): Promise<OrderRow[]> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select(ORDER_COLUMNS)
      .eq('ord_parent', orderId);
    if (error) throw readError('des suppléments', error);
    return (data ?? []) as unknown as OrderRow[];
  }

  private async loadInvoice(orderId: string) {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_invoice)
      .select('*')
      .eq('inv_ord_id', orderId)
      .maybeSingle();
    if (error) throw readError('de la facture', error);
    return data as Record<string, string | null> | null;
  }

  /** Vue d'ensemble pour le composant admin (prêt à brancher). */
  async getBilling(orderId: string) {
    this.assertEnabled();
    const order = await this.loadOrder(orderId);
    const [adjustments, capture, children, invoice] = await Promise.all([
      this.loadAdjustments(orderId),
      this.loadCapture(orderId),
      this.loadChildren(orderId),
      this.loadInvoice(orderId),
    ]);
    return {
      orderId,
      paid: order.ord_is_pay === '1',
      shippedAt: order.ord_date_ship,
      totalTtc: order.ord_total_ttc,
      expectedCaptureTtc: textFromCents(
        expectedCaptureCents(order, adjustments),
      ),
      capture,
      paymentVoid: paymentVoidOf(capture),
      adjustments,
      supplements: children.map((c) => ({
        orderId: c.ord_id,
        totalTtc: c.ord_total_ttc,
        paid: c.ord_is_pay === '1',
        cancelled: c.ord_ords_id === CANCELLED,
      })),
      invoice: invoice
        ? {
            number: invoice.inv_id,
            date: invoice.inv_date,
            totalTtc: invoice.inv_total_ttc,
          }
        : null,
    };
  }

  // ── Paiement annulé ou remboursé (complément BM n° 2) ─────────────────────

  /**
   * Marque « ne pas expédier » d'une commande. `enabled: false` = drapeau
   * absent : la table n'est pas lue (migration non appliquée) et rien n'est
   * marqué, comme toute la facturation. Une erreur de lecture est levée,
   * jamais rendue comme « aucune marque ». Aucun mail n'est envoyé ici.
   */
  async paymentVoid(
    orderId: string,
  ): Promise<{ enabled: boolean; paymentVoid: PaymentVoid | null }> {
    if (!this.isEnabled()) return { enabled: false, paymentVoid: null };
    return {
      enabled: true,
      paymentVoid: paymentVoidOf(await this.loadCapture(orderId)),
    };
  }

  /** Mêmes marques pour les commandes d'une page de liste (100 au plus). */
  async listPaymentVoids(orderIds: string[]): Promise<{
    enabled: boolean;
    voids: Array<PaymentVoid & { orderId: string }>;
  }> {
    if (!this.isEnabled()) return { enabled: false, voids: [] };
    if (orderIds.length === 0) return { enabled: true, voids: [] };
    const { data, error } = await this.supabase
      .from(T_CAPTURE)
      .select('ocs_ord_id, ocs_state, ocs_checked_at, ocs_source')
      .in('ocs_ord_id', orderIds)
      .in('ocs_state', ['cancelled', 'refunded']);
    if (error) throw readError("des états d'encaissement", error);
    const rows = (data ?? []) as Array<
      Pick<
        CaptureStateRow,
        'ocs_ord_id' | 'ocs_state' | 'ocs_checked_at' | 'ocs_source'
      >
    >;
    return {
      enabled: true,
      voids: rows.flatMap((r) => {
        const v = paymentVoidOf(r);
        return v ? [{ orderId: r.ocs_ord_id, ...v }] : [];
      }),
    };
  }

  // ── Ajustements ───────────────────────────────────────────────────────────

  /**
   * Moins cher : enregistre la réduction et son motif, rend le montant TTC à
   * encaisser. Possible seulement avant l'encaissement et avant la facture.
   * L'encaissement du montant réduit se fait dans le back-office Verifone
   * (aucun appel ici).
   */
  async recordReduction(
    orderId: string,
    input: { amountTtcCents: number; reason: string },
    userId?: string,
  ) {
    this.assertEnabled();
    const order = await this.loadOrder(orderId);
    if (order.ord_is_pay !== '1' || order.ord_ords_id === CANCELLED) {
      throw new ConflictException(
        `Commande ${orderId} non payée ou annulée : pas de réduction`,
      );
    }
    const [capture, invoice, adjustments] = await Promise.all([
      this.loadCapture(orderId),
      this.loadInvoice(orderId),
      this.loadAdjustments(orderId),
    ]);
    if (capture && capture.ocs_state !== 'authorized') {
      throw new ConflictException(
        `Encaissement déjà « ${capture.ocs_state} » : réduction impossible, traiter un remboursement à la main`,
      );
    }
    if (invoice) {
      throw new ConflictException(
        `Facture ${invoice.inv_id} déjà émise : réduction impossible`,
      );
    }
    const remaining =
      expectedCaptureCents(order, adjustments) - input.amountTtcCents;
    if (remaining <= 0) {
      throw new ConflictException(
        `Réduction supérieure ou égale au montant restant à encaisser : annuler la commande plutôt`,
      );
    }
    const { error } = await this.supabase.from(T_ADJUSTMENT).insert({
      opa_ord_id: orderId,
      opa_kind: 'reduction',
      opa_amount_ttc_cents: input.amountTtcCents,
      opa_reason: input.reason,
      opa_supplement_ord_id: null,
      opa_created_by: userId ?? null,
    });
    if (error) throw new Error(`Réduction non enregistrée : ${error.message}`);
    this.logger.log(
      `Réduction ${textFromCents(input.amountTtcCents)} € TTC sur ${orderId} (utilisateur ${userId ?? 'inconnu'}) ; à encaisser : ${textFromCents(remaining)} €`,
    );
    return {
      orderId,
      reductionTtc: textFromCents(input.amountTtcCents),
      amountToCaptureTtc: textFromCents(remaining),
    };
  }

  /**
   * Plus cher : commande enfant avec lien de paiement, ajustement et motif
   * enregistrés, mail au client avec le motif et le lien. Sans accord du
   * client, l'admin annule la commande avant encaissement (route existante).
   */
  async requestSupplement(
    orderId: string,
    input: { amountTtcCents: number; reason: string },
    userId?: string,
  ) {
    this.assertEnabled();
    const child = await this.ordersService.createReasonedSupplementOrder(
      orderId,
      input,
      { userId },
    );
    const { error } = await this.supabase.from(T_ADJUSTMENT).insert({
      opa_ord_id: orderId,
      opa_kind: 'supplement',
      opa_amount_ttc_cents: input.amountTtcCents,
      opa_reason: input.reason,
      opa_supplement_ord_id: child.orderId,
      opa_created_by: userId ?? null,
    });
    if (error) {
      // Le supplément existe, non payé et sans mail : l'admin le voit et peut
      // l'annuler ; on n'envoie pas de lien sans trace de l'ajustement.
      throw new Error(
        `Supplément ${child.orderId} créé mais ajustement non enregistré (${error.message}) : aucun mail envoyé`,
      );
    }
    const customer = await this.loadCustomer(orderId);
    let mail: MailDelivery | 'failed';
    try {
      mail = await this.mailService.sendSupplementPaymentRequest(customer, {
        parentOrderId: orderId,
        supplementOrderId: child.orderId,
        amountTtc: textFromCents(input.amountTtcCents),
        reason: input.reason,
        paymentUrl: child.paymentUrl,
      });
    } catch (e) {
      this.logger.error(
        `Mail de supplément ${child.orderId} non envoyé : ${e}`,
      );
      mail = 'failed';
    }
    return {
      orderId,
      supplementOrderId: child.orderId,
      amountTtc: textFromCents(input.amountTtcCents),
      paymentUrl: child.paymentUrl,
      mail,
    };
  }

  private async loadCustomer(orderId: string) {
    const order = await this.loadOrder(orderId);
    const { data, error } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('cst_mail, cst_fname, cst_name')
      .eq('cst_id', order.ord_cst_id)
      .maybeSingle();
    if (error) throw readError('du client', error);
    if (!data?.cst_mail) {
      throw new ConflictException(`Client de ${orderId} sans adresse e-mail`);
    }
    return {
      cst_mail: String(data.cst_mail),
      cst_fname: String(data.cst_fname ?? ''),
      cst_name: String(data.cst_name ?? ''),
    };
  }

  // ── Encaissement (saisie manuelle) ────────────────────────────────────────

  /**
   * Enregistre l'état relevé dans le back-office Verifone, puis tente la
   * facture si la commande est expédiée. Le montant encaissé est un fait : il
   * est enregistré même s'il diffère du montant attendu, et l'écart bloque la
   * facture (message explicite).
   */
  async recordCaptureState(
    orderId: string,
    input: { state: CaptureState; capturedAmountCents?: number },
    userId?: string,
  ) {
    this.assertEnabled();
    if (input.state === 'captured' && input.capturedAmountCents == null) {
      throw new BadRequestException('Montant encaissé requis');
    }
    const order = await this.loadOrder(orderId);
    if (order.ord_is_pay !== '1') {
      throw new ConflictException(`Commande ${orderId} non payée`);
    }
    const row = {
      ocs_ord_id: orderId,
      ocs_state: input.state,
      ocs_captured_amount_cents:
        input.state === 'captured' ? input.capturedAmountCents : null,
      ocs_source: 'manual' as const,
      ocs_checked_at: new Date().toISOString(),
      ocs_updated_by: userId ?? null,
    };
    const { error } = await this.supabase
      .from(T_CAPTURE)
      .upsert(row, { onConflict: 'ocs_ord_id' });
    if (error) {
      throw new Error(`État d'encaissement non enregistré : ${error.message}`);
    }
    this.logger.log(
      `Encaissement ${orderId} = ${input.state}${row.ocs_captured_amount_cents != null ? ` (${textFromCents(row.ocs_captured_amount_cents)} €)` : ''} saisi par ${userId ?? 'inconnu'}`,
    );
    // Le supplément payé est encaissé à part : sa facture est celle du parent.
    const invoiceTarget =
      order.ord_parent && order.ord_parent !== '0' ? order.ord_parent : orderId;
    const invoice =
      input.state === 'captured'
        ? await this.tryIssueInvoice(invoiceTarget)
        : ({ issued: false, reason: 'encaissement non confirmé' } as const);
    return { orderId, capture: row, invoice };
  }

  // ── Facture ───────────────────────────────────────────────────────────────

  /** Expédition : la facture part si l'encaissement est déjà confirmé. */
  @OnEvent(ORDER_EVENTS.SHIPPED)
  async onOrderShipped(event: OrderShippedEvent): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const outcome = await this.tryIssueInvoice(event.orderId);
      this.logger.log(
        'reason' in outcome
          ? `Facture de ${event.orderId} en attente : ${outcome.reason}`
          : `Facture ${outcome.invoiceNumber} émise à l'expédition de ${event.orderId} (mail : ${outcome.mail})`,
      );
    } catch (e) {
      this.logger.error(`Facture de ${event.orderId} non émise : ${e}`);
    }
  }

  /**
   * Émet la facture si — et seulement si — la commande est payée, expédiée,
   * encaissée au montant attendu, sans supplément en attente, et chaque
   * supplément payé encaissé à son montant. Sinon rend la raison, sans écrire.
   */
  async tryIssueInvoice(orderId: string): Promise<IssueOutcome> {
    this.assertEnabled();
    const order = await this.loadOrder(orderId);
    if (order.ord_is_pay !== '1')
      return { issued: false, reason: 'commande non payée' };
    // Statut « Expédiée » ou « Livrée » (ORDER_FULFILMENT_STATUS), sinon la
    // date d'expédition posée par le même bouton (commandes antérieures).
    if (orderFulfilment(order) === null)
      return { issued: false, reason: 'commande non expédiée' };
    const existing = await this.loadInvoice(orderId);
    if (existing)
      return { issued: false, reason: `facture ${existing.inv_id} déjà émise` };

    const [lines, adjustments, capture, children] = await Promise.all([
      this.loadLines(orderId),
      this.loadAdjustments(orderId),
      this.loadCapture(orderId),
      this.loadChildren(orderId),
    ]);
    const voided = paymentVoidOf(capture);
    if (voided) return { issued: false, reason: voided.label };
    if (
      capture?.ocs_state !== 'captured' ||
      capture.ocs_captured_amount_cents == null
    ) {
      return { issued: false, reason: 'encaissement non confirmé' };
    }
    const expected = expectedCaptureCents(order, adjustments);
    if (capture.ocs_captured_amount_cents !== expected) {
      return {
        issued: false,
        reason: `écart d'encaissement : ${textFromCents(capture.ocs_captured_amount_cents)} € encaissés, ${textFromCents(expected)} € attendus`,
      };
    }

    const live = children.filter((c) => c.ord_ords_id !== CANCELLED);
    const unpaid = live.find((c) => c.ord_is_pay !== '1');
    if (unpaid) {
      return {
        issued: false,
        reason: `supplément ${unpaid.ord_id} non payé : obtenir l'accord du client ou annuler`,
      };
    }
    const paidSupplements: PaidSupplement[] = [];
    for (const child of live) {
      const childCapture = await this.loadCapture(child.ord_id);
      const childTotal = expectedCaptureCents(child, []);
      if (
        childCapture?.ocs_state !== 'captured' ||
        childCapture.ocs_captured_amount_cents !== childTotal
      ) {
        return {
          issued: false,
          reason: `supplément ${child.ord_id} non encaissé à son montant (${textFromCents(childTotal)} €)`,
        };
      }
      paidSupplements.push({
        order: child,
        lines: await this.loadLines(child.ord_id),
      });
    }

    let draft;
    try {
      draft = buildInvoiceDraft({
        order,
        lines,
        adjustments,
        paidSupplements,
        capturedCents: capture.ocs_captured_amount_cents,
      });
    } catch (e) {
      if (e instanceof BillingCalcError)
        return { issued: false, reason: e.message };
      throw e;
    }

    const { data: invoiceNumber, error } = await this.callRpc<string>(
      'issue_order_invoice_atomic',
      { p_invoice: draft.invoice, p_lines: draft.lines },
      { isServiceRole: true, source: 'internal' },
    );
    if (error || !invoiceNumber) {
      throw new Error(
        `Émission de la facture de ${orderId} refusée : ${error?.message ?? 'numéro absent'}`,
      );
    }
    this.logger.log(`Facture ${invoiceNumber} émise pour ${orderId}`);

    let mail: MailDelivery | 'failed';
    try {
      const pdf = await this.renderPdf(orderId);
      const customer = await this.loadCustomer(orderId);
      mail = await this.mailService.sendInvoice(
        customer,
        { orderId, invoiceNumber, totalTtc: draft.invoice.inv_total_ttc },
        pdf.content,
      );
    } catch (e) {
      // La facture est émise et téléchargeable : seul le mail a échoué.
      this.logger.error(
        `Mail de la facture ${invoiceNumber} non envoyé : ${e}`,
      );
      mail = 'failed';
    }
    return { issued: true, invoiceNumber, mail };
  }

  /** PDF reconstruit depuis la facture enregistrée (jamais recalculé). */
  /**
   * Facture du client connecté, pour afficher le lien de téléchargement.
   * `null` si le drapeau est éteint, si la facture n'existe pas encore ou si
   * elle n'est pas la sienne (même réponse : rien ne fuit).
   */
  async findCustomerInvoice(
    orderId: string,
    customerId: string,
  ): Promise<{ invoiceNumber: string; issuedAt: string | null } | null> {
    if (!this.isEnabled()) return null;
    const invoice = await this.loadInvoice(orderId);
    if (!invoice?.inv_id || String(invoice.inv_cst_id) !== String(customerId)) {
      return null;
    }
    return {
      invoiceNumber: invoice.inv_id,
      issuedAt: invoice.inv_date ?? null,
    };
  }

  async renderPdf(
    orderId: string,
    ownerCustomerId?: string,
  ): Promise<{ filename: string; content: Buffer }> {
    this.assertEnabled();
    const invoice = await this.loadInvoice(orderId);
    if (!invoice || !invoice.inv_id) {
      throw new NotFoundException('Facture non trouvée');
    }
    if (
      ownerCustomerId !== undefined &&
      String(invoice.inv_cst_id) !== String(ownerCustomerId)
    ) {
      throw new NotFoundException('Facture non trouvée');
    }
    const order = await this.loadOrder(orderId);
    const { data: lines, error } = await this.supabase
      .from(TABLES.xtr_invoice_line)
      .select('*')
      .eq('invl_inv_id', invoice.inv_id)
      .order('invl_id', { ascending: true });
    if (error) throw readError('des lignes de facture', error);

    const snap = (order.ord_billing_snapshot ?? {}) as Record<string, unknown>;
    const s = (k: string) =>
      typeof snap[k] === 'string' ? String(snap[k]).trim() : '';
    let buyerLines = [
      `${s('firstName')} ${s('lastName')}`.trim(),
      s('address'),
      s('addressLine2'),
      `${s('zipCode')} ${s('city')}`.trim(),
      s('country'),
    ].filter(Boolean);
    if (buyerLines.length === 0) {
      const c = await this.loadCustomer(orderId);
      buyerLines = [`${c.cst_fname} ${c.cst_name}`.trim()];
    }

    const content = renderInvoicePdf({
      invoiceNumber: String(invoice.inv_id),
      invoiceDate: String(invoice.inv_date ?? ''),
      orderId,
      orderDate: order.ord_date,
      shippedAt: order.ord_date_ship,
      paidAt: order.ord_date_pay,
      buyerLines,
      lines: (lines ?? []) as unknown as InvoiceLineDraft[],
      totals: {
        amountHt: String(invoice.inv_amount_ht ?? '0.00'),
        depositHt: String(invoice.inv_deposit_ht ?? '0.00'),
        shippingHt: String(invoice.inv_shipping_fee_ht ?? '0.00'),
        totalHt: String(invoice.inv_total_ht ?? '0.00'),
        tva: String(invoice.inv_tva ?? '0.00'),
        totalTtc: String(invoice.inv_total_ttc ?? '0.00'),
        depositTtc: String(invoice.inv_deposit_ttc ?? '0.00'),
        shippingTtc: String(invoice.inv_shipping_fee_ttc ?? '0.00'),
      },
      info: String(invoice.inv_info ?? ''),
    });
    return { filename: `facture-${invoice.inv_id}.pdf`, content };
  }
}
