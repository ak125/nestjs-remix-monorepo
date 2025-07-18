import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Injectable()
export class OrdersCompleteService {
  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupérer les commandes avec toutes les relations
   * Utilise toutes les tables : ___xtr_order, ___xtr_order_line, ___xtr_customer, 
   * ___xtr_order_status, ___xtr_order_line_status, ___xtr_customer_billing_address, 
   * ___xtr_customer_delivery_address
   */
  async getOrdersWithAllRelations(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ orders: any[]; total: number }> {
    try {
      console.log(`🔍 OrdersCompleteService.getOrdersWithAllRelations: page=${page}, limit=${limit}`);
      
      const offset = (page - 1) * limit;
      
      // Construire la requête avec tous les filtres
      let query = `${this.supabaseService['baseUrl']}/___xtr_order?select=*`;
      
      if (filters?.status) {
        query += `&ord_ords_id=eq.${filters.status}`;
      }
      if (filters?.customerId) {
        query += `&ord_cst_id=eq.${filters.customerId}`;
      }
      if (filters?.dateFrom) {
        query += `&ord_date=gte.${filters.dateFrom}`;
      }
      if (filters?.dateTo) {
        query += `&ord_date=lte.${filters.dateTo}`;
      }
      
      query += `&order=ord_date.desc&offset=${offset}&limit=${limit}`;
      
      console.log(`📡 Query: ${query}`);
      
      const response = await fetch(query, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return { orders: [], total: 0 };
      }

      const orders = await response.json();
      
      // Enrichir chaque commande avec toutes les relations
      const enrichedOrders = await Promise.all(
        orders.map(async (order: any) => {
          // Récupérer le statut de commande
          const statusDetails = await this.getOrderStatusById(order.ord_ords_id);
          
          // Récupérer les informations client
          const customer = await this.supabaseService.getUserById(order.ord_cst_id);
          
          // Récupérer l'adresse de facturation
          const billingAddress = await this.getCustomerBillingAddress(order.ord_cba_id);
          
          // Récupérer l'adresse de livraison
          const deliveryAddress = await this.getCustomerDeliveryAddress(order.ord_cda_id);
          
          // Récupérer les lignes de commande avec leurs statuts
          const orderLines = await this.getOrderLinesWithStatus(order.ord_id);
          
          return {
            ...order,
            statusDetails,
            customer,
            billingAddress,
            deliveryAddress,
            orderLines,
            // Calculer des statistiques
            totalLines: orderLines.length,
            totalQuantity: orderLines.reduce((sum: number, line: any) => 
              sum + parseInt(line.orl_art_quantity || '0'), 0),
          };
        })
      );

      // Compter le total (sans pagination)
      const countQuery = `${this.supabaseService['baseUrl']}/___xtr_order?select=count`;
      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });
      
      const countResult = await countResponse.json();
      const total = countResult[0]?.count || 0;

      console.log(`✅ Enriched orders retrieved: ${enrichedOrders.length}/${total}`);
      return {
        orders: enrichedOrders,
        total: total
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes enrichies:', error);
      return { orders: [], total: 0 };
    }
  }

  private async getOrderStatusById(statusId: string): Promise<any> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_order_status?ords_id=eq.${statusId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération statut:', response.status);
        return null;
      }

      const statuses = await response.json();
      return statuses.length > 0 ? statuses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut:', error);
      return null;
    }
  }

  private async getCustomerBillingAddress(addressId: string): Promise<any> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_customer_billing_address?cba_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération adresse facturation:', response.status);
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de facturation:', error);
      return null;
    }
  }

  private async getCustomerDeliveryAddress(addressId: string): Promise<any> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_customer_delivery_address?cda_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération adresse livraison:', response.status);
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de livraison:', error);
      return null;
    }
  }

  private async getOrderLinesWithStatus(orderId: string): Promise<any[]> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_order_line?orl_ord_id=eq.${orderId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération lignes commande:', response.status);
        return [];
      }

      const orderLines = await response.json();
      
      // Enrichir chaque ligne avec son statut
      const enrichedLines = await Promise.all(
        orderLines.map(async (line: any) => {
          const lineStatus = await this.getOrderLineStatusById(line.orl_orls_id);
          return {
            ...line,
            lineStatus
          };
        })
      );

      return enrichedLines;
    } catch (error) {
      console.error('Erreur lors de la récupération des lignes de commande:', error);
      return [];
    }
  }

  private async getOrderLineStatusById(statusId: string): Promise<any> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_order_line_status?orls_id=eq.${statusId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération statut ligne:', response.status);
        return null;
      }

      const statuses = await response.json();
      return statuses.length > 0 ? statuses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut de ligne:', error);
      return null;
    }
  }

  /**
   * Récupérer tous les statuts de commande disponibles
   */
  async getAllOrderStatuses(): Promise<any[]> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_order_status?select=*&order=ords_id.asc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération statuts:', response.status);
        return [];
      }

      const statuses = await response.json();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts:', error);
      return [];
    }
  }

  /**
   * Récupérer tous les statuts de ligne de commande disponibles
   */
  async getAllOrderLineStatuses(): Promise<any[]> {
    try {
      const url = `${this.supabaseService['baseUrl']}/___xtr_order_line_status?select=*&order=orls_id.asc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur récupération statuts lignes:', response.status);
        return [];
      }

      const statuses = await response.json();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts de lignes:', error);
      return [];
    }
  }

  /**
   * Récupérer une commande complète par ID
   */
  async getCompleteOrderById(orderId: string): Promise<any> {
    try {
      console.log(`🔍 OrdersCompleteService.getCompleteOrderById: ${orderId}`);
      
      const url = `${this.supabaseService['baseUrl']}/___xtr_order?ord_id=eq.${orderId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return null;
      }

      const orders = await response.json();
      
      if (orders.length === 0) {
        return null;
      }

      const order = orders[0];
      
      // Enrichir avec toutes les relations
      const statusDetails = await this.getOrderStatusById(order.ord_ords_id);
      const customer = await this.supabaseService.getUserById(order.ord_cst_id);
      const billingAddress = await this.getCustomerBillingAddress(order.ord_cba_id);
      const deliveryAddress = await this.getCustomerDeliveryAddress(order.ord_cda_id);
      const orderLines = await this.getOrderLinesWithStatus(order.ord_id);
      
      return {
        ...order,
        statusDetails,
        customer,
        billingAddress,
        deliveryAddress,
        orderLines,
        totalLines: orderLines.length,
        totalQuantity: orderLines.reduce((sum: number, line: any) => 
          sum + parseInt(line.orl_art_quantity || '0'), 0),
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la commande complète:', error);
      return null;
    }
  }

  /**
   * Récupérer les statistiques des commandes par statut
   */
  async getOrderStatsByStatus(): Promise<any[]> {
    try {
      console.log(`🔍 OrdersCompleteService.getOrderStatsByStatus`);
      
      // Récupérer tous les statuts
      const allStatuses = await this.getAllOrderStatuses();
      
      // Pour chaque statut, compter les commandes
      const statsByStatus = await Promise.all(
        allStatuses.map(async (status) => {
          const url = `${this.supabaseService['baseUrl']}/___xtr_order?ord_ords_id=eq.${status.ords_id}&select=count`;
          const response = await fetch(url, {
            method: 'GET',
            headers: this.supabaseService['headers'],
          });
          
          if (!response.ok) {
            console.error('Erreur comptage commandes:', response.status);
            return {
              status: status,
              orderCount: 0,
              totalAmount: 0
            };
          }
          
          const countResult = await response.json();
          const orderCount = countResult[0]?.count || 0;
          
          // Calculer le montant total pour ce statut
          const amountUrl = `${this.supabaseService['baseUrl']}/___xtr_order?ord_ords_id=eq.${status.ords_id}&select=ord_total_ttc`;
          const amountResponse = await fetch(amountUrl, {
            method: 'GET',
            headers: this.supabaseService['headers'],
          });
          
          let totalAmount = 0;
          if (amountResponse.ok) {
            const orders = await amountResponse.json();
            totalAmount = orders.reduce((sum: number, order: any) => 
              sum + parseFloat(order.ord_total_ttc || '0'), 0);
          }
          
          return {
            status: status,
            orderCount: orderCount,
            totalAmount: totalAmount
          };
        })
      );
      
      console.log(`✅ Order stats by status calculated`);
      return statsByStatus.sort((a, b) => b.orderCount - a.orderCount);
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return [];
    }
  }
}
