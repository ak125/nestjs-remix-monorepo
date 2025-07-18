/**
 * Service Orders moderne utilisant toutes les tables liées
 * Tables utilisées : ___xtr_order, ___xtr_order_line, ___xtr_customer, 
 * ___xtr_order_status, ___xtr_order_line_status, ___xtr_customer_billing_address, 
 * ___xtr_customer_delivery_address
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { OrdersCompleteService } from './orders-complete.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly ordersCompleteService: OrdersCompleteService
  ) {}

  /**
   * Récupérer les commandes avec pagination et toutes les relations
   */
  async findOrdersWithPagination(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    try {
      console.log(`🔍 OrdersService.findOrdersWithPagination: page=${page}, limit=${limit}`);
      console.log('--- Début de getOrdersWithPagination ---');
      console.log('Pagination: {');
      console.log(`  page: ${page},`);
      console.log(`  limit: ${limit},`);
      console.log('  filters: {');
      console.log(`    status: ${filters?.status || 'undefined'},`);
      console.log(`    customerId: ${filters?.customerId || 'undefined'},`);
      console.log(`    dateFrom: ${filters?.dateFrom || 'undefined'},`);
      console.log(`    dateTo: ${filters?.dateTo || 'undefined'}`);
      console.log('  }');
      console.log('}');
      
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(page, limit, filters);
      
      console.log(`Commandes récupérées: ${result.orders.length}, Total: ${result.total}`);
      console.log(`✅ Orders retrieved: ${result.orders.length}/${result.total}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error in OrdersService.findOrdersWithPagination: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer les commandes d'un client avec toutes les relations
   */
  async findOrdersByCustomerId(customerId: string) {
    try {
      console.log(`🔍 OrdersService.findOrdersByCustomerId: ${customerId}`);
      const orders = await this.supabaseService.getOrdersByCustomerId(customerId);
      
      // Enrichir avec les relations via le service complet
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          return await this.ordersCompleteService.getCompleteOrderById(order.ord_id);
        })
      );
      
      console.log(`✅ Orders found: ${enrichedOrders.length}`);
      return enrichedOrders;
    } catch (error) {
      console.error(`❌ Error in OrdersService.findOrdersByCustomerId: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer une commande complète par ID
   */
  async findOrderById(orderId: string) {
    try {
      console.log(`🔍 OrdersService.findOrderById: ${orderId}`);
      const order = await this.ordersCompleteService.getCompleteOrderById(orderId);
      
      if (!order) {
        console.log(`❌ Order not found: ${orderId}`);
        return null;
      }
      
      console.log(`✅ Order found: ${order.ord_id}`);
      return order;
    } catch (error) {
      console.error(`❌ Error in OrdersService.findOrderById: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques des commandes par statut
   */
  async getOrderStatsByStatus() {
    try {
      console.log(`🔍 OrdersService.getOrderStatsByStatus`);
      const stats = await this.ordersCompleteService.getOrderStatsByStatus();
      
      console.log(`✅ Order stats by status calculated`);
      return stats;
    } catch (error) {
      console.error(`❌ Error in OrdersService.getOrderStatsByStatus: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer tous les statuts disponibles
   */
  async getAllOrderStatuses() {
    try {
      console.log(`🔍 OrdersService.getAllOrderStatuses`);
      const statuses = await this.ordersCompleteService.getAllOrderStatuses();
      
      console.log(`✅ Order statuses retrieved: ${statuses.length}`);
      return statuses;
    } catch (error) {
      console.error(`❌ Error in OrdersService.getAllOrderStatuses: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer tous les statuts de ligne disponibles
   */
  async getAllOrderLineStatuses() {
    try {
      console.log(`🔍 OrdersService.getAllOrderLineStatuses`);
      const statuses = await this.ordersCompleteService.getAllOrderLineStatuses();
      
      console.log(`✅ Order line statuses retrieved: ${statuses.length}`);
      return statuses;
    } catch (error) {
      console.error(`❌ Error in OrdersService.getAllOrderLineStatuses: ${error}`);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut de paiement d'une commande
   */
  async updatePaymentStatus(orderId: string, isPaid: boolean) {
    try {
      console.log(`🔍 OrdersService.updatePaymentStatus: ${orderId}, isPaid=${isPaid}`);
      
      const updates: any = {
        ord_is_pay: isPaid ? '1' : '0'
      };
      
      if (isPaid) {
        updates.ord_date_pay = new Date().toISOString();
      }
      
      const success = await this.supabaseService.updateOrder(orderId, updates);
      
      console.log(`✅ Payment status updated: ${success}`);
      return success;
    } catch (error) {
      console.error(`❌ Error in OrdersService.updatePaymentStatus: ${error}`);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   */
  async updateOrderStatus(orderId: string, statusId: string) {
    try {
      console.log(`🔍 OrdersService.updateOrderStatus: ${orderId}, status=${statusId}`);
      
      const updates = {
        ord_ords_id: statusId
      };
      
      const success = await this.supabaseService.updateOrder(orderId, updates);
      
      console.log(`✅ Order status updated: ${success}`);
      return success;
    } catch (error) {
      console.error(`❌ Error in OrdersService.updateOrderStatus: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques générales des commandes
   */
  async getOrderStats() {
    try {
      console.log(`🔍 OrdersService.getOrderStats`);
      const stats = await this.supabaseService.getOrderStats();
      
      console.log(`✅ Order stats retrieved`);
      return stats;
    } catch (error) {
      console.error(`❌ Error in OrdersService.getOrderStats: ${error}`);
      throw error;
    }
  }

  /**
   * Créer une nouvelle commande
   */
  async createOrder(orderData: any) {
    try {
      console.log(`🔍 OrdersService.createOrder`);
      
      // Générer un ID unique pour la commande
      const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newOrder = await this.supabaseService.createOrder({
        ord_id: orderId,
        ord_cst_id: orderData.customerId,
        ord_date: new Date().toISOString(),
        ord_total_ttc: orderData.totalAmount?.toString() || '0',
        ord_is_pay: '0', // Non payé par défaut
        ord_ords_id: '1', // Statut par défaut
        ...orderData
      });
      
      console.log(`✅ Order created: ${newOrder?.ord_id}`);
      return newOrder;
    } catch (error) {
      console.error(`❌ Error in OrdersService.createOrder: ${error}`);
      throw error;
    }
  }

  /**
   * Mettre à jour une commande
   */
  async updateOrder(orderId: string, updates: any) {
    try {
      console.log(`🔍 OrdersService.updateOrder: ${orderId}`);
      const updatedOrder = await this.supabaseService.updateOrder(orderId, updates);
      
      console.log(`✅ Order updated: ${updatedOrder?.ord_id}`);
      return updatedOrder;
    } catch (error) {
      console.error(`❌ Error in OrdersService.updateOrder: ${error}`);
      throw error;
    }
  }

  /**
   * Supprimer une commande
   */
  async deleteOrder(orderId: string) {
    try {
      console.log(`🔍 OrdersService.deleteOrder: ${orderId}`);
      const success = await this.supabaseService.deleteOrder(orderId);
      
      console.log(`✅ Order deleted: ${success}`);
      return success;
    } catch (error) {
      console.error(`❌ Error in OrdersService.deleteOrder: ${error}`);
      throw error;
    }
  }
}
