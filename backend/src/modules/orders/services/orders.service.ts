import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { OrderCalculationService } from './order-calculation.service';
import { OrderStatusService } from './order-status.service';
import { ShippingService } from '../../shipping/shipping.service';

export interface CreateOrderData {
  customerId: number;
  orderLines: Array<{
    productId: string;
    productName: string;
    productReference: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    discount?: number;
  }>;
  billingAddress: any;
  shippingAddress: any;
  customerNote?: string;
  shippingMethod?: string;
}

export interface UpdateOrderData {
  billingAddress?: any;
  shippingAddress?: any;
  customerNote?: string;
  status?: number;
}

export interface OrderFilters {
  customerId?: number;
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
  orderId: number;
  productId: string;
  productName: string;
  productReference: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discount: number;
  subtotal: number;
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
  ) {
    super();
  }

  /**
   * Créer une commande complète
   */
  async createOrder(orderData: CreateOrderData): Promise<any> {
    try {
      this.logger.log(`Création commande pour client ${orderData.customerId}`);

      // Validation
      if (!orderData.orderLines || orderData.orderLines.length === 0) {
        throw new BadRequestException(
          'La commande doit contenir au moins une ligne',
        );
      }

      // Générer numéro unique
      const orderNumber = await this.generateOrderNumber();

      // Calculer frais de port
      const shippingCost = await this.calculateShippingCost(orderData);

      // Calculer totaux
      const totals = await this.calculationService.calculateOrderTotal(
        orderData.orderLines,
        shippingCost,
      );

      // Créer commande principale
      const orderToInsert = {
        order_number: orderNumber,
        customer_id: orderData.customerId,
        order_status: 1, // Brouillon
        subtotal_ht: totals.subtotal,
        total_tva: totals.taxAmount,
        shipping_cost: shippingCost,
        total_ttc: totals.total,
        billing_address: JSON.stringify(orderData.billingAddress),
        shipping_address: JSON.stringify(orderData.shippingAddress),
        customer_note: orderData.customerNote || null,
        shipping_method: orderData.shippingMethod || 'standard',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdOrder, error: orderError } = await this.supabase
        .from('___XTR_ORDER')
        .insert(orderToInsert)
        .select()
        .single();

      if (orderError) {
        this.logger.error('Erreur création commande:', orderError);
        throw new BadRequestException(
          `Échec création commande: ${orderError.message}`,
        );
      }

      const orderId = createdOrder.order_id;
      this.logger.log(`Commande créée: #${orderId} (${orderNumber})`);

      // Créer lignes de commande
      const orderLines = orderData.orderLines.map((line) => ({
        order_id: orderId,
        product_id: line.productId,
        product_name: line.productName,
        product_reference: line.productReference,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        vat_rate: line.vatRate || 20.0,
        discount: line.discount || 0,
        subtotal:
          line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100),
        created_at: new Date().toISOString(),
      }));

      const { error: linesError } = await this.supabase
        .from('___XTR_ORDER_LINE')
        .insert(orderLines);

      if (linesError) {
        this.logger.error('Erreur création lignes:', linesError);
        // Rollback manuel - supprimer la commande
        await this.supabase
          .from('___XTR_ORDER')
          .delete()
          .eq('order_id', orderId);
        throw new BadRequestException(
          `Échec création lignes: ${linesError.message}`,
        );
      }

      this.logger.log(`${orderLines.length} lignes créées pour #${orderId}`);

      // Créer historique statut initial
      await this.statusService.createStatusHistory(
        orderId,
        1,
        'Commande créée',
      );

      // Retourner commande complète
      return await this.getOrderById(orderId);
    } catch (error: any) {
      this.logger.error('Erreur createOrder:', error);
      throw error;
    }
  }

  /**
   * Récupérer une commande par ID
   */
  async getOrderById(orderId: number): Promise<any> {
    try {
      const { data: order, error } = await this.supabase
        .from('___XTR_ORDER')
        .select(
          `
          *,
          customer:customer_id(cst_id, cst_mail, cst_fname, cst_name)
        `,
        )
        .eq('order_id', orderId)
        .single();

      if (error || !order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Récupérer lignes
      const { data: lines } = await this.supabase
        .from('___XTR_ORDER_LINE')
        .select('*')
        .eq('order_id', orderId);

      // Récupérer historique statuts
      const statusHistory =
        await this.statusService.getOrderStatusHistory(orderId);

      return {
        ...order,
        lines: lines || [],
        statusHistory,
      };
    } catch (error: any) {
      this.logger.error(`Erreur getOrderById(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Lister les commandes avec filtres
   */
  async listOrders(filters: OrderFilters = {}): Promise<any> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('___XTR_ORDER')
        .select(
          '*, customer:customer_id(cst_id, cst_mail, cst_fname, cst_name)',
          {
            count: 'exact',
          },
        );

      // Filtres
      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      if (filters.status) {
        query = query.eq('order_status', filters.status);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      if (filters.minAmount) {
        query = query.gte('total_ttc', filters.minAmount);
      }

      if (filters.maxAmount) {
        query = query.lte('total_ttc', filters.maxAmount);
      }

      if (filters.search) {
        query = query.or(
          `order_number.ilike.%${filters.search}%,customer_note.ilike.%${filters.search}%`,
        );
      }

      // Pagination et tri
      query = query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

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
    } catch (error: any) {
      this.logger.error('Erreur listOrders:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une commande
   */
  async updateOrder(
    orderId: number,
    updateData: UpdateOrderData,
  ): Promise<any> {
    try {
      // Vérifier existence
      const existing = await this.getOrderById(orderId);

      // Vérifier statut (pas de MAJ si expédiée/livrée)
      if (existing.order_status >= 4) {
        throw new ConflictException(
          'Impossible de modifier une commande expédiée/livrée',
        );
      }

      const dataToUpdate: any = {
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
          orderId,
          updateData.status,
          'Statut mis à jour',
        );
      }

      const { error } = await this.supabase
        .from('___XTR_ORDER')
        .update(dataToUpdate)
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec MAJ: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} mise à jour`);
      return await this.getOrderById(orderId);
    } catch (error: any) {
      this.logger.error(`Erreur updateOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Annuler une commande
   */
  async cancelOrder(orderId: number, reason?: string): Promise<any> {
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
        orderId,
        99,
        reason || 'Commande annulée',
      );

      this.logger.log(`Commande #${orderId} annulée`);
      return { success: true, message: 'Commande annulée' };
    } catch (error: any) {
      this.logger.error(`Erreur cancelOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Supprimer une commande (soft delete)
   */
  async deleteOrder(orderId: number): Promise<any> {
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
        .from('___XTR_ORDER_LINE')
        .delete()
        .eq('order_id', orderId);

      // Supprimer commande
      const { error } = await this.supabase
        .from('___XTR_ORDER')
        .delete()
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec suppression: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} supprimée`);
      return { success: true, message: 'Commande supprimée' };
    } catch (error: any) {
      this.logger.error(`Erreur deleteOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Récupérer les commandes d'un client
   */
  async getCustomerOrders(
    customerId: number,
    page = 1,
    limit = 20,
  ): Promise<any> {
    return this.listOrders({ customerId, page, limit });
  }

  /**
   * Obtenir statistiques commandes
   */
  async getOrderStats(customerId?: number): Promise<any> {
    try {
      let query = this.supabase.from('___XTR_ORDER').select('*', {
        count: 'exact',
        head: false,
      });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: orders, count } = await query;

      const totalRevenue = (orders || []).reduce(
        (sum, order) => sum + (order.total_ttc || 0),
        0,
      );

      const statusCounts = (orders || []).reduce(
        (acc, order) => {
          const status = order.order_status || 0;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );

      return {
        totalOrders: count || 0,
        totalRevenue,
        averageOrderValue: count && count > 0 ? totalRevenue / count : 0,
        statusBreakdown: statusCounts,
      };
    } catch (error: any) {
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

  /**
   * Calculer frais de port
   */
  private async calculateShippingCost(
    _orderData: CreateOrderData,
  ): Promise<number> {
    try {
      // Pour l'instant, logique simple basée sur le montant
      // ShippingService.calculateShippingFee() nécessite orderId
      // On appliquera le calcul après création de la commande
      return 5.99; // Forfait par défaut
    } catch (error) {
      this.logger.warn('Erreur calcul port, utilisation forfait:', error);
      return 5.99;
    }
  }
}
