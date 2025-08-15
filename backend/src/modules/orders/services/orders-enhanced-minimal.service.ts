import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { OrderCalculationService } from './order-calculation.service';
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

/**
 * Service Orders Enhanced - Version Minimale Fonctionnelle
 * ✅ Création de commandes simplifiée
 * ✅ Listage avec filtres
 * ✅ Compatible avec l'infrastructure existante
 */
@Injectable()
export class OrdersServiceEnhanced extends SupabaseBaseService {
  protected readonly logger = new Logger(OrdersServiceEnhanced.name);

  constructor(
    private readonly calculationService: OrderCalculationService,
    private readonly shippingService: ShippingService,
  ) {
    super();
  }

  /**
   * Créer une commande simplifiée
   */
  async createOrder(orderData: CreateOrderData): Promise<any> {
    try {
      this.logger.log(`Creating order for customer ${orderData.customerId}`);

      // 1. Générer le numéro de commande
      const orderNumber = await this.generateOrderNumber();

      // 2. Calculer les frais de port
      const shippingCost = await this.calculateShippingCost(orderData);

      // 3. Calculer les totaux
      const subtotal = orderData.orderLines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0,
      );

      const vatAmount = subtotal * 0.2; // TVA 20%
      const total = subtotal + vatAmount + shippingCost;

      // 4. Créer la commande principale
      const { data: order, error } = await this.supabase
        .from('___xtr_order')
        .insert({
          order_number: orderNumber,
          customer_id: orderData.customerId,
          subtotal,
          vat_amount: vatAmount,
          shipping_cost: shippingCost,
          total,
          status: 1, // En attente
          customer_note: orderData.customerNote,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // 5. Créer les lignes de commande
      for (const line of orderData.orderLines) {
        await this.supabase.from('___xtr_order_line').insert({
          order_id: order.order_id,
          product_id: line.productId,
          product_name: line.productName,
          product_reference: line.productReference,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          total_price: line.quantity * line.unitPrice,
          vat_rate: line.vatRate || 0.2,
        });
      }

      return {
        success: true,
        order: {
          ...order,
          lines: orderData.orderLines,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create order:`, error);
      throw error;
    }
  }

  /**
   * Générer un numéro de commande unique
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await this.supabase
      .from('___xtr_order')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`);

    const orderNumber = `${year}-${String((count || 0) + 1).padStart(6, '0')}`;
    return orderNumber;
  }

  /**
   * Calculer les frais de port
   */
  private async calculateShippingCost(orderData: CreateOrderData): Promise<number> {
    try {
      // Calculer le poids total approximatif
      const totalWeight = orderData.orderLines.reduce(
        (sum, line) => sum + line.quantity * 0.5, // 0.5kg par défaut par produit
        0,
      );

      // Calculer le montant total de la commande
      const orderAmount = orderData.orderLines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0,
      );

      // Utiliser calculateShippingEstimate avec les paramètres appropriés
      const estimate = await this.shippingService.calculateShippingEstimate({
        weight: totalWeight,
        country: 'FR',
        postalCode: '75000', // Code postal par défaut
        orderAmount,
      });

      return estimate.fee;
    } catch (error) {
      this.logger.warn(
        'Error calculating shipping estimate, using default:',
        error,
      );
      return 5.0; // Frais de port par défaut
    }
  }

  /**
   * Lister les commandes avec filtres
   */
  async listOrders(filters: {
    limit?: number;
    offset?: number;
    customerId?: number;
    status?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<any> {
    try {
      let query = this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_customer(id, firstname, lastname, email),
          ___xtr_order_status(label)
        `,
        )
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        orders: data || [],
        total: data?.length || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to list orders:`, error);
      throw error;
    }
  }

  /**
   * Récupérer une commande par son ID
   */
  async getOrderById(orderId: number): Promise<any> {
    try {
      this.logger.log(`Getting order ${orderId}`);

      const { data: order, error } = await this.supabase
        .from('___xtr_order')
        .select(`
          *,
          ___xtr_order_line (
            *
          )
        `)
        .eq('order_id', orderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Order not found
        }
        throw error;
      }

      return order;
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }
}
