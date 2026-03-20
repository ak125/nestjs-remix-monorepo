import { TABLES } from '@repo/database-types';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
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
    consigne_unit?: number; // Phase 5: Consigne unitaire
    has_consigne?: boolean; // Phase 5: Produit avec consigne
  }>;
  billingAddress: OrderAddress;
  shippingAddress: OrderAddress;
  customerNote?: string;
  shippingMethod?: string;
}

export interface UpdateOrderData {
  billingAddress?: OrderAddress;
  shippingAddress?: OrderAddress;
  customerNote?: string;
  status?: number;
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
  order_status?: number;
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
  ) {
    super();
  }

  /**
   * Créer une commande complète
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
          };
        }),
      );

      // Atomic insert: order + lines in single DB transaction via RPC
      const { error: rpcError } = await this.supabase.rpc(
        'create_order_atomic',
        {
          p_order: orderToInsert,
          p_lines: orderLines,
        },
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
      // Vérifier existence
      const existing = await this.getOrderById(orderId);

      // Vérifier statut (pas de MAJ si expédiée/livrée)
      if (existing.order_status >= 4) {
        throw new ConflictException(
          'Impossible de modifier une commande expédiée/livrée',
        );
      }

      const dataToUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.billingAddress) {
        dataToUpdate.billing_address = JSON.stringify(
          updateData.billingAddress,
        );
      }

      if (updateData.shippingAddress) {
        dataToUpdate.shipping_address = JSON.stringify(
          updateData.shippingAddress,
        );
      }

      if (updateData.customerNote !== undefined) {
        dataToUpdate.customer_note = updateData.customerNote;
      }

      if (updateData.status !== undefined) {
        dataToUpdate.order_status = updateData.status;
        // Créer historique
        await this.statusService.createStatusHistory(
          parseInt(orderId, 10),
          updateData.status,
          'Statut mis à jour',
        );
      }

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update(dataToUpdate)
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec MAJ: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} mise à jour`);
      return await this.getOrderById(orderId);
    } catch (error: unknown) {
      this.logger.error(`Erreur updateOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Annuler une commande
   */
  async cancelOrder(
    orderId: string,
    reason?: string,
  ): Promise<OrderOperationResult> {
    try {
      const order = await this.getOrderById(orderId);

      // Vérifier si annulation possible (avant expédition)
      if (order.order_status >= 4) {
        throw new ConflictException(
          "Impossible d'annuler une commande expédiée/livrée",
        );
      }

      // Statut annulée = 99
      await this.updateOrder(orderId, { status: 99 });
      await this.statusService.createStatusHistory(
        parseInt(orderId, 10),
        99,
        reason || 'Commande annulée',
      );

      this.logger.log(`Commande #${orderId} annulée`);
      return { success: true, message: 'Commande annulée' };
    } catch (error: unknown) {
      this.logger.error(`Erreur cancelOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Supprimer une commande (soft delete)
   */
  async deleteOrder(orderId: string): Promise<OrderOperationResult> {
    try {
      const order = await this.getOrderById(orderId);

      // Seules les commandes brouillon peuvent être supprimées
      if (order.order_status !== 1) {
        throw new ConflictException(
          'Seules les commandes brouillon peuvent être supprimées',
        );
      }

      // Supprimer lignes
      await this.supabase
        .from(TABLES.xtr_order_line)
        .delete()
        .eq('order_id', orderId);

      // Supprimer commande
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .delete()
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec suppression: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} supprimée`);
      return { success: true, message: 'Commande supprimée' };
    } catch (error: unknown) {
      this.logger.error(`Erreur deleteOrder(${orderId}):`, error);
      throw error;
    }
  }

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
