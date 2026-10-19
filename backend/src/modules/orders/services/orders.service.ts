import { createHash, randomUUID } from 'crypto';
import { TABLES } from '@repo/database-types';
import {
  OrderStatus,
  type OrderStatusCode,
  isOrderStatusCode,
  isValidTransition,
} from '@repo/domain-commerce';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { PiecePriceDataService } from '@database/services/piece-price-data.service';
import { SITE_ORIGIN } from '@config/site.constants';
import { OrderCalculationService } from './order-calculation.service';
import { OrderStatusService } from './order-status.service';
import { ShippingService } from '../../shipping/shipping.service';
import { ShippingCalculatorService } from '../../cart/services/shipping-calculator.service';
import {
  MailService,
  OrderEmailData,
  CustomerEmailData,
} from '../../../services/mail.service';
import { ORDER_EVENTS, type OrderCreatedEvent } from '../events/order.events';

/** Postal address for billing or shipping */
export interface OrderAddress {
  firstName?: string;
  lastName?: string;
  address?: string;
  addressLine2?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface CreateOrderData {
  customerId: string;
  orderLines: Array<{
    productId: string;
    productName: string;
    productReference: string;
    productBrand?: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    discount?: number;
    consigne_unit?: number;
    has_consigne?: boolean;
    website_url?: string; // F1 attribution : source d'ajout par-ligne → orl_website_url
  }>;
  billingAddress: OrderAddress;
  shippingAddress: OrderAddress;
  customerNote?: string;
  shippingMethod?: string;
  idempotencyKey?: string;
  guestEmail?: string;
  shippingFee?: number;
  couponCode?: string;
  gaClientId?: string;
}

export interface UpdateOrderData {
  billingAddress?: OrderAddress;
  shippingAddress?: OrderAddress;
  customerNote?: string;
  /** Canonical order status (1..5 per ___xtr_order_status lookup, validated by @repo/domain-commerce). */
  status?: OrderStatusCode;
  /** Optional correlation_id for event-stream lineage (defaults to randomUUID per call). */
  correlationId?: string;
  /** Optional user_id (admin acting on behalf of customer) for audit trail. */
  userId?: number;
}

/**
 * Calcule un fingerprint canonique serveur pour une commande.
 * Montants en centimes entiers, lignes triées, SHA256 complet.
 */
export function computeOrderFingerprint(data: CreateOrderData): string {
  const payload = JSON.stringify({
    customerId: data.customerId || null,
    guestEmail: data.guestEmail || null,
    lines: (data.orderLines || [])
      .map(
        (i) =>
          `${i.productId}:${i.quantity}:${Math.round((i.unitPrice || 0) * 100)}`,
      )
      .sort()
      .join(','),
    total: Math.round(
      (data.orderLines || []).reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      ) * 100,
    ),
    shipping: data.shippingMethod || null,
    shippingFee: Math.round((data.shippingFee || 0) * 100),
    zipCode: data.shippingAddress?.zipCode || null,
    country: data.shippingAddress?.country || 'FR',
    currency: 'EUR',
    coupon: data.couponCode || null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Motif de refus d'une annulation demandée par le client depuis son espace,
 * ou `null` si elle est permise. Règle unique pour l'affichage du bouton
 * (GET /api/orders/:id → `customer_can_cancel`) et l'annulation elle-même
 * (DELETE /api/orders/:id).
 *
 * - Paiement : seule une commande explicitement impayée (`ord_is_pay = '0'`)
 *   et sans date de paiement est annulable. Le statut ne suffit pas : le
 *   callback Paybox pose `ord_is_pay = '1'` avec `ord_ords_id = '3'`, des
 *   commandes payées historiques sont restées en '1', et des commandes
 *   réellement payées portent `ord_date_pay` avec `ord_is_pay = '0'`.
 *   Rembourser relève du support (module payments/ hors périmètre), pas d'un
 *   bouton client.
 * - Statut : uniquement '1' (en cours de traitement), transition canonique
 *   vers '2' (@repo/domain-commerce). '3' n'est posé que par le paiement
 *   (`mark_order_paid_atomic`, avec `ord_is_pay = '1'`) et '4' le suit : un
 *   '3'/'4' impayé est une donnée contradictoire, renvoyée au support. Exclut
 *   aussi '2', '5', l'absence de statut et les valeurs hors canon ('6', posé
 *   par l'annulation admin).
 */
export function getCustomerCancelRefusal(order: {
  ord_ords_id?: unknown;
  ord_is_pay?: unknown;
  ord_date_pay?: unknown;
}): string | null {
  const isPaid = String(order.ord_is_pay);
  const hasPayDate =
    order.ord_date_pay != null && String(order.ord_date_pay).trim() !== '';
  if (isPaid === '1' || hasPayDate) {
    return "Cette commande est déjà payée : pour l'annuler, contactez notre service client.";
  }
  const status = order.ord_ords_id;
  if (
    isPaid !== '0' ||
    status !== OrderStatus.PROCESSING ||
    !isValidTransition(status, OrderStatus.CANCELLED)
  ) {
    return 'Cette commande ne peut plus être annulée.';
  }
  return null;
}

export interface OrderFilters {
  customerId?: string;
  status?: number;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OrderLine {
  id?: number;
  orderId: string;
  productId: string;
  productName: string;
  productReference: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discount: number;
  subtotal: number;
}

/** Full order with customer and lines (returned by getOrderById) */
export interface OrderWithDetails extends Record<string, unknown> {
  ord_id?: string;
  ord_cst_id?: string;
  ord_date?: string;
  ord_total_ttc?: string;
  ord_ords_id?: string;
  ord_cancel_date?: string | null;
  ord_cancel_reason?: string | null;
  ord_updated_at?: string | null;
  customer: Record<string, unknown> | null;
  lines: Record<string, unknown>[];
  statusHistory: Record<string, unknown>[];
}

/** Paginated list result */
export interface OrderListResult {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/** Order statistics */
export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  statusBreakdown: Record<string, number>;
}

/** Simple operation result */
export interface OrderOperationResult {
  success: boolean;
  message: string;
  ord_id?: string;
}

/** Échange d'une ligne payée en rupture contre un équivalent plus cher. */
export interface CreateSupplementOrderInput {
  /** `orl_id` de la ligne en rupture, dans la commande d'origine. */
  lineId: string;
  /** `piece_id` de l'équivalent disponible. */
  pieceId: number;
  /** Nombre de pièces de l'équivalent. */
  quantity: number;
  /** Prix d'achat HT unitaire de l'équivalent, confirmé chez le fournisseur. */
  confirmedPurchaseHt: number;
}

/** Commande de supplément créée, et le lien qui permet au client de la payer. */
export interface SupplementOrderResult {
  orderId: string;
  parentOrderId: string;
  totalTtc: number;
  unitTtc: number;
  quantity: number;
  paymentUrl: string;
}

/** Montant texte de `___xtr_order` / `___xtr_order_line` : vide ou « 12.34 ».
 * Mesuré le 2026-10-19 : aucune valeur non vide hors de ce format. */
const MONTANT_TEXTE = /^\d+(?:\.\d{1,2})?$/;

/** Montant texte en centimes ; vide = 0 (même lecture que `coalesce(nullif(x,''),'0')`),
 * `null` si la valeur n'est pas un montant. */
function centimesDuTexte(valeur: unknown): number | null {
  const texte = valeur == null ? '' : String(valeur).trim();
  if (texte === '') return 0;
  if (!MONTANT_TEXTE.test(texte)) return null;
  const [euros, decimales = ''] = texte.split('.');
  return Number(euros) * 100 + Number(decimales.padEnd(2, '0'));
}

/** Centimes → « 12.34 », sans passer par un flottant. */
function texteDesCentimes(centimes: number): string {
  return `${Math.floor(centimes / 100)}.${String(centimes % 100).padStart(2, '0')}`;
}

/**
 * Service Orders Principal - Version Consolidée
 *
 * Responsabilités:
 * - CRUD commandes
 * - Création depuis panier
 * - Validation métier
 * - Calcul totaux
 * - Gestion lignes de commande
 *
 * Délégations:
 * - Calculs → OrderCalculationService
 * - Statuts → OrderStatusService
 * - Livraison → ShippingService
 */
@Injectable()
export class OrdersService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly calculationService: OrderCalculationService,
    private readonly statusService: OrderStatusService,
    private readonly shippingService: ShippingService,
    private readonly shippingCalculator: ShippingCalculatorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mailService: MailService,
    private readonly piecePriceData: PiecePriceDataService,
  ) {
    super();
  }

  /** Expose le client Supabase pour le controller (idempotence) */
  getSupabaseClient() {
    return this.supabase;
  }

  /**
   * Créer une commande complète.
   *
   * INVARIANT F2 (Vault #301, canon `commerce-runtime/authority-graph.yaml#authorities.cart`) :
   * `createOrder` consomme EXCLUSIVEMENT `orderData.orderLines` (snapshot CQRS posté par
   * le front). Aucune relecture serveur du panier session. Le panier n'est vidé qu'au
   * callback paiement. Ce pattern snapshot/CQRS rend structurellement inutile le verrou
   * legacy `verrouille` (PHP) — ajouter un Redis lock ici serait du bricolage.
   *
   * Garde mécanique : `.ast-grep/rules/commerce-no-server-cart-read-in-createorder.yml`
   * interdit statiquement `cartService.get*` / `cartRepository.find*` dans ce scope.
   */
  async createOrder(
    orderData: CreateOrderData,
  ): Promise<OrderWithDetails | OrderOperationResult> {
    try {
      this.logger.log(`Création commande pour client ${orderData.customerId}`);

      // Validation
      if (
        !orderData.customerId ||
        orderData.customerId === 'NaN' ||
        orderData.customerId === 'undefined' ||
        orderData.customerId === 'null'
      ) {
        throw new BadRequestException(
          'ID client invalide. Veuillez vous connecter ou utiliser le checkout invité.',
        );
      }

      if (!orderData.orderLines || orderData.orderLines.length === 0) {
        throw new BadRequestException(
          'La commande doit contenir au moins une ligne',
        );
      }

      // Générer numéro unique de commande
      const orderNumber = await this.generateOrderNumber();

      // Calculer frais de port basé sur le poids réel (Colissimo 2026)
      const subtotalForShipping = orderData.orderLines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0,
      );
      const orderItems = orderData.orderLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      }));
      const totalWeightG =
        await this.shippingCalculator.getCartItemsWeight(orderItems);
      const shippingCost = this.shippingCalculator.calculateByWeight(
        totalWeightG,
        subtotalForShipping,
      );

      // Calculer totaux
      // ✅ Phase 5: Les prix sont TTC, donc taxRate = 0 (pas de TVA supplémentaire)
      const totals = await this.calculationService.calculateOrderTotal(
        orderData.orderLines,
        shippingCost,
        0, // discountAmount
        0, // taxRate = 0 car les prix sont déjà TTC
      );

      // Snapshot adresses au moment de la commande (JSONB)
      const billingSnapshot = orderData.billingAddress
        ? {
            firstName: orderData.billingAddress.firstName || null,
            lastName: orderData.billingAddress.lastName || null,
            address: orderData.billingAddress.address || null,
            addressLine2: orderData.billingAddress.addressLine2 || null,
            zipCode: orderData.billingAddress.zipCode || null,
            city: orderData.billingAddress.city || null,
            country: orderData.billingAddress.country || 'France',
            phone: orderData.billingAddress.phone || null,
            snapshotAt: new Date().toISOString(),
          }
        : null;
      const shippingSnapshot = orderData.shippingAddress
        ? {
            firstName: orderData.shippingAddress.firstName || null,
            lastName: orderData.shippingAddress.lastName || null,
            address: orderData.shippingAddress.address || null,
            addressLine2: orderData.shippingAddress.addressLine2 || null,
            zipCode: orderData.shippingAddress.zipCode || null,
            city: orderData.shippingAddress.city || null,
            country: orderData.shippingAddress.country || 'France',
            phone: orderData.shippingAddress.phone || null,
            snapshotAt: new Date().toISOString(),
          }
        : null;

      // Créer commande principale avec les vrais noms de colonnes
      const orderToInsert = {
        ord_id: orderNumber,
        ord_cst_id: String(orderData.customerId).trim(),
        ord_date: new Date().toISOString(),
        ord_parent: '0',
        ord_is_pay: '0',
        ord_date_pay: null,
        ord_amount_ttc: String(totals.subtotal.toFixed(2)),
        ord_deposit_ttc: String(totals.consigne_total.toFixed(2)),
        ord_shipping_fee_ttc: String(shippingCost.toFixed(2)),
        ord_total_ttc: String(totals.total.toFixed(2)),
        ord_info: orderData.customerNote || 'Commande depuis le site',
        ord_ords_id: '1',
        ord_cba_id: orderData.billingAddress?.id
          ? String(orderData.billingAddress.id)
          : null,
        ord_cda_id: orderData.shippingAddress?.id
          ? String(orderData.shippingAddress.id)
          : null,
        ord_billing_snapshot: billingSnapshot,
        ord_shipping_snapshot: shippingSnapshot,
      };

      this.logger.log(
        '📤 Données à insérer:',
        JSON.stringify(orderToInsert, null, 2),
      );

      const orderId = orderNumber;

      // Enrichir les lignes de commande (ref/marque) AVANT l'insert atomique
      const orderLines = await Promise.all(
        orderData.orderLines.map(async (line, index) => {
          let productName = line.productName;
          let productRef = line.productReference || null;
          let productBrand = line.productBrand || null;
          let productId = line.productId || null;
          let depositUnit: string | null = null;
          let depositTotal: string | null = null;

          if (line.consigne_unit && line.consigne_unit > 0) {
            depositUnit = String(line.consigne_unit.toFixed(2));
            depositTotal = String(
              (line.consigne_unit * line.quantity).toFixed(2),
            );
          }

          // Re-lookup DB si ref ou marque manquante
          if (productId && (!productRef || !productBrand)) {
            try {
              const pieceId = parseInt(String(productId), 10);
              if (!isNaN(pieceId)) {
                const { data: piece } = await this.supabase
                  .from(TABLES.pieces)
                  .select('piece_id, piece_name, piece_ref, piece_pm_id')
                  .eq('piece_id', pieceId)
                  .single();
                if (piece) {
                  productRef = productRef || piece.piece_ref || null;
                  productName = productName || piece.piece_name || 'Produit';
                  productId = String(piece.piece_id);
                  if (!productBrand && piece.piece_pm_id) {
                    const { data: brand } = await this.supabase
                      .from(TABLES.pieces_marque)
                      .select('pm_name')
                      .eq('pm_id', String(piece.piece_pm_id))
                      .single();
                    productBrand = brand?.pm_name || null;
                  }
                  this.logger.log(
                    `Enrichissement produit ${pieceId}: ref=${productRef}, marque=${productBrand}`,
                  );
                }
              }
            } catch (_e) {
              this.logger.warn(`Enrichissement produit ${productId} echoue`);
            }
          }

          return {
            orl_id: `${orderId}-L${String(index + 1).padStart(3, '0')}`,
            orl_ord_id: String(orderId),
            orl_pg_name: productName,
            orl_pg_id: productId || null,
            orl_pm_name: productBrand || null,
            orl_art_ref: productRef || null,
            orl_art_quantity: String(line.quantity),
            orl_art_price_sell_unit_ttc: String(line.unitPrice.toFixed(2)),
            orl_art_price_sell_ttc: String(
              (line.quantity * line.unitPrice).toFixed(2),
            ),
            orl_art_deposit_unit_ttc: depositUnit,
            orl_art_deposit_ttc: depositTotal,
            // F1 attribution : source d'ajout par-ligne (NULL si absente — rétro-compat RPC)
            orl_website_url: line.website_url || null,
          };
        }),
      );

      // Atomic insert: order + lines + ORDER_CREATED event in single DB transaction via RPC.
      // p_correlation_id is explicit (instead of relying on PG DEFAULT gen_random_uuid()) to
      // satisfy ast-grep `commerce-correlation-id-required-on-mutations` and to preserve
      // causality lineage from day 1 (Vault #301 canon, Operational Knowledge Graph prep).
      // MUST be a UUID (p_correlation_id is typed `uuid`). The idempotency key (ik-<ts>-<rand>)
      // is a DIFFERENT identifier — NOT a uuid — and is handled separately by the controller
      // (checkIdempotency / order_idempotency dedup). Wiring it here raised
      // "invalid input syntax for type uuid". One fresh uuid per creation, matching the
      // `?? randomUUID()` convention used elsewhere (updateOrder L638, order-status.service).
      const correlationId = randomUUID();
      const { error: rpcError } = await this.callRpc(
        'create_order_atomic',
        {
          p_order: orderToInsert,
          p_lines: orderLines,
          p_correlation_id: correlationId,
        },
        { isServiceRole: true, source: 'internal' },
      );

      if (rpcError) {
        this.logger.error('Erreur création atomique:', rpcError);
        throw new BadRequestException(
          `Échec création commande: ${rpcError.message}`,
        );
      }

      this.logger.log(
        `Commande #${orderId} créée atomiquement (${orderLines.length} lignes)`,
      );

      // Emettre event order.created
      this.eventEmitter.emit(ORDER_EVENTS.CREATED, {
        orderId,
        customerId: String(orderData.customerId),
        totalTtc: totals.total,
        linesCount: orderLines.length,
        // F1 attribution : propager la source d'ajout par-ligne (funnel/analytics)
        lines: orderLines.map((l) => ({
          lineId: l.orl_id,
          productId: l.orl_pg_id,
          websiteUrl: l.orl_website_url,
        })),
        timestamp: new Date().toISOString(),
      } satisfies OrderCreatedEvent);

      // Envoyer email de confirmation (non-bloquant)
      try {
        const { data: customer } = await this.supabase
          .from(TABLES.xtr_customer)
          .select('cst_mail, cst_fname, cst_name')
          .eq('cst_id', String(orderData.customerId))
          .single();
        if (customer?.cst_mail) {
          const emailOrder: OrderEmailData = {
            ord_id: orderId,
            ord_total_ttc: totals.total,
            ord_amount_ttc: totals.subtotal,
            ord_deposit_ttc: totals.consigne_total,
            ord_shipping_fee_ttc: shippingCost,
            ord_date: new Date().toISOString(),
            lines: orderLines.map((l) => ({
              orl_pg_name: l.orl_pg_name,
              orl_art_ref: l.orl_art_ref,
              orl_pm_name: l.orl_pm_name,
              orl_art_quantity: l.orl_art_quantity,
              orl_art_price_sell_unit_ttc: l.orl_art_price_sell_unit_ttc,
              orl_art_price_sell_ttc: l.orl_art_price_sell_ttc,
              orl_art_deposit_unit_ttc: l.orl_art_deposit_unit_ttc,
            })),
          };
          await this.mailService.sendOrderConfirmation(
            emailOrder,
            customer as CustomerEmailData,
          );
          this.logger.log(`Email confirmation envoye a ${customer.cst_mail}`);
        }
      } catch (mailError) {
        this.logger.warn('Email confirmation non envoye:', mailError);
      }

      // Retourner commande complète
      return await this.getOrderById(orderId);
    } catch (error: unknown) {
      this.logger.error('Erreur createOrder:', error);
      throw error;
    }
  }

  /**
   * Récupérer une commande par ID
   * 🚀 P7.2 PERF: Paralléliser order + lines, puis customer
   */
  async getOrderById(orderId: string): Promise<OrderWithDetails> {
    try {
      // 🚀 P7.2 PERF: Paralléliser order et lines (indépendants)
      const [orderResult, linesResult] = await Promise.all([
        this.supabase
          .from(TABLES.xtr_order)
          .select('*')
          .eq('ord_id', orderId)
          .single(),
        this.supabase
          .from(TABLES.xtr_order_line)
          .select('*')
          .eq('orl_ord_id', orderId),
      ]);

      const { data: order, error } = orderResult;
      const { data: lines } = linesResult;

      if (error || !order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Customer dépend de order.ord_cst_id - doit rester séquentiel
      let customer = null;
      if (order.ord_cst_id) {
        const { data: customerData, error: customerError } = await this.supabase
          .from(TABLES.xtr_customer)
          .select(
            'cst_id, cst_fname, cst_name, cst_mail, cst_tel, cst_gsm, cst_address, cst_zip_code, cst_city, cst_country',
          )
          .eq('cst_id', order.ord_cst_id)
          .single();

        if (!customerError) {
          customer = customerData;
        }
      }

      return {
        ...order,
        customer,
        lines: lines || [],
        statusHistory: [],
      };
    } catch (error: unknown) {
      this.logger.error(`Erreur getOrderById(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Lister les commandes avec filtres
   */
  async listOrders(filters: OrderFilters = {}): Promise<OrderListResult> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      // Utiliser les vrais noms de colonnes Supabase (préfixe ord_)
      let query = this.supabase
        .from(TABLES.xtr_order)
        .select('*', { count: 'exact' });

      // Filtres
      if (filters.customerId) {
        query = query.eq('ord_cst_id', filters.customerId);
      }

      if (filters.status) {
        query = query.eq('ord_ords_id', filters.status.toString());
      }

      if (filters.startDate) {
        query = query.gte('ord_date', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('ord_date', filters.endDate.toISOString());
      }

      if (filters.minAmount) {
        query = query.gte('ord_total_ttc', filters.minAmount.toString());
      }

      if (filters.maxAmount) {
        query = query.lte('ord_total_ttc', filters.maxAmount.toString());
      }

      if (filters.search) {
        query = query.or(
          `ord_id.ilike.%${filters.search}%,ord_info.ilike.%${filters.search}%`,
        );
      }

      // Pagination et tri
      query = query
        .range(offset, offset + limit - 1)
        .order('ord_date', { ascending: false });

      const { data: orders, error, count } = await query;

      if (error) {
        this.logger.error('Erreur listOrders:', error);
        throw new BadRequestException(`Erreur récupération: ${error.message}`);
      }

      return {
        data: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNextPage: page < Math.ceil((count || 0) / limit),
          hasPreviousPage: page > 1,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Erreur listOrders:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une commande
   */
  async updateOrder(
    orderId: string,
    updateData: UpdateOrderData,
  ): Promise<OrderWithDetails> {
    try {
      const existing = await this.getOrderById(orderId);
      const fromStatus = existing.ord_ords_id;

      // Guard: cancelled order is terminal (no further updates).
      if (fromStatus === OrderStatus.CANCELLED) {
        throw new ConflictException(
          'Commande déjà annulée — toute mise à jour est rejetée.',
        );
      }

      // Guard: shipped orders (ord_date_ship is set) are read-only for fields below.
      // Status changes still pass through isValidTransition canon below.
      const correlationId = updateData.correlationId ?? randomUUID();

      // Compose DB update using the REAL ord_* columns (Vault #301 fix).
      const dataToUpdate: Record<string, unknown> = {
        ord_updated_at: new Date().toISOString(),
      };

      if (updateData.billingAddress !== undefined) {
        dataToUpdate.ord_billing_snapshot = updateData.billingAddress;
      }

      if (updateData.shippingAddress !== undefined) {
        dataToUpdate.ord_shipping_snapshot = updateData.shippingAddress;
      }

      if (updateData.customerNote !== undefined) {
        dataToUpdate.ord_info = updateData.customerNote;
      }

      if (updateData.status !== undefined) {
        if (!isOrderStatusCode(updateData.status)) {
          throw new BadRequestException(
            `Statut '${updateData.status}' hors-canon (1..5 attendus per ___xtr_order_status).`,
          );
        }
        if (
          !isValidTransition(fromStatus as OrderStatusCode, updateData.status)
        ) {
          throw new ConflictException(
            `Transition ${fromStatus} → ${updateData.status} invalide pour la commande ${orderId}.`,
          );
        }
        dataToUpdate.ord_ords_id = updateData.status;
      }

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update(dataToUpdate)
        .eq('ord_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec MAJ: ${error.message}`);
      }

      // Append audit event AFTER successful UPDATE (RPC validates correlation_id).
      // Note: status changes during paid-order cancellation are blocked above by the
      // `'2'` terminal guard + isValidTransition (5 → 2 forbidden in @repo/domain-commerce).
      if (updateData.status !== undefined && updateData.status !== fromStatus) {
        await this.statusService.appendOrderEvent({
          ordId: orderId,
          eventType: 'STATUS_CHANGED',
          fromStatus: fromStatus as OrderStatusCode | null,
          toStatus: updateData.status,
          payload: { trigger: 'updateOrder', source: 'orders_service' },
          correlationId,
          userId: updateData.userId,
        });
      } else if (updateData.customerNote !== undefined) {
        await this.statusService.appendOrderEvent({
          ordId: orderId,
          eventType: 'NOTE_UPDATED',
          fromStatus: fromStatus as OrderStatusCode | null,
          toStatus: fromStatus as OrderStatusCode | null,
          payload: {
            old_info: existing.ord_info,
            new_info: updateData.customerNote,
          },
          correlationId,
          userId: updateData.userId,
        });
      } else if (
        updateData.billingAddress !== undefined ||
        updateData.shippingAddress !== undefined
      ) {
        await this.statusService.appendOrderEvent({
          ordId: orderId,
          eventType: 'ADDRESS_UPDATED',
          fromStatus: fromStatus as OrderStatusCode | null,
          toStatus: fromStatus as OrderStatusCode | null,
          payload: {
            billing_changed: updateData.billingAddress !== undefined,
            shipping_changed: updateData.shippingAddress !== undefined,
          },
          correlationId,
          userId: updateData.userId,
        });
      }

      this.logger.log(
        `Commande #${orderId} mise à jour (correlation_id=${correlationId})`,
      );
      return await this.getOrderById(orderId);
    } catch (error: unknown) {
      this.logger.error(`Erreur updateOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Annuler une commande via cancel_order_atomic RPC (Vault #301 fix).
   *
   * IMPORTANT V1: refuse HTTP 409 si commande payée — annulation requiert
   * workflow refund manuel (payments/ module off-limits,
   * cf. feedback_no_payment_module_changes_ever). V1.7+: Human Override Authority
   * permettra de réouvrir cette transition couplée à un refund manuel.
   *
   * La RPC est composite (UPDATE + append_order_event en une tx) — atomicité audit
   * garantie côté DB. Elle décide sur la ligne verrouillée (FOR UPDATE), depuis
   * 20260924_cancel_order_atomic_refuse_paid.sql :
   * - payée = ord_is_pay='1' OU ord_date_pay non vide, quel que soit le statut
   *   (même prédicat que getCustomerCancelRefusal) → « refund workflow required » ;
   * - déjà annulée ('2') → « already cancelled » ;
   * - seules les transitions canoniques 1|3|4 → 2 (ORDER_STATUS_TRANSITIONS de
   *   @repo/domain-commerce) passent ; statut absent ou hors canon → « invalid
   *   transition ».
   * Ces messages sont traduits en 409 ci-dessous ; « not found » en 404.
   */
  async cancelOrder(
    orderId: string,
    reason?: string,
    userId?: number,
    correlationId?: string,
  ): Promise<OrderOperationResult> {
    try {
      const { error: rpcError } = await this.callRpc(
        'cancel_order_atomic',
        {
          p_ord_id: orderId,
          p_reason: reason ?? 'Commande annulée',
          p_user_id: userId ?? null,
          p_correlation_id: correlationId ?? randomUUID(),
        },
        { isServiceRole: true, source: 'internal' },
      );

      if (rpcError) {
        const message = rpcError.message || '';
        // Translate Postgres RAISE EXCEPTION messages to HTTP semantics.
        if (
          message.includes('refund workflow required') ||
          message.includes('paid')
        ) {
          throw new ConflictException(
            "Annulation d'une commande payée requiert un workflow remboursement séparé, contactez le support.",
          );
        }
        if (message.includes('already cancelled')) {
          throw new ConflictException(`Commande ${orderId} déjà annulée.`);
        }
        if (message.includes('invalid transition')) {
          throw new ConflictException(
            'Cette commande ne peut plus être annulée.',
          );
        }
        if (message.includes('not found')) {
          throw new NotFoundException(`Commande ${orderId} introuvable.`);
        }
        throw new BadRequestException(`Échec annulation: ${message}`);
      }

      this.logger.log(`Commande #${orderId} annulée via cancel_order_atomic`);
      return { success: true, message: 'Commande annulée', ord_id: orderId };
    } catch (error: unknown) {
      this.logger.error(`Erreur cancelOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Commande de supplément : une pièce payée est en rupture chez le fournisseur,
   * un équivalent plus cher est disponible, et le client paie la différence.
   *
   * Crée une commande ENFANT (`ord_parent` = commande d'origine), non payée, d'une
   * seule ligne : l'équivalent au prix de vente du site, moins ce qui a déjà été
   * payé pour la ligne en rupture. Port et consigne à 0 : le port payé sur la
   * commande d'origine reste acquis. `paymentUrl` mène au paiement Paybox, qui
   * relit le montant en base.
   *
   * Tout est vérifié AVANT l'écriture, et l'écriture passe par `create_order_atomic`
   * (commande + ligne + ORDER_CREATED en une transaction), jamais par une table :
   * - commande d'origine payée (`ord_is_pay = '1'` et date de paiement), non
   *   annulée, et dont les montants sont ceux de ses lignes (un écart = remise ou
   *   retouche, hors de cette procédure) ;
   * - ligne en rupture dans cette commande, avec un montant payé ;
   * - aucun autre supplément non annulé sur la commande ;
   * - équivalent affiché, autre que la pièce en rupture, vendable selon
   *   `PiecePriceDataService` (le prix que voit le client), sans consigne, et
   *   jamais vendu à perte : vente HT ≥ achat HT en base ET achat HT confirmé
   *   chez le fournisseur ;
   * - supplément > 0 et divisible au centime par la quantité ;
   * - client avec une adresse e-mail, sans laquelle le lien serait refusé.
   *
   * N'envoie aucun mail : le texte proposé au client est validé par l'owner
   * (skill order-rupture-equivalence).
   *
   * Limite connue : deux appels simultanés peuvent passer tous deux le contrôle
   * « aucun supplément ». La base n'a pas d'unicité sur `ord_parent`, car des
   * commandes historiques portent plusieurs enfants.
   */
  async createSupplementOrder(
    parentOrderId: string,
    input: CreateSupplementOrderInput,
    ctx: { userId?: string } = {},
  ): Promise<SupplementOrderResult> {
    const { lineId, pieceId, quantity, confirmedPurchaseHt } = input;
    if (typeof parentOrderId !== 'string' || parentOrderId.trim() === '') {
      throw new BadRequestException("Commande d'origine requise.");
    }
    if (typeof lineId !== 'string' || lineId.trim() === '') {
      throw new BadRequestException('Ligne en rupture requise (lineId).');
    }
    if (!Number.isInteger(pieceId) || pieceId <= 0) {
      throw new BadRequestException(
        'Pièce équivalente invalide (pieceId entier positif).',
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantité invalide (entier positif).');
    }
    if (
      typeof confirmedPurchaseHt !== 'number' ||
      !Number.isFinite(confirmedPurchaseHt) ||
      confirmedPurchaseHt <= 0
    ) {
      throw new BadRequestException(
        "Prix d'achat HT confirmé chez le fournisseur requis (confirmedPurchaseHt > 0).",
      );
    }
    const echecLecture = (quoi: string, error: { message: string }) =>
      new Error(`Lecture ${quoi} impossible : ${error.message}`);

    // Commande d'origine : payée, non annulée, montants égaux à ses lignes.
    const { data: parent, error: parentError } = await this.supabase
      .from(TABLES.xtr_order)
      .select(
        'ord_id, ord_cst_id, ord_is_pay, ord_date_pay, ord_ords_id, ord_amount_ttc, ord_deposit_ttc, ord_cba_id, ord_cda_id, ord_billing_snapshot, ord_shipping_snapshot',
      )
      .eq('ord_id', parentOrderId)
      .maybeSingle();
    if (parentError) throw echecLecture('de la commande', parentError);
    if (!parent) {
      throw new NotFoundException(`Commande ${parentOrderId} introuvable.`);
    }
    const payee =
      String(parent.ord_is_pay) === '1' &&
      parent.ord_date_pay != null &&
      String(parent.ord_date_pay).trim() !== '';
    if (!payee || parent.ord_ords_id === OrderStatus.CANCELLED) {
      throw new ConflictException(
        `La commande ${parentOrderId} n'est pas payée, ou est annulée : pas de supplément possible.`,
      );
    }

    const { data: lignes, error: lignesError } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select(
        'orl_id, orl_pg_id, orl_pm_name, orl_art_ref, orl_art_price_sell_ttc, orl_art_deposit_ttc',
      )
      .eq('orl_ord_id', parentOrderId);
    if (lignesError) throw echecLecture('des lignes', lignesError);
    let piecesCentimes = 0;
    let consigneCentimes = 0;
    for (const l of lignes ?? []) {
      const vente = centimesDuTexte(l.orl_art_price_sell_ttc);
      const consigne = centimesDuTexte(l.orl_art_deposit_ttc);
      if (vente === null || consigne === null) {
        throw new ConflictException(
          `Montant illisible sur la ligne ${l.orl_id} : supplément à traiter à la main.`,
        );
      }
      piecesCentimes += vente;
      consigneCentimes += consigne;
    }
    if (
      piecesCentimes !== centimesDuTexte(parent.ord_amount_ttc) ||
      consigneCentimes !== centimesDuTexte(parent.ord_deposit_ttc)
    ) {
      throw new ConflictException(
        `Les montants de la commande ${parentOrderId} (pièces ${parent.ord_amount_ttc}, consigne ${parent.ord_deposit_ttc}) ne sont pas ceux de ses lignes (pièces ${texteDesCentimes(piecesCentimes)}, consigne ${texteDesCentimes(consigneCentimes)}) : remise ou retouche, supplément à traiter à la main.`,
      );
    }

    // Ligne en rupture, et ce qui a été payé pour elle (pièces + consigne).
    const ligne = (lignes ?? []).find((l) => l.orl_id === lineId);
    if (!ligne) {
      throw new NotFoundException(
        `Ligne ${lineId} absente de la commande ${parentOrderId}.`,
      );
    }
    const payeCentimes =
      (centimesDuTexte(ligne.orl_art_price_sell_ttc) ?? 0) +
      (centimesDuTexte(ligne.orl_art_deposit_ttc) ?? 0);
    if (payeCentimes <= 0) {
      throw new ConflictException(
        `Aucun montant payé lisible pour la ligne ${lineId}.`,
      );
    }

    // Un seul supplément vivant par commande ; un supplément annulé ne compte pas.
    const { data: enfants, error: enfantsError } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_ords_id')
      .eq('ord_parent', parentOrderId);
    if (enfantsError) throw echecLecture('des suppléments', enfantsError);
    const enCours = (enfants ?? []).find(
      (e) => e.ord_ords_id !== OrderStatus.CANCELLED,
    );
    if (enCours) {
      throw new ConflictException(
        `La commande ${parentOrderId} a déjà un supplément non annulé (${enCours.ord_id}).`,
      );
    }

    // Équivalent : affiché, autre que la pièce en rupture, avec sa marque.
    if (String(pieceId) === String(ligne.orl_pg_id)) {
      throw new ConflictException(
        `La pièce ${pieceId} est celle en rupture : choisir un équivalent.`,
      );
    }
    const { data: piece, error: pieceError } = await this.supabase
      .from(TABLES.pieces)
      .select('piece_id, piece_name, piece_ref, piece_pm_id, piece_display')
      .eq('piece_id', pieceId)
      .maybeSingle();
    if (pieceError) throw echecLecture('de la pièce', pieceError);
    if (!piece || piece.piece_display !== true) {
      throw new ConflictException(
        `La pièce ${pieceId} est introuvable ou n'est pas affichée sur le site.`,
      );
    }
    const { data: marque, error: marqueError } = await this.supabase
      .from(TABLES.pieces_marque)
      .select('pm_name')
      .eq('pm_id', String(piece.piece_pm_id))
      .maybeSingle();
    if (marqueError) throw echecLecture('de la marque', marqueError);
    if (!marque?.pm_name) {
      throw new ConflictException(
        `Marque introuvable pour la pièce ${pieceId}.`,
      );
    }

    // Tarif : l'autorité unique, jamais une requête de plus sur pieces_price.
    const tarif = await this.piecePriceData.findSellablePrice(pieceId);
    if (!tarif) {
      throw new ConflictException(
        `La pièce ${pieceId} n'a aucun tarif vendable.`,
      );
    }
    const consigneTtc = Number(tarif.pri_consigne_ttc_n ?? 0);
    if (consigneTtc !== 0) {
      throw new ConflictException(
        `La pièce ${pieceId} porte une consigne (${tarif.pri_consigne_ttc_n} € TTC) : supplément à traiter à la main.`,
      );
    }
    const venteHt =
      tarif.pri_vente_ht_n == null ? NaN : Number(tarif.pri_vente_ht_n);
    const achatBaseHt =
      tarif.pri_achat_ht_n == null ? null : Number(tarif.pri_achat_ht_n);
    if (!(venteHt >= Math.max(confirmedPurchaseHt, achatBaseHt ?? 0))) {
      throw new ConflictException(
        `Vente à perte refusée pour la pièce ${pieceId} : vente HT ${tarif.pri_vente_ht_n ?? 'absente'}, achat HT en base ${achatBaseHt ?? 'absent'}, achat HT confirmé ${confirmedPurchaseHt}.`,
      );
    }

    // Supplément = quantité × prix TTC − payé pour la ligne, en centimes.
    const venteTtcCentimes = Math.round(Number(tarif.pri_vente_ttc_n) * 100);
    const totalCentimes = quantity * venteTtcCentimes - payeCentimes;
    if (totalCentimes <= 0) {
      throw new ConflictException(
        `Aucun supplément à payer : ${quantity} × ${texteDesCentimes(venteTtcCentimes)} € TTC ne dépasse pas les ${texteDesCentimes(payeCentimes)} € déjà payés.`,
      );
    }
    if (totalCentimes % quantity !== 0) {
      throw new ConflictException(
        `Le supplément de ${texteDesCentimes(totalCentimes)} € ne se divise pas au centime par ${quantity} : supplément à traiter à la main.`,
      );
    }
    const unitCentimes = totalCentimes / quantity;

    const { data: client, error: clientError } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('cst_mail')
      .eq('cst_id', String(parent.ord_cst_id))
      .maybeSingle();
    if (clientError) throw echecLecture('du client', clientError);
    const email =
      typeof client?.cst_mail === 'string' ? client.cst_mail.trim() : '';
    if (!email) {
      throw new ConflictException(
        `Le client de la commande ${parentOrderId} n'a pas d'adresse e-mail : le lien de paiement serait refusé.`,
      );
    }

    // Création atomique : commande + ligne + ORDER_CREATED.
    const orderId = await this.generateOrderNumber();
    const total = texteDesCentimes(totalCentimes);
    const enRupture =
      `${ligne.orl_pm_name ?? ''} ${ligne.orl_art_ref ?? ''}`.trim();
    const order = {
      ord_id: orderId,
      ord_cst_id: String(parent.ord_cst_id),
      ord_date: new Date().toISOString(),
      ord_parent: parentOrderId,
      ord_is_pay: '0',
      ord_date_pay: null,
      ord_amount_ttc: total,
      ord_deposit_ttc: '0.00',
      ord_shipping_fee_ttc: '0.00',
      ord_total_ttc: total,
      ord_info: `Supplément de la commande ${parentOrderId} : ${quantity} × ${marque.pm_name} ${piece.piece_ref} (${texteDesCentimes(venteTtcCentimes)} € TTC) au lieu de ${enRupture} en rupture fournisseur, moins ${texteDesCentimes(payeCentimes)} € déjà payés ; port déjà payé sur la commande d'origine.`,
      ord_ords_id: OrderStatus.PROCESSING,
      ord_cba_id: parent.ord_cba_id ?? null,
      ord_cda_id: parent.ord_cda_id ?? null,
      ord_billing_snapshot: parent.ord_billing_snapshot ?? null,
      ord_shipping_snapshot: parent.ord_shipping_snapshot ?? null,
    };
    const line = {
      orl_id: `${orderId}-L001`,
      orl_ord_id: orderId,
      orl_pg_id: String(pieceId),
      orl_pg_name: `${piece.piece_name} — supplément échange (remplace ${enRupture})`,
      orl_pm_name: marque.pm_name,
      orl_art_ref: piece.piece_ref,
      orl_art_quantity: String(quantity),
      orl_art_price_sell_unit_ttc: texteDesCentimes(unitCentimes),
      orl_art_price_sell_ttc: total,
      orl_art_deposit_unit_ttc: null,
      orl_art_deposit_ttc: null,
      orl_website_url: null,
    };
    const correlationId = randomUUID();
    const { error: rpcError } = await this.callRpc(
      'create_order_atomic',
      { p_order: order, p_lines: [line], p_correlation_id: correlationId },
      { isServiceRole: true, source: 'internal' },
    );
    if (rpcError) {
      this.logger.error(
        `Échec création du supplément de ${parentOrderId}: ${rpcError.message}`,
      );
      throw new BadRequestException(
        `Échec création du supplément: ${rpcError.message}`,
      );
    }

    this.eventEmitter.emit(ORDER_EVENTS.CREATED, {
      orderId,
      customerId: String(parent.ord_cst_id),
      totalTtc: totalCentimes / 100,
      linesCount: 1,
      lines: [
        { lineId: line.orl_id, productId: line.orl_pg_id, websiteUrl: null },
      ],
      timestamp: new Date().toISOString(),
      correlationId,
    } satisfies OrderCreatedEvent);
    this.logger.log(
      `Supplément ${orderId} créé pour ${parentOrderId} : ${total} € TTC (${quantity} × pièce ${pieceId}), utilisateur ${ctx.userId ?? 'inconnu'}`,
    );

    return {
      orderId,
      parentOrderId,
      totalTtc: totalCentimes / 100,
      unitTtc: unitCentimes / 100,
      quantity,
      paymentUrl: `${SITE_ORIGIN}/api/paybox/redirect?${new URLSearchParams({ orderId, amount: total, email })}`,
    };
  }

  // NOTE: deleteOrder method intentionally REMOVED (Vault #301 PR-C).
  // Reason: hard-delete on commerce orders is never legitimate (audit légal, comptable).
  // The `DELETE /orders/:id` controller route is mapped to cancelOrder (soft, status '2')
  // in OrdersController.

  /**
   * Récupérer les commandes d'un client
   */
  async getCustomerOrders(
    customerId: string,
    page = 1,
    limit = 20,
  ): Promise<OrderListResult> {
    return this.listOrders({ customerId, page, limit });
  }

  /**
   * Obtenir statistiques commandes
   */
  async getOrderStats(customerId?: string): Promise<OrderStats> {
    try {
      let query = this.supabase.from(TABLES.xtr_order).select('*', {
        count: 'exact',
        head: false,
      });

      if (customerId) {
        query = query.eq('ord_cst_id', customerId);
      }

      const { data: orders, count } = await query;

      const totalRevenue = (orders || []).reduce(
        (sum, order) => sum + parseFloat(order.ord_total_ttc || '0'),
        0,
      );

      const statusCounts = (orders || []).reduce(
        (acc, order) => {
          const status = order.ord_ords_id || '0';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        totalOrders: count || 0,
        totalRevenue,
        averageOrderValue: count && count > 0 ? totalRevenue / count : 0,
        statusBreakdown: statusCounts,
      };
    } catch (error: unknown) {
      this.logger.error('Erreur getOrderStats:', error);
      throw error;
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Générer numéro de commande unique
   */
  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }
}
